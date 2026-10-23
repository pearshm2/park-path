/**
 * One achievement tier in the Passport, after the prototype: a scalloped
 * medal with the tier's icon, its title and status, and a progress bar
 * towards it. Earned tiers turn the medal and the row accent.
 *
 * Given `from` (the park count before a trip that just finished it), it
 * starts there and plays the trip out: the bar fills to the new count and,
 * if that earns the tier, the medal stamps from grey to gold with a thud.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Path } from 'react-native-svg';

import { ACHIEVEMENT_ICON, type Achievement } from '../../data/achievements';
import { colors, radius, shadow, space } from '../../theme';
import { playSound, tap } from '../../lib/sounds';
import { BodyText } from '../Typography';

/** When the bar starts filling, and how long it takes. */
const FILL_DELAY_MS = 450;
const FILL_MS = 1100;

/** The prototype's 24-point medal, on a 48px grid. */
const MEDAL =
  'M24.00,1.00L28.79,6.13L35.50,4.08L37.08,10.92L43.92,12.50L41.87,19.21L47.00,24.00L41.87,28.79L43.92,35.50L37.08,37.08L35.50,43.92L28.79,41.87L24.00,47.00L19.21,41.87L12.50,43.92L10.92,37.08L4.08,35.50L6.13,28.79L1.00,24.00L6.13,19.21L4.08,12.50L10.92,10.92L12.50,4.08L19.21,6.13Z';

type Props = {
  tier: Achievement;
  /** National parks stamped so far. */
  count: number;
  /** When it was earned, as a label; null if not yet. */
  earned: string | null;
  /** The count to play the bar up from (see above). */
  from?: number;
};

export function AchievementRow({ tier, count, earned, from }: Props) {
  // Playing out: shown as it was until the bar has filled.
  const playing = from != null && from < count && from < tier.need;
  const [done, setDone] = useState(!playing);
  const shownCount = done ? count : from!;
  const won = earned != null && (done || from! >= tier.need);
  const ring = won ? colors.accentRamp[700] : colors.neutral[400];

  const fill = useSharedValue(Math.min(1, (playing ? from! : count) / tier.need));
  const pop = useSharedValue(1);
  useEffect(() => {
    if (!playing) return;
    const earnsIt = count >= tier.need;
    fill.value = withDelay(
      FILL_DELAY_MS,
      withTiming(Math.min(1, count / tier.need), { duration: FILL_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (!finished) return;
        scheduleOnRN(setDone, true);
        if (earnsIt) {
          scheduleOnRN(playSound, 'stamp');
          scheduleOnRN(tap, 'medium');
        }
      }),
    );
    if (earnsIt) {
      pop.value = withDelay(
        FILL_DELAY_MS + FILL_MS,
        withSequence(withTiming(1.35, { duration: 110 }), withTiming(0.92, { duration: 120 }), withTiming(1, { duration: 160 })),
      );
    }
    // Once, as it's shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const medalStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <View
      style={[styles.row, { backgroundColor: won ? colors.accentRamp[100] : colors.neutral[100] }]}
      accessible
      accessibilityLabel={`${tier.title}. ${tier.body} ${won ? `Earned ${earned}.` : `${tier.need - shownCount} to go.`}`}
    >
      <Animated.View style={[styles.medal, medalStyle]}>
        <Svg width={48} height={48} viewBox="0 0 48 48" style={StyleSheet.absoluteFill}>
          <Path d={MEDAL} fill={won ? colors.accent : colors.neutral[300]} stroke={ring} strokeWidth={1.5} />
          <Circle cx={24} cy={24} r={15} fill="none" stroke={ring} strokeWidth={1} />
        </Svg>
        <Svg
          width={21}
          height={21}
          viewBox="0 0 24 24"
          fill="none"
          stroke={won ? colors.neutral[100] : colors.neutral[600]}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ACHIEVEMENT_ICON[tier.icon].map((d) => (
            <Path key={d} d={d} />
          ))}
        </Svg>
      </Animated.View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <BodyText size={15} weight="semibold" style={styles.title}>
            {tier.title}
          </BodyText>
          <BodyText size={11} weight="semibold" color={colors.neutral[600]}>
            {won ? `Earned ${earned}` : `${tier.need - shownCount} to go`}
          </BodyText>
        </View>
        <BodyText size={12.5} lineHeightRatio={1.4} color={colors.neutral[700]} style={styles.body}>
          {tier.body}
        </BodyText>
        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, { backgroundColor: won ? colors.accent : colors.accent2Ramp[500] }, fillStyle]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    ...shadow.sm,
  },
  medal: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[2],
  },
  title: {
    flexShrink: 1,
  },
  body: {
    marginTop: 3,
  },
  track: {
    height: 6,
    marginTop: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[300],
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
