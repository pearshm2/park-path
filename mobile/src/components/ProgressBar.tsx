/**
 * The quiz's progress bar: a 5px pill track in neutral-300 with an
 * accent fill, matching the prototype's quiz header.
 *
 * The fill animates over 350ms, as the prototype's
 * `transition: width .35s ease` does.
 */

import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors, radius } from '../theme';

export function ProgressBar({ progress }: { progress: number }) {
  const clamped = Math.min(1, Math.max(0, progress));
  // Lazy useState rather than a ref: the Animated.Value must be created
  // once and survive re-renders, but reading a ref during render is not
  // allowed. Not driven on the native thread either, because animating
  // `width` as a percentage is a layout property.
  const [width] = useState(() => new Animated.Value(clamped));

  useEffect(() => {
    Animated.timing(width, {
      toValue: clamped,
      duration: 350,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [clamped, width]);

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            width: width.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[300],
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
