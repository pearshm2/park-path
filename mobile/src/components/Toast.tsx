/**
 * The prototype's transient "flash" message — used by the quiz when you
 * try to continue without answering.
 *
 * Renders at the top of its container on the dark neutral step, fading
 * in over 180ms like the prototype's `pp-fade` keyframe.
 */

import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, scaleType, shadow, space, useTextScale } from '../theme';

/**
 * A Toast floating over a whole screen, centred a little below the status
 * bar (where Trips shows its own), for screens whose content scrolls or
 * fills the screen. Touches pass straight through it.
 */
export function ToastOverlay({ message }: { message: string | null }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.overlay, { top: insets.top + 64 }]} pointerEvents="none">
      <Toast message={message} />
    </View>
  );
}

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
  const scale = useTextScale();
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityElementsHidden={!message}
      importantForAccessibility={message ? 'yes' : 'no-hide-descendants'}
      style={[styles.container, { opacity }]}
    >
      <Text style={[styles.text, scaleType(styles.text, scale)]}>{message ?? ''}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  container: {
    alignSelf: 'center',
    maxWidth: '92%',
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    get backgroundColor() {
      return colors.neutral[900];
    },
    ...shadow.md,
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 13 * 1.4,
    textAlign: 'center',
    get color() {
      return colors.bg;
    },
  },
});
