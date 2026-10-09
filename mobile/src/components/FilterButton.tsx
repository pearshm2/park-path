/**
 * Opens the Explore filter sheet.
 *
 * Carries a count when filters are on, so the feed never looks mystifying
 * short without an obvious reason — the prototype solves the same problem
 * by tinting its filter control when active.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radius } from '../theme';
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
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 6h16M7 12h10M10 18h4"
          stroke={active ? colors.bg : colors.accentRamp[700]}
          strokeWidth={2.75}
          strokeLinecap="round"
        />
      </Svg>
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
  // A round icon button, matching search and the map scope beside it.
  button: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  resting: {
    backgroundColor: colors.accentRamp[100],
    borderColor: colors.accent,
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
  // The active count, as a bubble on the button's corner.
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.bg,
  },
});
