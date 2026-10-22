/**
 * One park's stamp in the Passport grid, after the prototype: a round
 * rubber stamp with a double ring, tilted a few degrees, once the park is
 * visited; a dashed outline of one until then.
 *
 * React Native has no `double` border, so the inner ring is its own view
 * inset inside the outer one, as the prototype draws it too.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import type { Site } from '../../data/parks';
import { colors, radius } from '../../theme';
import { BodyText } from '../Typography';

type Props = {
  site: Site;
  /** The latest visit's date as a label ("Jun 2024"); null if not visited. */
  visited: string | null;
  size: number;
  onPress: () => void;
};

/** A steady tilt per park, -5 to 5 degrees, so the grid looks hand-stamped. */
function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return (h % 11) - 5;
}

export function Stamp({ site, visited, size, onPress }: Props) {
  const on = visited != null;
  const ink = on ? colors.accentRamp[700] : colors.neutral[400];
  const text = on ? colors.accentRamp[800] : colors.neutral[600];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        on ? `${site.name}, stamped ${visited}. Open the trip.` : `${site.name}, not stamped yet. See the park.`
      }
      style={({ pressed }) => [
        styles.stamp,
        {
          width: size,
          height: size,
          borderColor: ink,
          borderStyle: on ? 'solid' : 'dashed',
          backgroundColor: on ? colors.accentRamp[200] : 'transparent',
          transform: [{ rotate: `${on ? tilt(site.id) : 0}deg` }],
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.inner, { borderColor: ink, borderStyle: on ? 'solid' : 'dashed' }]}
      />
      <BodyText
        size={9.5}
        weight="bold"
        color={text}
        lineHeightRatio={1.12}
        numberOfLines={3}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={styles.name}
      >
        {site.name}
      </BodyText>
      <View style={[styles.rule, { backgroundColor: text }]} />
      <BodyText size={8.5} weight="medium" color={text} lineHeightRatio={1.2} style={styles.note}>
        {visited ?? site.state}
      </BodyText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stamp: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 3,
  },
  pressed: {
    opacity: 0.7,
  },
  inner: {
    position: 'absolute',
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    opacity: 0.55,
  },
  name: {
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rule: {
    width: 26,
    height: 1,
    opacity: 0.5,
  },
  note: {
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    opacity: 0.8,
  },
});
