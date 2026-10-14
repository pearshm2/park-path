/**
 * A person's initials in a coloured circle, picked by their id so each
 * person keeps the same colour everywhere (Friends, Trips, the header).
 * Profiles are only an email for now, so the initials come from it.
 */

import { StyleSheet, View } from 'react-native';

import { initials } from '../api/friends';
import { colors, radius } from '../theme';
import { BodyText } from './Typography';

const TONES = [
  { bg: colors.accentRamp[200], fg: colors.accentRamp[800], ring: colors.accentRamp[400] },
  { bg: colors.accent2Ramp[200], fg: colors.accent2Ramp[800], ring: colors.accent2Ramp[400] },
  { bg: '#d9e6f2', fg: '#2f4a63', ring: '#9fbad3' },
  { bg: '#efe2c2', fg: '#6b5320', ring: '#d3b979' },
  { bg: colors.neutral[300], fg: colors.neutral[800], ring: colors.neutral[500] },
];

export function avatarTone(personId: number) {
  return TONES[Math.abs(personId) % TONES.length];
}

export function Avatar({
  person,
  size,
  ring = false,
}: {
  person: { id: number; email: string };
  size: number;
  /** A coloured ring round it, as in the Friends row. */
  ring?: boolean;
}) {
  const tone = avatarTone(person.id);
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          backgroundColor: tone.bg,
          borderColor: ring ? tone.ring : 'transparent',
          borderWidth: ring ? 2.75 : 0,
        },
      ]}
    >
      <BodyText size={Math.round(size * 0.32)} weight="bold" color={tone.fg}>
        {initials(person.email)}
      </BodyText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
});
