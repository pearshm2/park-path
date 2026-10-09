/**
 * A selectable answer row for the quiz, matching the prototype's option
 * buttons: a 22px ring on the left, a 15px label, and a 12.5px
 * supporting line underneath.
 *
 * Colors come straight from the prototype's binding logic — selected
 * rows take an accent-100 fill with an accent border and a filled dot;
 * unselected rows sit on neutral-100 with a transparent border and a
 * neutral-400 ring.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, scaleType, shadow, space, useTextScale } from '../theme';

export function ChoiceRow({
  label,
  sub,
  selected,
  onPress,
  /** Multi-select rows announce as checkboxes, single-select as radios. */
  multi = false,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  const scale = useTextScale();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.rowSelected : styles.rowIdle,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.dot, selected ? styles.dotSelected : styles.dotIdle]} />
      <View style={styles.text}>
        <Text style={[styles.label, scaleType(styles.label, scale)]}>{label}</Text>
        {sub ? <Text style={[styles.sub, scaleType(styles.sub, scale)]}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: 15,
    paddingHorizontal: 17,
    borderRadius: radius.md,
    borderWidth: 1.5,
    ...shadow.sm,
  },
  rowIdle: {
    backgroundColor: colors.neutral[100],
    borderColor: 'transparent',
  },
  rowSelected: {
    backgroundColor: colors.accentRamp[100],
    borderColor: colors.accent,
  },
  rowPressed: {
    // No pressed colour is specified for these rows, so this uses the
    // system's generic tint rather than inventing a new one.
    backgroundColor: colors.accentRamp[200],
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    // 2.75px matches the icon stroke weight the design system uses
    // throughout, which is what makes these rings feel of a piece.
    borderWidth: 2.75,
  },
  dotIdle: {
    borderColor: colors.neutral[400],
    backgroundColor: 'transparent',
  },
  dotSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  text: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
    color: colors.text,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 12.5 * 1.35,
    marginTop: 2,
    color: colors.neutral[600],
  },
});
