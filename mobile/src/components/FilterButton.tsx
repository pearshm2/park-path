/**
 * Opens the Explore filter sheet.
 *
 * Carries a count when filters are on, so the feed never looks mystifying
 * short without an obvious reason — the prototype solves the same problem
 * by tinting its filter control when active.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, MIN_TAP_TARGET, radius, space } from '../theme';
import { BodyText } from './Typography';

export function FilterButton({
  count,
  onPress,
  disabled = false,
}: {
  /** Number of active filters; 0 renders the resting state. */
  count: number;
  onPress: () => void;
  /** Greyed out and inert, for views the filters do not apply to. */
  disabled?: boolean;
}) {
  const active = count > 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={active ? `Filters, ${count} active` : 'Filters'}
      style={({ pressed }) => [
        styles.button,
        active ? styles.active : styles.resting,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 6h16M7 12h10M10 18h4"
          stroke={active ? colors.bg : colors.neutral[800]}
          strokeWidth={2.75}
          strokeLinecap="round"
        />
      </Svg>
      <BodyText size={12.5} weight="semibold" color={active ? colors.bg : colors.neutral[800]}>
        Filter
      </BodyText>
      {active ? (
        <View style={styles.badge}>
          <BodyText size={10} weight="bold" color={colors.accent}>
            {String(count)}
          </BodyText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: MIN_TAP_TARGET,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  resting: {
    backgroundColor: colors.neutral[100],
    borderColor: colors.divider,
  },
  active: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.4,
  },
  badge: {
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
});
