/**
 * A trip's passport-book stamp, shown like a page of the book: the photo
 * of the official stamp pasted onto a cream page, slightly askew, with a
 * strip of tape, and the park and date written under it.
 *
 * `PassportPage` is the page itself (Relive's souvenir slide uses it);
 * `PassportStampViewer` shows it full screen over Trips.
 */

import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radius, shadow, space } from '../../theme';
import { dateLabel } from '../../trips/TripsContext';
import { BodyText, Heading } from '../Typography';

/** The passport book's paper, and its ruled lines. */
const PAPER = '#f4ecdb';
const RULE = 'rgba(122, 44, 38, 0.12)';

export function PassportPage({
  uri,
  park,
  date,
  width,
}: {
  uri: string;
  park: string;
  date: string;
  width: number;
}) {
  const photo = Math.round(width * 0.78);
  return (
    <View style={[styles.page, { width }]}>
      {/* Faint ruled lines, like the book's pages. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 14 }, (_, i) => (
          <View key={i} style={[styles.rule, { top: 28 + i * 34 }]} />
        ))}
      </View>
      <BodyText size={11} weight="bold" color={colors.accentRamp[800]} style={styles.kicker}>
        PASSPORT TO YOUR NATIONAL PARKS
      </BodyText>
      <View style={[styles.pasted, { width: photo, height: photo }]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        <View style={[styles.tape, styles.tapeLeft]} />
        <View style={[styles.tape, styles.tapeRight]} />
      </View>
      <Heading size={22} style={styles.park}>
        {park}
      </Heading>
      <BodyText size={13} weight="semibold" color={colors.neutral[700]}>
        {`Stamped in person · ${dateLabel(date)}`}
      </BodyText>
    </View>
  );
}

export function PassportStampViewer({
  uri,
  park,
  date,
  onClose,
}: {
  uri: string;
  park: string;
  date: string;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable onPress={() => {}} accessible={false}>
          <PassportPage uri={uri} park={park} date={date} width={Math.min(width - space[6] * 2, 420)} />
        </Pressable>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M6 6l12 12M18 6L6 18" stroke={colors.neutral[100]} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** The little tag on a memory bubble that has a passport stamp. */
export function PassportTag({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Stamped in person. See your passport stamp"
      style={({ pressed }) => [styles.tag, pressed && styles.tagPressed]}
    >
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Path d="M6 3h10a2 2 0 012 2v16l-7-3-7 3V5a2 2 0 012-2z" fill="none" stroke="#7a2c26" strokeWidth={2.4} strokeLinejoin="round" />
      </Svg>
      <BodyText size={11} weight="bold" color="#7a2c26">
        Stamped in person
      </BodyText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 17, 15, 0.75)',
  },
  close: {
    position: 'absolute',
    top: 56,
    right: space[4],
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20, 17, 15, 0.5)',
  },
  page: {
    alignItems: 'center',
    gap: space[2],
    paddingTop: space[4],
    paddingBottom: space[6],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    backgroundColor: PAPER,
    overflow: 'hidden',
    ...shadow.lg,
  },
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: RULE,
  },
  kicker: {
    letterSpacing: 1.4,
  },
  pasted: {
    marginTop: space[3],
    marginBottom: space[3],
    backgroundColor: colors.neutral[200],
    borderWidth: 5,
    borderColor: '#fffaf0',
    transform: [{ rotate: '-2.5deg' }],
    ...shadow.md,
  },
  tape: {
    position: 'absolute',
    top: -12,
    width: 64,
    height: 22,
    backgroundColor: 'rgba(240, 226, 190, 0.85)',
  },
  tapeLeft: {
    left: -14,
    transform: [{ rotate: '-28deg' }],
  },
  tapeRight: {
    right: -14,
    transform: [{ rotate: '28deg' }],
  },
  park: {
    textAlign: 'center',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(249, 244, 237, 0.94)',
    ...shadow.sm,
  },
  tagPressed: {
    backgroundColor: colors.neutral[300],
  },
});
