/**
 * The prototype's transient "flash" message — used by the quiz when you
 * try to continue without answering.
 *
 * Renders at the top of its container on the dark neutral step, fading
 * in over 180ms like the prototype's `pp-fade` keyframe.
 */

import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, shadow, space } from '../theme';

export function Toast({ message }: { message: string | null }) {
  // Created once via a lazy initialiser; reading a ref during render
  // is not allowed, and this value must outlive each render.
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: message ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [message, opacity]);

  // Kept mounted while fading out so the exit animation can play, but
  // taken out of the a11y tree and hit-testing when there is no message.
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityElementsHidden={!message}
      importantForAccessibility={message ? 'yes' : 'no-hide-descendants'}
      style={[styles.container, { opacity }]}
    >
      <Text style={styles.text}>{message ?? ''}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    maxWidth: '92%',
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[900],
    ...shadow.md,
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 13 * 1.4,
    textAlign: 'center',
    color: colors.bg,
  },
});
