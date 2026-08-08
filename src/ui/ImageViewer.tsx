import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  clampOffset,
  clampScale,
  distance,
  DOUBLE_TAP_SCALE,
  maxOffset,
  MIN_SCALE,
  pinchScale,
  swipeFrom,
  type Point,
  type Size,
} from './zoom';
import { theme } from './theme';

export type ViewerImage = { uri: string; caption: string };

/** Two taps closer together than this are a double tap. */
const DOUBLE_TAP_MS = 280;

/**
 * A photograph, full screen, pinchable.
 *
 * The exercise thumbnails are small enough that the thing worth looking at - where the elbow is,
 * how far the bar travels - is not legible in them. Tapping one opens it here: pinch to zoom,
 * drag to move around, double tap to jump in and back out, and one clearly-labelled button to
 * leave. When an exercise has both a start and a finish frame they can be stepped between
 * without closing, since the pair only means something read together.
 *
 * Swipe does both of those without aiming at a button: sideways changes photo, up or down
 * closes. Only while the image is fitted to the screen - once it is zoomed, a drag is how you
 * move around it, and the buttons remain for both jobs.
 */
export function ImageViewer({
  images,
  index,
  onClose,
}: {
  /** Empty, or `index` out of range, renders nothing. */
  images: ViewerImage[];
  /** Which image to open on; null closes the viewer. */
  index: number | null;
  onClose: () => void;
}) {
  const [at, setAt] = useState(index ?? 0);
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [frame, setFrame] = useState<Size>({ width: 0, height: 0 });

  /*
   * Opening a different photo resets which one is shown and how far it is zoomed.
   *
   * Adjusted during render rather than in an effect, which is React's own advice for state
   * derived from a prop: an effect would paint the previous photo for a frame first, and what
   * that looks like is tapping FINISH and being shown START.
   */
  const [openedAt, setOpenedAt] = useState(index);
  if (index !== openedAt) {
    setOpenedAt(index);
    setAt(index ?? 0);
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
  }

  /*
   * Gesture bookkeeping lives in refs, not state.
   *
   * A pinch fires move events far faster than React re-renders, so reading the starting scale
   * out of state would read a value several frames stale and the image would judder.
   */
  const start = useRef({
    scale: MIN_SCALE,
    offset: { x: 0, y: 0 },
    distance: 0,
    touch: { x: 0, y: 0 },
    /*
     * Whether a second finger ever landed during this gesture. A pinch that ends with one
     * finger lifted first would otherwise look exactly like a long one-finger drag, and
     * zooming out to fit and then releasing would page to the next photo.
     */
    pinched: false,
  });
  const lastTap = useRef(0);
  const shown = index !== null && index >= 0 && index < images.length;

  const reset = useCallback(() => {
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
  }, []);

  const zoomTo = useCallback(
    (next: number) => {
      const clamped = clampScale(next);
      setScale(clamped);
      // Zooming out has to pull the image back inside the frame, or it would be left stranded
      // off-centre with a band of empty space against one edge.
      setOffset((o) => clampOffset(o, frame, clamped));
    },
    [frame],
  );

  const step = useCallback(
    (delta: number) => {
      setAt((i) => (i + delta + images.length) % images.length);
      reset();
    },
    [images.length, reset],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const touches = e.nativeEvent.touches;
          start.current = {
            scale,
            offset,
            distance:
              touches.length >= 2
                ? distance(
                    { x: touches[0].pageX, y: touches[0].pageY },
                    { x: touches[1].pageX, y: touches[1].pageY },
                  )
                : 0,
            touch: { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY },
            pinched: touches.length >= 2,
          };

          const now = Date.now();
          if (touches.length === 1 && now - lastTap.current < DOUBLE_TAP_MS) {
            lastTap.current = 0;
            zoomTo(scale > MIN_SCALE ? MIN_SCALE : DOUBLE_TAP_SCALE);
          } else {
            lastTap.current = now;
          }
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const touches = e.nativeEvent.touches;
          if (touches.length >= 2) {
            start.current.pinched = true;
            const now = distance(
              { x: touches[0].pageX, y: touches[0].pageY },
              { x: touches[1].pageX, y: touches[1].pageY },
            );
            if (start.current.distance === 0) start.current.distance = now;
            const next = pinchScale(start.current.scale, start.current.distance, now);
            setScale(next);
            setOffset((o) => clampOffset(o, frame, next));
            return;
          }
          // One finger only pans, and only when there is somewhere to pan to.
          if (maxOffset(frame.width, scale) === 0 && maxOffset(frame.height, scale) === 0) return;
          setOffset(
            clampOffset(
              {
                x: start.current.offset.x + (e.nativeEvent.pageX - start.current.touch.x),
                y: start.current.offset.y + (e.nativeEvent.pageY - start.current.touch.y),
              },
              frame,
              scale,
            ),
          );
        },
        /*
         * A finished drag that was not a pan and not a pinch: sideways changes photo, up or
         * down closes.
         *
         * Decided on release rather than during the move because the two readings are mutually
         * exclusive and there is no way to take one back - paging away from a photo the user
         * was only nudging is worse than a moment's delay. `swipeFrom` returns null while the
         * image is zoomed, which is what keeps panning working.
         */
        onPanResponderRelease: (_e, g) => {
          if (start.current.pinched) return;
          const zoomed = scale > MIN_SCALE;
          const swipe = swipeFrom(g.dx, g.dy, zoomed);
          if (swipe === 'dismiss') onClose();
          else if (swipe === 'next') step(1);
          else if (swipe === 'prev') step(-1);
        },
      }),
    [frame, offset, scale, zoomTo, step, onClose],
  );

  if (!shown) return null;

  const current = images[Math.min(at, images.length - 1)];

  return (
    <Modal
      visible
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={s.backdrop}>
        <View
          style={s.stage}
          onLayout={(e: LayoutChangeEvent) => setFrame(e.nativeEvent.layout)}
          {...responder.panHandlers}
        >
          <Image
            testID="viewer-image"
            source={{ uri: current.uri }}
            accessibilityLabel={current.caption}
            resizeMode="contain"
            style={[
              s.image,
              { transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale }] },
            ]}
          />
        </View>

        <View style={s.bar}>
          {images.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
              testID="viewer-prev"
              hitSlop={10}
              onPress={() => step(-1)}
              style={s.round}
            >
              <Ionicons name="chevron-back" size={20} color={theme.color.text} />
            </Pressable>
          ) : null}

          <Text style={s.caption}>{current.caption}</Text>

          {images.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              testID="viewer-next"
              hitSlop={10}
              onPress={() => step(1)}
              style={s.round}
            >
              <Ionicons name="chevron-forward" size={20} color={theme.color.text} />
            </Pressable>
          ) : null}
        </View>

        {/*
          * Zoom buttons as well as the pinch. Pinching needs two fingers and a free hand, and
          * this is read mid-set with one; it is also the only way in at all with a mouse.
          */}
        <View style={s.zoomBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            testID="viewer-zoom-out"
            hitSlop={10}
            onPress={() => zoomTo(scale - 0.5)}
            style={s.round}
          >
            <Ionicons name="remove" size={20} color={theme.color.text} />
          </Pressable>
          <Text testID="viewer-scale" style={s.scaleLabel}>
            {`${Math.round(scale * 100)}%`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            testID="viewer-zoom-in"
            hitSlop={10}
            onPress={() => zoomTo(scale + 0.5)}
            style={s.round}
          >
            <Ionicons name="add" size={20} color={theme.color.text} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          testID="viewer-close"
          hitSlop={10}
          onPress={onClose}
          style={s.close}
        >
          <Ionicons name="close" size={22} color={theme.color.text} />
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  // overflow hidden so a zoomed image is clipped to the stage rather than drawn over the bars.
  stage: { flex: 1, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(4),
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
  },
  caption: {
    color: theme.color.textDim,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    minWidth: 80,
  },
  zoomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(3),
    paddingBottom: theme.space(8),
  },
  scaleLabel: {
    color: theme.color.textDim,
    fontSize: theme.font.small,
    fontWeight: '700',
    minWidth: 56,
    textAlign: 'center',
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  close: {
    position: 'absolute',
    top: theme.space(10),
    right: theme.space(4),
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
});
