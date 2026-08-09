import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CATEGORY_LABEL,
  allProgress,
  formatMilestoneValue,
  milestoneId,
  type MilestoneCategory,
  type MilestoneProgress,
} from '@/analytics/milestones';
import { completedSessions, selectSessions, useStore } from '@/store/useStore';
import { Card, Dim, H2 } from './components';
import { MilestoneBadge, bandName } from './MilestoneBadge';
import { theme } from './theme';

const HINT: Record<MilestoneCategory, string> = {
  weight: 'Every kilogram you have moved, added up.',
  workouts: 'Distinct days with something recorded.',
  calories: 'Estimated from session length and your body weight.',
};

/**
 * The three ladders, with where you sit on each. Tap one for its full history.
 *
 * Deliberately compact: it sits at the top of the History page, above the list of workouts, and
 * every row it takes is a workout you cannot see. The badge, the rank and the progress bar stay
 * because they answer "how am I doing"; the explanatory line under the heading went, because it
 * said the same thing every time you looked at it.
 */
export function MilestonesCard() {
  const allSessions = useStore(selectSessions);
  const profile = useStore((s) => s.profile);
  const [open, setOpen] = useState<MilestoneProgress | null>(null);

  const progress = useMemo(
    () => allProgress(completedSessions(allSessions), profile),
    [allSessions, profile],
  );

  return (
    <Card>
      <H2>Milestones</H2>

      {progress.map((p) => (
        <Pressable
          key={p.category}
          onPress={() => setOpen(p)}
          testID={`milestone-${p.category}`}
          style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}
        >
          <MilestoneBadge level={p.level} size={40} />

          <View style={{ flex: 1 }}>
            <Text style={s.category}>{CATEGORY_LABEL[p.category]}</Text>
            <Text style={s.rank}>
              {p.level > 0 ? `${bandName(p.level)} · Level ${p.level}` : 'Not started'}
            </Text>

            <View style={s.track}>
              <View style={[s.fill, { width: `${Math.round(p.fraction * 100)}%` }]} />
            </View>

            <Text style={s.progressText}>
              {formatMilestoneValue(p.category, p.value)}
              {p.next !== null
                ? ` · ${formatMilestoneValue(p.category, p.next - p.value)} to level ${p.level + 1}`
                : ' · every level earned'}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={theme.color.textFaint} />
        </Pressable>
      ))}

      <MilestoneHistory progress={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

/** Every level in one ladder: what has been earned, and what is still ahead. */
function MilestoneHistory({
  progress,
  onClose,
}: {
  progress: MilestoneProgress | null;
  onClose: () => void;
}) {
  if (!progress) return null;
  const { category, tiers, level, value } = progress;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetBackdrop}>
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <MilestoneBadge level={level} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle}>{CATEGORY_LABEL[category]}</Text>
              <Dim>
                {formatMilestoneValue(category, value)} · {HINT[category]}
              </Dim>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={10}
              testID="milestone-history-close"
            >
              <Ionicons name="close" size={24} color={theme.color.textDim} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.sheetBody}>
            {tiers.map((tier, i) => {
              const earned = i < level;
              const isNext = i === level;
              return (
                <View
                  key={tier}
                  style={[s.tier, earned && s.tierEarned, isNext && s.tierNext]}
                >
                  <MilestoneBadge level={i + 1} size={earned ? 36 : 30} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.tierName, !earned && { color: theme.color.textFaint }]}>
                      Level {i + 1} · {bandName(i + 1)}
                    </Text>
                    <Dim>{formatMilestoneValue(category, tier)}</Dim>
                  </View>
                  {earned ? (
                    <Ionicons name="checkmark-circle" size={20} color={theme.color.accent} />
                  ) : isNext ? (
                    <Text style={s.tierRemaining}>
                      {formatMilestoneValue(category, tier - value)} to go
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Congratulates the user the first time each threshold is crossed.
 *
 * Only ever fires for milestones not already recorded as seen, so reinstalling or reopening the
 * app cannot replay old achievements. An existing user's history is marked seen silently the
 * first time this runs, rather than firing a stack of popups for training they already did.
 */
export function MilestoneCelebration() {
  const allSessions = useStore(selectSessions);
  const profile = useStore((s) => s.profile);
  const seen = useStore((s) => s.celebratedMilestones);
  const markSeen = useStore((s) => s.markMilestonesSeen);

  const progress = useMemo(
    () => allProgress(completedSessions(allSessions), profile),
    [allSessions, profile],
  );

  const fresh = useMemo(() => {
    const out: { category: MilestoneCategory; tier: number; id: string; level: number }[] = [];
    for (const p of progress) {
      for (let i = 0; i < p.level; i++) {
        const id = milestoneId(p.category, p.tiers[i]);
        if (!seen.includes(id)) out.push({ category: p.category, tier: p.tiers[i], id, level: i + 1 });
      }
    }
    return out;
  }, [progress, seen]);

  if (fresh.length === 0) return null;

  // Show the highest new one; the rest are recorded silently in the same tap.
  const top = fresh[fresh.length - 1];

  return (
    <Modal visible transparent animationType="fade">
      <View style={s.celebrateBackdrop}>
        <View style={s.celebrate}>
          <MilestoneBadge level={top.level} size={120} />
          <Text style={s.celebrateKicker}>MILESTONE REACHED</Text>
          <Text style={s.celebrateTitle}>
            {bandName(top.level)} · Level {top.level}
          </Text>
          <Text style={s.celebrateValue}>
            {formatMilestoneValue(top.category, top.tier)}
          </Text>
          <Dim style={{ textAlign: 'center' }}>
            {CATEGORY_LABEL[top.category]}
            {fresh.length > 1 ? ` · and ${fresh.length - 1} more` : ''}
          </Dim>

          <Pressable
            accessibilityRole="button"
            testID="celebrate-dismiss"
            style={s.celebrateBtn}
            onPress={() => markSeen(fresh.map((f) => f.id))}
          >
            <Text style={s.celebrateBtnLabel}>Nice</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  category: { color: theme.color.text, fontSize: theme.font.body, fontWeight: '700' },
  rank: { color: theme.color.accent, fontSize: theme.font.tiny, fontWeight: '700' },
  track: {
    height: 5,
    borderRadius: 4,
    backgroundColor: theme.color.surfaceAlt,
    overflow: 'hidden',
    marginTop: theme.space(1),
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: theme.color.accent },
  progressText: { color: theme.color.textDim, fontSize: theme.font.tiny, marginTop: theme.space(1) },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '86%',
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderTopWidth: 1,
    borderColor: theme.color.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    padding: theme.space(4),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  sheetTitle: { color: theme.color.text, fontSize: theme.font.h2, fontWeight: '700' },
  sheetBody: { padding: theme.space(4), gap: theme.space(2) },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    padding: theme.space(2.5),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  tierEarned: { backgroundColor: theme.color.surfaceAlt, borderColor: theme.color.accentDim },
  tierNext: { borderColor: theme.color.accent },
  tierName: { color: theme.color.text, fontSize: theme.font.small, fontWeight: '700' },
  tierRemaining: { color: theme.color.textDim, fontSize: theme.font.tiny, fontWeight: '600' },

  celebrateBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space(6),
  },
  celebrate: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: theme.space(2),
    padding: theme.space(6),
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.accent,
  },
  celebrateKicker: {
    color: theme.color.accent,
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: theme.space(2),
  },
  celebrateTitle: { color: theme.color.text, fontSize: theme.font.h2, fontWeight: '800' },
  celebrateValue: { color: theme.color.text, fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  celebrateBtn: {
    marginTop: theme.space(4),
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.space(3),
    paddingHorizontal: theme.space(10),
  },
  celebrateBtnLabel: { color: theme.color.onAccent, fontWeight: '800', fontSize: theme.font.body },
});
