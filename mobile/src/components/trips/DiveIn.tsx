/**
 * The background of Relive's first slide when it's dived into from a
 * memory bubble in Trips: a circle that starts as the bubble and grows
 * until it covers the screen.
 *
 * The circle is a window onto the slide's own background (the park's
 * photo, blurred and dimmed, fixed full screen), so once it's fully open
 * it simply is the background, with nothing swapped. Over it, the
 * bubble's own sharp photo grows with the circle and fades out.
 *
 * Relive drives `progress` (0 to 1) and moves the slide's words in step;
 * see app/relive.tsx.
 */

import { Image } from 'expo-image';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/** Where the bubble was on screen: its top-left corner and size. */
export type DiveRect = { x: number; y: number; size: number };

export const DIVE_MS = 520;

/** "x,y,size", as passed between screens. */
export function diveParam(rect: DiveRect): string {
  return `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.size)}`;
}

export function parseDive(param: string | undefined): DiveRect | null {
  if (!param) return null;
  const [x, y, size] = param.split(',').map(Number);
  return [x, y, size].every(Number.isFinite) && size > 0 ? { x, y, size } : null;
}

export function DiveBackground({
  rect,
  progress,
  photo,
  background,
  blur,
  dim,
  fallback,
}: {
  rect: DiveRect;
  progress: SharedValue<number>;
  /** What the bubble showed. */
  photo: string | null;
  /** The slide's background photo, shown blurred. */
  background: string | null;
  blur: number;
  /** The slide's dimming, 0 to 1. */
  dim: number;
  fallback: string;
}) {
  // The whole screen, not the app's window: on Android the window stops
  // short of the navigation bar.
  const { width, height } = Dimensions.get('screen');
  const cx = rect.x + rect.size / 2;
  const cy = rect.y + rect.size / 2;
  const reach = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(width - cx, cy),
    Math.hypot(cx, height - cy),
    Math.hypot(width - cx, height - cy),
  );
  // A little past the corners, so no edge is left showing.
  const end = reach * 2 * 1.04;

  const windowStyle = useAnimatedStyle(() => {
    const d = interpolate(progress.value, [0, 1], [rect.size, end]);
    return { left: cx - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: d / 2 };
  });
  // The background holds still while the window over it grows.
  const fixedStyle = useAnimatedStyle(() => {
    const d = interpolate(progress.value, [0, 1], [rect.size, end]);
    return { left: d / 2 - cx, top: d / 2 - cy };
  });
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.1, 0.75], [1, 0], 'clamp'),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, end / rect.size]) }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.window, windowStyle]}>
        <Animated.View style={[styles.fixed, { width, height, backgroundColor: fallback }, fixedStyle]}>
          {background ? (
            <Image source={{ uri: background }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={blur} />
          ) : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(20, 17, 15, ${dim})` }]} />
        </Animated.View>
      </Animated.View>
      {photo ? (
        <Animated.View
          style={[
            styles.bubble,
            { left: rect.x, top: rect.y, width: rect.size, height: rect.size, borderRadius: rect.size / 2 },
            bubbleStyle,
          ]}
        >
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  window: {
    position: 'absolute',
    overflow: 'hidden',
  },
  fixed: {
    position: 'absolute',
  },
  bubble: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
