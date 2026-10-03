/**
 * The design system's `.tag` in its four tints. Each pairs a 100-step
 * fill with an 800-step label from the same ramp, which is what keeps
 * them legible on the warm ground.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '../theme';

type TagTone = 'accent' | 'accent2' | 'neutral' | 'outline';

export function Tag({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: TagTone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.base, toneContainer[tone], style]}>
      <Text style={[styles.label, toneLabel[tone]]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    // The "rounded frame" layer sends tags to a full pill.
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 11 * 1.45,
    letterSpacing: 11 * 0.02,
  },
});

const toneContainer = StyleSheet.create({
  accent: { backgroundColor: colors.accentRamp[100] },
  accent2: { backgroundColor: colors.accent2Ramp[100] },
  neutral: { backgroundColor: colors.neutral[100] },
  outline: { borderColor: colors.accent },
});

const toneLabel = StyleSheet.create({
  accent: { color: colors.accentRamp[800] },
  accent2: { color: colors.accent2Ramp[800] },
  neutral: { color: colors.neutral[800] },
  outline: { color: colors.accent },
});
