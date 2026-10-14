/**
 * A quick action on a park's page — Directions, Park map, Save: an icon
 * over a short label, sharing a row equally with the others.
 */

import { type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radius, space } from '../theme';
import { BodyText } from './Typography';

export function QuickAction({
  label,
  accessibilityLabel,
  icon,
  selected = false,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  icon: ReactNode;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.action,
        selected && styles.actionOn,
        pressed && styles.actionPressed,
      ]}
    >
      {icon}
      <BodyText
        size={12}
        weight="semibold"
        color={selected ? colors.accent2Ramp[800] : colors.neutral[800]}
        numberOfLines={1}
      >
        {label}
      </BodyText>
    </Pressable>
  );
}

const ICON_INK = colors.neutral[800];

/** A turn arrow in a diamond, the usual road-sign shorthand for directions. */
export function DirectionsIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M12 2.8l9.2 9.2-9.2 9.2L2.8 12z"
        fill="none"
        stroke={ICON_INK}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M9 15v-3a1.5 1.5 0 0 1 1.5-1.5H15M13 8.5l2 2-2 2"
        fill="none"
        stroke={ICON_INK}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A folded map. */
export function MapIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5zM9 4v13.5M15 6.5V20"
        fill="none"
        stroke={ICON_INK}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: space[2],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[200],
  },
  actionOn: {
    backgroundColor: colors.accent2Ramp[100],
  },
  actionPressed: {
    backgroundColor: colors.neutral[300],
  },
});
