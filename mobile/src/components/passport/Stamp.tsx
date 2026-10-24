/**
 * One park's stamp in the Passport grid. Once the park is visited it's a
 * dark red wax seal (WaxSeal.tsx), set down a few degrees off straight.
 * Until then it's a faint dashed outline where the seal will go, with a
 * pale preview of its drawing (ParkArt.tsx), the park and its state.
 *
 * `pressIn` plays a stamp just earned going down: its seal lifts into view
 * over the outline, drops, squashes with a thud, and settles.
 *
 * React Native has no `double` border, so the unstamped outline's inner
 * ring is its own view inset inside the outer one.
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { playSound, tap } from '../../lib/sounds';

import type { Site } from '../../data/parks';
import { colors, radius } from '../../theme';
import { BodyText } from '../Typography';
import { ParkArt } from './ParkArt';
import { WaxSeal } from './WaxSeal';

type Props = {
  site: Site;
  /** The latest visit's date as a label ("Jun 2024"); null if not visited. */
  visited: string | null;
  size: number;
  onPress: () => void;
  /** A stamp just earned: play it going down. */
  pressIn?: boolean;
  /** When it hits (its stamp then counts as shown). */
  onPressedIn?: () => void;
};

/** How long the seal's press takes, when it hits (0 to 1), and how long it waits first. */
const PRESS_MS = 700;
const HIT = 0.5;
const PRESS_DELAY_MS = 650;

/** A steady tilt per park, -5 to 5 degrees, so the grid looks hand-stamped. */
function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return (h % 11) - 5;
}

export function Stamp({ site, visited, size, onPress, pressIn = false, onPressedIn }: Props) {
  const on = visited != null;
  const press = useSharedValue(pressIn ? 0 : 1);
  useEffect(() => {
    if (!pressIn) return;
    press.value = 0;
    press.value = withDelay(PRESS_DELAY_MS, withTiming(1, { duration: PRESS_MS, easing: Easing.linear }));
    const hit = setTimeout(() => {
      playSound('stamp');
      tap('medium');
      onPressedIn?.();
    }, PRESS_DELAY_MS + PRESS_MS * HIT);
    return () => clearTimeout(hit);
    // Once, as it's asked for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressIn]);
  const sealStyle = useAnimatedStyle(() => {
    const p = press.value;
    return {
      opacity: interpolate(p, [0, 0.15], [0, 1], 'clamp'),
      transform: [
        { translateY: interpolate(p, [0, 0.3, HIT], [-size * 0.3, -size * 0.4, 0], 'clamp') },
        { scale: interpolate(p, [0, 0.3, HIT], [1.2, 1.32, 1], 'clamp') },
        { scaleX: interpolate(p, [HIT, HIT + 0.08, HIT + 0.22, 1], [1, 1.1, 0.98, 1], 'clamp') },
        { scaleY: interpolate(p, [HIT, HIT + 0.08, HIT + 0.22, 1], [1, 0.87, 1.03, 1], 'clamp') },
      ],
    };
  });
  // The outline it lands on fades as the seal covers it.
  const outlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(press.value, [HIT - 0.05, HIT + 0.05], [1, 0], 'clamp'),
  }));

  if (pressIn && on) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${site.name}, just stamped ${visited}. Open the trip.`}
        style={{ width: size, height: size }}
      >
        <Animated.View style={[StyleSheet.absoluteFill, outlineStyle]}>
          <Unstamped site={site} size={size} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${tilt(site.id)}deg` }] }]}>
          <Animated.View style={sealStyle}>
            <WaxSeal code={site.id} group={site.group} name={site.name} date={visited} size={size} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    );
  }
  const label = on
    ? `${site.name}, stamped ${visited}. Open the trip.`
    : `${site.name}, not stamped yet. See the park.`;

  if (on) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          { width: size, height: size, transform: [{ rotate: `${tilt(site.id)}deg` }] },
          pressed && styles.pressed,
        ]}
      >
        <WaxSeal code={site.id} group={site.group} name={site.name} date={visited} size={size} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Unstamped site={site} size={size} />
    </Pressable>
  );
}

/** Not stamped yet: a faint dashed outline, with a preview of its picture. */
function Unstamped({ site, size }: { site: Site; size: number }) {
  const ink = colors.neutral[400];
  const text = colors.neutral[600];
  return (
    <View
      style={[
        styles.stamp,
        styles.outline,
        // Padding keeps the words inside the inner ring.
        { width: size, height: size, paddingHorizontal: Math.round(size * 0.15) },
      ]}
    >
      <View pointerEvents="none" style={[styles.inner, { borderColor: ink }]} />
      <ParkArt code={site.id} group={site.group} size={Math.round(size * 0.38)} color={ink} strokeWidth={1.8} />
      <BodyText
        size={9.5}
        weight="bold"
        color={text}
        lineHeightRatio={1.12}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={styles.name}
      >
        {site.name}
      </BodyText>
      <View style={[styles.rule, { backgroundColor: text }]} />
      <BodyText size={8.5} weight="medium" color={text} lineHeightRatio={1.2} style={styles.note}>
        {site.state}
      </BodyText>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.pill,
  },
  // Not stamped yet: a dashed outline of one.
  outline: {
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.neutral[400],
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
    borderStyle: 'dashed',
    opacity: 0.55,
  },
  // Both full width: Android measures short spaced-out capitals a little
  // narrow and clips the last letter ("TX" drawn as "T").
  name: {
    alignSelf: 'stretch',
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
    alignSelf: 'stretch',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    opacity: 0.8,
  },
});
