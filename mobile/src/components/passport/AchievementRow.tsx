/**
 * One achievement tier in the Passport, after the prototype: a scalloped
 * medal with the tier's icon, its title and status, and a progress bar
 * towards it. Earned tiers turn the medal and the row accent.
 */

import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ACHIEVEMENT_ICON, type Achievement } from '../../data/achievements';
import { colors, radius, shadow, space } from '../../theme';
import { BodyText } from '../Typography';

/** The prototype's 24-point medal, on a 48px grid. */
const MEDAL =
  'M24.00,1.00L28.79,6.13L35.50,4.08L37.08,10.92L43.92,12.50L41.87,19.21L47.00,24.00L41.87,28.79L43.92,35.50L37.08,37.08L35.50,43.92L28.79,41.87L24.00,47.00L19.21,41.87L12.50,43.92L10.92,37.08L4.08,35.50L6.13,28.79L1.00,24.00L6.13,19.21L4.08,12.50L10.92,10.92L12.50,4.08L19.21,6.13Z';

type Props = {
  tier: Achievement;
  /** National parks stamped so far. */
  count: number;
  /** When it was earned, as a label; null if not yet. */
  earned: string | null;
};

export function AchievementRow({ tier, count, earned }: Props) {
  const won = earned != null;
  const ring = won ? colors.accentRamp[700] : colors.neutral[400];
  const progress = Math.min(1, count / tier.need);

  return (
    <View
      style={[styles.row, { backgroundColor: won ? colors.accentRamp[100] : colors.neutral[100] }]}
      accessible
      accessibilityLabel={`${tier.title}. ${tier.body} ${won ? `Earned ${earned}.` : `${tier.need - count} to go.`}`}
    >
      <View style={styles.medal}>
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
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <BodyText size={15} weight="semibold" style={styles.title}>
            {tier.title}
          </BodyText>
          <BodyText size={11} weight="semibold" color={colors.neutral[600]}>
            {won ? `Earned ${earned}` : `${tier.need - count} to go`}
          </BodyText>
        </View>
        <BodyText size={12.5} lineHeightRatio={1.4} color={colors.neutral[700]} style={styles.body}>
          {tier.body}
        </BodyText>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: won ? colors.accent : colors.accent2Ramp[500],
              },
            ]}
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
