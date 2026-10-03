/**
 * Placeholder for the tabs the prototype designs but this week does not
 * build (Trips, Passport, Friends).
 *
 * It says plainly what the tab will be and what it is waiting on, rather
 * than faking content — a demo reads better when the unfinished parts
 * are obviously unfinished instead of looking broken.
 */

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, space } from '../theme';
import { BodyText, Heading, Kicker } from './Typography';

export function ComingSoon({
  title,
  kicker,
  description,
  blockedOn,
}: {
  title: string;
  kicker: string;
  description: string;
  /** What has to exist before this tab can be built. */
  blockedOn?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[6] }]}>
      <Kicker>{kicker}</Kicker>
      <Heading size={26} style={styles.title}>
        {title}
      </Heading>

      <View style={styles.card}>
        <BodyText size={13.5} lineHeightRatio={1.5} color={colors.neutral[700]}>
          {description}
        </BodyText>
        {blockedOn ? (
          <BodyText size={12} weight="medium" color={colors.accentRamp[700]} style={styles.blocked}>
            {blockedOn}
          </BodyText>
        ) : null}
      </View>

      {/* Soft circular accent, keeping the empty state in the system's
          visual language rather than leaving a bare screen. */}
      <View pointerEvents="none" style={styles.blob} />
    </View>
  );
}

const BLOB = 260;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space[4],
  },
  title: {
    marginTop: space[1],
    marginBottom: space[4],
  },
  card: {
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
    gap: space[2],
    ...shadow.sm,
  },
  blocked: {
    marginTop: space[1],
  },
  blob: {
    position: 'absolute',
    bottom: -BLOB * 0.45,
    left: -BLOB * 0.3,
    width: BLOB,
    height: BLOB,
    borderRadius: BLOB / 2,
    backgroundColor: colors.accent2Ramp[200],
    zIndex: -1,
  },
});
