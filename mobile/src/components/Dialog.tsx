/**
 * A dialog in the app's own style, for choices and confirmations that the
 * phone's system alert would otherwise show in its plain grey box: a card
 * over a dimmed screen, with a heading, a message, and its actions as
 * full-width buttons, stacked.
 *
 * A `danger` action (a delete) is filled in the deep accent; `cancel` is
 * outlined; the rest are plain. Tapping outside the card or the back
 * button counts as cancel.
 *
 * `placement="bottom"` sits it low on the screen, for choices about
 * something the person should still see above it.
 *
 * It opens with its own quick fade and rise rather than the popup's
 * built-in fade, which on Android is slow and shows what's behind through
 * the card as it goes. Android first lays the popup out a little short of
 * the screen, then stretches it under the navigation bar; so the card
 * stays hidden until the popup is full height (or 250 ms have passed), and
 * never shows in one place and then jumps to another.
 */

import { useEffect, type ReactNode } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { colors, fonts, radius, shadow, space } from '../theme';
import { BodyText, Heading } from './Typography';

export type DialogAction = {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger' | 'cancel';
};

export function Dialog({
  visible,
  title,
  message,
  icon,
  actions,
  onDismiss,
  placement = 'center',
}: {
  visible: boolean;
  title: string;
  message?: string;
  /** Shown above the title, e.g. a warning sign. */
  icon?: ReactNode;
  actions: DialogAction[];
  /** Tapping outside the card, or the back button. */
  onDismiss: () => void;
  placement?: 'center' | 'bottom';
}) {
  // The screen's own insets, fixed: inside the popup the live ones arrive a
  // moment late and move the card after it's shown.
  const bottomInset = initialWindowMetrics?.insets.bottom ?? 0;

  // 0 hidden, 1 shown. Starts once the popup is full height.
  const shown = useSharedValue(0);
  function reveal() {
    if (shown.value > 0) return;
    shown.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  }
  useEffect(() => {
    if (!visible) {
      shown.value = 0;
      return;
    }
    // Should the popup never quite reach the screen's height, show anyway.
    const fallback = setTimeout(reveal, 250);
    return () => clearTimeout(fallback);
    // reveal only reads the shared value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, shown]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const cardStyle = useAnimatedStyle(() => ({
    // Solid early, so what's behind doesn't show through it for long.
    opacity: Math.min(1, shown.value * 3),
    transform: [{ translateY: (1 - shown.value) * (placement === 'bottom' ? 28 : 12) }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      // Our own animation instead (see above).
      animationType="none"
      hardwareAccelerated
      onRequestClose={onDismiss}
      // Dim the whole screen on Android, status and navigation bars too.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View
        onLayout={(event) => {
          if (event.nativeEvent.layout.height >= Dimensions.get('screen').height - 2) reveal();
        }}
        style={[
          styles.overlay,
          placement === 'bottom' && [styles.overlayBottom, { paddingBottom: bottomInset + space[4] }],
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Close" />
        <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Heading size={21} style={styles.title}>
            {title}
          </Heading>
          {message ? (
            <BodyText size={14} lineHeightRatio={1.5} color={colors.neutral[700]} style={styles.message}>
              {message}
            </BodyText>
          ) : null}
          <View style={styles.actions}>
            {actions.map((action) => {
              const tone = action.tone ?? 'default';
              return (
                <Pressable
                  key={action.label}
                  onPress={action.onPress}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.action, toneStyles[tone], pressed && pressedStyles[tone]]}
                >
                  <BodyText
                    size={14}
                    weight="semibold"
                    color={tone === 'danger' ? colors.neutral[100] : tone === 'cancel' ? colors.text : colors.accentRamp[700]}
                    style={styles.actionLabel}
                  >
                    {action.label}
                  </BodyText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[6],
  },
  backdrop: {
    backgroundColor: 'rgba(32, 30, 29, 0.42)',
  },
  overlayBottom: {
    justifyContent: 'flex-end',
    paddingHorizontal: space[3],
  },
  card: {
    alignSelf: 'stretch',
    maxWidth: 420,
    padding: space[6],
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    ...shadow.lg,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: space[3],
  },
  title: {
    textAlign: 'center',
  },
  message: {
    marginTop: space[2],
    textAlign: 'center',
  },
  actions: {
    gap: space[2],
    marginTop: space[6],
  },
  action: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  actionLabel: {
    fontFamily: fonts.heading,
  },
});

const toneStyles = StyleSheet.create({
  default: { backgroundColor: colors.accentRamp[100] },
  danger: { backgroundColor: colors.accentRamp[700] },
  cancel: { borderWidth: 1.5, borderColor: colors.neutral[400] },
});

const pressedStyles = StyleSheet.create({
  default: { backgroundColor: colors.accentRamp[200] },
  danger: { backgroundColor: colors.accentRamp[800] },
  cancel: { backgroundColor: colors.tintText07 },
});
