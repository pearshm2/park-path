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
 */

import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      // Dim the whole screen on Android, status and navigation bars too.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View
        style={[
          styles.overlay,
          placement === 'bottom' && [styles.overlayBottom, { paddingBottom: insets.bottom + space[4] }],
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Close" />
        <View style={styles.card} accessibilityViewIsModal>
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
        </View>
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
