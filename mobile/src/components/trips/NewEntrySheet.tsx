/**
 * The prototype's "New journal entry" sheet: the park visited (searched
 * from every site, national parks first), the month, a title, notes, who
 * was with you (your friends) and photos from your library.
 *
 * Saving logs the visit: the park becomes visited across the app.
 *
 * Mounted only while open, so each opening starts with a fresh draft.
 */

import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { displayName } from '../../api/friends';
import { listSites } from '../../api/parks';
import { useFriends } from '../../friends/useFriends';
import { colors, radius, shadow, space } from '../../theme';
import { monthLabel, useTrips, type TripEntry } from '../../trips/TripsContext';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { BodyText, Heading } from '../Typography';

const MAX_PHOTOS = 8;

/** This month, as YYYY-MM-01. */
function thisMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/** A YYYY-MM-01 date moved by `by` months. */
function shiftMonth(date: string, by: number): string {
  const [year, month] = date.split('-').map(Number);
  const moved = new Date(year, month - 1 + by, 1);
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}-01`;
}

export function NewEntrySheet({
  initialSiteId,
  onClose,
  onSaved,
}: {
  /** Opened from a park's card: start with that park chosen. */
  initialSiteId?: string;
  onClose: () => void;
  onSaved: (entry: TripEntry) => void;
}) {
  const insets = useSafeAreaInsets();
  const { add } = useTrips();
  const { friends } = useFriends();
  const { data: sites = [] } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => listSites('all'),
  });

  const [siteId, setSiteId] = useState<string | null>(initialSiteId ?? null);
  // What's typed in the park field; until something is typed it shows the
  // chosen park's name.
  const [query, setQuery] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [month, setMonth] = useState(thisMonth);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [withIds, setWithIds] = useState<number[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chosen = sites.find((s) => s.id === siteId);
  const shownQuery = query ?? chosen?.name ?? '';
  const results = useMemo(() => {
    const needle = (query ?? '').trim().toLowerCase();
    return sites
      .filter((s) => !needle || s.name.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.isNamedPark) - Number(a.isNamedPark) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [sites, query]);

  async function pickPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.85,
    });
    if (result.canceled) return;
    setPhotos((current) =>
      [...current, ...result.assets.map((asset) => asset.uri)].slice(0, MAX_PHOTOS),
    );
  }

  async function save() {
    if (!chosen) {
      setProblem('Pick the park you visited.');
      return;
    }
    if (!title.trim()) {
      setProblem('Give the entry a title.');
      return;
    }
    setSaving(true);
    try {
      const entry = await add({
        siteId: chosen.id,
        date: month,
        title: title.trim(),
        notes: notes.trim(),
        photos,
        with: friends.filter((f) => withIds.includes(f.user.id)).map((f) => f.user),
      });
      onSaved(entry);
    } catch {
      setProblem("Couldn't save the entry. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const latest = thisMonth();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView
            contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + space[4] }]}
            keyboardShouldPersistTaps="handled"
          >
            <Heading size={21}>New journal entry</Heading>

            <Label>Park visited</Label>
            <TextField
              label="Park"
              hideLabel
              value={shownQuery}
              onChangeText={(text) => {
                setQuery(text);
                setSiteId(null);
                setListOpen(true);
                setProblem(null);
              }}
              onFocus={() => setListOpen(true)}
              placeholder="Search parks"
              autoCorrect={false}
            />
            {listOpen && !chosen ? (
              <View style={styles.results}>
                {results.map((site) => (
                  <Pressable
                    key={site.id}
                    onPress={() => {
                      setSiteId(site.id);
                      setQuery(null);
                      setListOpen(false);
                    }}
                    style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}
                  >
                    <BodyText size={13} weight="semibold" style={styles.resultName} numberOfLines={1}>
                      {site.name}
                    </BodyText>
                    <BodyText size={11} color={colors.neutral[600]} numberOfLines={1}>
                      {`${site.kind} · ${site.state}`}
                    </BodyText>
                  </Pressable>
                ))}
                {results.length === 0 ? (
                  <BodyText size={12} color={colors.neutral[600]} style={styles.noResults}>
                    No park matches that.
                  </BodyText>
                ) : null}
              </View>
            ) : null}

            <Label>When</Label>
            <View style={styles.month}>
              <StepButton direction="back" onPress={() => setMonth((m) => shiftMonth(m, -1))} />
              <BodyText size={14} weight="semibold" style={styles.monthText}>
                {monthLabel(month)}
              </BodyText>
              <StepButton
                direction="forward"
                disabled={month >= latest}
                onPress={() => setMonth((m) => (m >= latest ? m : shiftMonth(m, 1)))}
              />
            </View>

            <Label>Title</Label>
            <TextField
              label="Title"
              hideLabel
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                setProblem(null);
              }}
              placeholder="Sky Pond, the long way"
            />

            <Label>Notes</Label>
            <TextField
              label="Notes"
              hideLabel
              value={notes}
              onChangeText={setNotes}
              placeholder="What the day was actually like"
              multiline
              style={styles.notes}
            />

            <Label>Who was with you</Label>
            {friends.length > 0 ? (
              <View style={styles.chips}>
                {friends.map((friend) => {
                  const on = withIds.includes(friend.user.id);
                  return (
                    <Pressable
                      key={friend.friendshipId}
                      onPress={() =>
                        setWithIds((ids) =>
                          on ? ids.filter((id) => id !== friend.user.id) : [...ids, friend.user.id],
                        )
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Avatar person={friend.user} size={24} />
                      <BodyText
                        size={12}
                        weight="semibold"
                        color={on ? colors.accentRamp[800] : colors.neutral[800]}
                      >
                        {displayName(friend.user.email).split(' ')[0]}
                      </BodyText>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <BodyText size={12} color={colors.neutral[600]}>
                Add friends in the Friends tab to tag them here.
              </BodyText>
            )}

            <Label>Photos</Label>
            <Pressable
              onPress={pickPhotos}
              disabled={photos.length >= MAX_PHOTOS}
              accessibilityRole="button"
              style={({ pressed }) => [styles.addPhotos, pressed && styles.addPhotosPressed]}
            >
              <PlusIcon />
              <BodyText size={13} weight="semibold" color={colors.accentRamp[800]} style={styles.addText}>
                {photos.length >= MAX_PHOTOS ? `Up to ${MAX_PHOTOS} photos` : 'Add photos'}
              </BodyText>
            </Pressable>
            {photos.length > 0 ? (
              <View style={styles.thumbs}>
                {photos.map((uri) => (
                  <View key={uri} style={styles.thumb}>
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <Pressable
                      onPress={() => setPhotos((list) => list.filter((u) => u !== uri))}
                      hitSlop={6}
                      accessibilityLabel="Remove photo"
                      style={styles.thumbRemove}
                    >
                      <BodyText size={11} weight="bold" color={colors.neutral[100]}>
                        ✕
                      </BodyText>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {problem ? (
              <BodyText size={12.5} weight="medium" color={colors.accentRamp[800]} style={styles.problem}>
                {problem}
              </BodyText>
            ) : null}

            <View style={styles.actions}>
              <Button label="Cancel" variant="secondary" onPress={onClose} />
              <Button label="Save entry" block onPress={save} loading={saving} style={styles.save} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Label({ children }: { children: string }) {
  return (
    <BodyText size={10.5} weight="semibold" color={colors.neutral[600]} style={styles.label}>
      {children.toUpperCase()}
    </BodyText>
  );
}

function StepButton({
  direction,
  disabled = false,
  onPress,
}: {
  direction: 'back' | 'forward';
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={direction === 'back' ? 'Earlier month' : 'Later month'}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed, disabled && styles.stepOff]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path
          d={direction === 'back' ? 'M14.5 5L8 12l6.5 7' : 'M9.5 5L16 12l-6.5 7'}
          fill="none"
          stroke={colors.neutral[700]}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

function PlusIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      <Path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke={colors.accentRamp[700]}
        strokeWidth={2.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 30, 29, 0.32)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.bg,
    ...shadow.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    marginTop: space[3],
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[400],
  },
  sheetContent: {
    paddingHorizontal: space[4],
    paddingTop: space[3],
  },
  label: {
    letterSpacing: 1.2,
    marginTop: space[4],
    marginBottom: space[2],
  },
  results: {
    marginTop: 6,
    padding: 5,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    ...shadow.md,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: radius.sm,
  },
  resultPressed: {
    backgroundColor: colors.accentRamp[200],
  },
  resultName: {
    flex: 1,
  },
  noResults: {
    padding: 11,
  },
  month: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  monthText: {
    minWidth: 90,
    textAlign: 'center',
  },
  step: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.neutral[400],
  },
  stepPressed: {
    backgroundColor: colors.neutral[200],
  },
  stepOff: {
    opacity: 0.35,
  },
  notes: {
    minHeight: 84,
    borderRadius: radius.md,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.neutral[400],
  },
  chipOn: {
    backgroundColor: colors.accentRamp[100],
    borderColor: colors.accent,
  },
  addPhotos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentRamp[400],
    backgroundColor: colors.accentRamp[100],
  },
  addPhotosPressed: {
    backgroundColor: colors.accentRamp[200],
  },
  addText: {
    flex: 1,
  },
  thumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: space[2],
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.neutral[200],
  },
  thumbRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(46, 43, 37, 0.7)',
  },
  problem: {
    marginTop: space[3],
  },
  actions: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[4],
  },
  save: {
    flex: 1,
  },
});
