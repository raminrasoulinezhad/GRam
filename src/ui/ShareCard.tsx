import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { APP_URL } from '@/lib/appLink';
import { QR_MODULES } from '@/lib/qrMatrix';
import { Card, Dim, H2 } from './components';
import { theme } from './theme';

/**
 * The share card: point a camera at it and the other phone lands on the app.
 *
 * This is how GRam spreads, because there is no store listing to search for and never will be
 * (see docs/DISTRIBUTION.md). Reading a URL out loud across a gym floor does not work; holding
 * up a screen does.
 *
 * The grid itself is generated at build time by scripts/build-qr.mjs, so nothing is encoded at
 * runtime and no QR library ships in the bundle.
 */

/** Modules of quiet zone. Four is the spec's minimum, and scanners do use it. */
const QUIET = 4;

/**
 * Pixels per module, and therefore how big the code is drawn: 37 modules across at 5px is 185.
 *
 * A whole number rather than a target width divided by the span. Fractional modules make the
 * renderer antialias some boundaries and not others, which is what turns a small code grey at
 * the seams. Five also clears the roughly 2mm per module a phone camera wants.
 */
const MODULE_PX = 5;

export function ShareCard() {
  return (
    <Card testID="share">
      <H2>Share GRam</H2>
      <Dim style={s.hint}>
        Point a camera at this. It opens the app in a browser, and it can be installed from there.
      </Dim>
      <View style={s.frame}>
        <QrCode />
      </View>
      <Text
        style={s.url}
        selectable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(APP_URL).catch(() => undefined)}
      >
        {APP_URL.replace('https://', '')}
      </Text>
    </Card>
  );
}

/**
 * The code, as one path.
 *
 * BLACK ON WHITE, ALWAYS, WHATEVER THE THEME IS
 * Every other surface in the app follows the chosen palette. This one cannot: a scanner needs
 * a dark-on-light code, and half the themes here are dark. A QR code drawn in the theme's own
 * colours looks consistent and does not scan, which is the only thing it has to do. So the
 * card gives it a white tile to sit on and the modules stay black.
 *
 * One <Path> rather than several hundred <Rect>s. Both draw the same picture; the path is one
 * node in the tree instead of 400-odd, which matters on the older phone this has to stay smooth
 * on.
 */
function QrCode() {
  const span = QR_MODULES.length + QUIET * 2;
  const d = QR_MODULES.map(
    (row, y) =>
      [...row]
        .map((module, x) => (module === '1' ? `M${x + QUIET} ${y + QUIET}h1v1h-1z` : ''))
        .join(''),
  ).join('');

  return (
    <Svg
      width={span * MODULE_PX}
      height={span * MODULE_PX}
      viewBox={`0 0 ${span} ${span}`}
      accessibilityRole="image"
      accessibilityLabel={`QR code for ${APP_URL}`}
      testID="share-qr"
    >
      <Rect x={0} y={0} width={span} height={span} fill="#ffffff" />
      <Path d={d} fill="#000000" />
    </Svg>
  );
}

const s = StyleSheet.create({
  hint: { marginTop: theme.space(1), marginBottom: theme.space(3), lineHeight: 19 },
  // The white tile is part of the quiet zone: it keeps the code away from a dark card edge.
  frame: {
    alignSelf: 'center',
    padding: theme.space(2),
    borderRadius: theme.radius.md,
    backgroundColor: '#ffffff',
  },
  url: {
    marginTop: theme.space(3),
    textAlign: 'center',
    color: theme.color.accent,
    fontSize: theme.font.small,
    fontWeight: '700',
    // A tap target on a line of text is easy to miss; the underline is what says it is one.
    textDecorationLine: 'underline',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
});
