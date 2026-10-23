/**
 * The prototype's "New journal entry" sheet: the park visited (searched
 * from every site, national parks first), the exact date, a title, notes, a
 * star rating, who can see it (only you, or your friends too), trails and spots you loved (any number: the park's own
 * trails as chips to toggle, plus any typed in), who was with you (your
 * friends), photos and videos, each with its own caption for Relive, and a
 * photo of the park's official stamp in your passport book (a souvenir of
 * being there in person).
 *
 * Saving logs the visit: the park becomes visited across the app.
 *
 * Given `editing`, it edits that entry instead: filled in with it, saved
 * back over it, and with no draft kept. So closing it with changes made
 * asks first whether to discard them.
 *
 * It opens at once: its own quick slide up instead of the popup's built-in
 * one (slow on Android), and the form's contents are only built once the
 * slide is done, so building them (the slow part) never holds the sheet up.
 *
 * What's typed is kept as a draft (trips/TripsContext.tsx) as you go, so
 * closing the sheet by accident (a tap outside it, the back button,
 * Cancel) doesn't lose it: it comes back next time, for a week. Saving
 * the entry or Start over clears it. A draft for one park isn't restored
 * when the sheet is opened for another.
 */

import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
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
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Path } from 'react-native-svg';

import { firstName } from '../../api/friends';
import { fetchParkMap } from '../../api/parkMaps';
import { listSites } from '../../api/parks';
import { useFriends } from '../../friends/useFriends';
import { colors, radius, shadow, space } from '../../theme';
import {
  dateLabel,
  useTrips,
  type EntryDraft,
  type TripEntry,
  type TripMedia,
} from '../../trips/TripsContext';
import type { Visibility } from '../../api/trips';
import { Avatar } from '../Avatar';
import { Calendar, toDay } from '../Calendar';
import { Dialog } from '../Dialog';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { BodyText, Heading } from '../Typography';

const MAX_MEDIA = 8;
/** How long the sheet waits before sliding up; see where it's used. */
const SLIDE_DELAY_MS = 150;
/** The longest video that can be added, in ms: a story-length clip. */
const MAX_VIDEO_MS = 60_000;

export function NewEntrySheet({
  initialSiteId,
  editing,
  onClose,
  onSaved,
}: {
  /** Opened from a park's card: start with that park chosen. */
  initialSiteId?: string;
  /** An entry to edit, rather than writing a new one. */
  editing?: TripEntry;
  onClose: () => void;
  onSaved: (entry: TripEntry) => void;
}) {
  const insets = useSafeAreaInsets();
  const { add, update, getDraft, setDraft } = useTrips();
  const { friends } = useFriends();
  const { data: sites = [] } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => listSites('all'),
  });

  // The draft left from last time, unless it's for a different park than
  // the one this was opened for.
  const [restored, setRestored] = useState(() => {
    if (editing) return null;
    const draft = getDraft();
    if (!draft) return null;
    if (initialSiteId && draft.siteId && draft.siteId !== initialSiteId) return null;
    return { ...draft, media: draft.media.filter((m) => mediaExists(m.uri)) };
  });
  const blank = blankDraft(initialSiteId);
  const start = editing ? fromEntry(editing) : (restored ?? blank);

  const [siteId, setSiteId] = useState<string | null>(start.siteId ?? initialSiteId ?? null);
  // What's typed in the park field; until something is typed it shows the
  // chosen park's name.
  const [query, setQuery] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [day, setDay] = useState(start.date);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [title, setTitle] = useState(start.title);
  const [notes, setNotes] = useState(start.notes);
  const [rating, setRating] = useState<number | null>(start.rating);
  const [trails, setTrails] = useState<string[]>(start.trails);
  /** A trail or spot being typed, not yet added. */
  const [trailText, setTrailText] = useState('');
  const [withIds, setWithIds] = useState<number[]>(start.withIds);
  const [media, setMedia] = useState<TripMedia[]>(start.media);
  const [visibility, setVisibility] = useState<Visibility>(start.visibility);
  const [passportStamp, setPassportStamp] = useState<string | null>(start.passportStamp);
  const [stampNote, setStampNote] = useState<string | null>(null);
  /** Why a picked video was left out (too long), until the next pick. */
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Keep the draft as it's typed: a moment after each change, and at once
  // if the sheet closes first. Nothing is written until something changes,
  // so opening and closing the sheet leaves an earlier draft alone.
  const fields = { siteId, date: day, title, notes, rating, trails, withIds, media, visibility, passportStamp };
  const fieldsJson = JSON.stringify(fields);
  const [openedWith] = useState(fieldsJson);
  const pending = useRef<EntryDraft | null | undefined>(undefined);

  function flushDraft() {
    if (pending.current === undefined) return;
    setDraft(pending.current);
    pending.current = undefined;
  }

  useEffect(() => {
    // Edits are saved or dropped; only new entries keep a draft.
    if (editing || fieldsJson === openedWith) return;
    const current = JSON.parse(fieldsJson) as Omit<EntryDraft, 'savedAt'>;
    pending.current = hasContent(current, blank) ? { ...current, savedAt: new Date().toISOString() } : null;
    const timer = setTimeout(flushDraft, 400);
    return () => clearTimeout(timer);
    // `blank` only differs by today's date, and flushDraft reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsJson, openedWith]);
  useEffect(() => flushDraft, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Closing an edit with changes made asks first; anything else just closes.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  function requestClose() {
    if (editing && fieldsJson !== openedWith) setConfirmDiscard(true);
    else onClose();
  }

  function startOver() {
    pending.current = undefined;
    setDraft(null);
    setRestored(null);
    setSiteId(blank.siteId);
    setQuery(null);
    setDay(blank.date);
    setTitle('');
    setNotes('');
    setRating(null);
    setTrails([]);
    setTrailText('');
    setWithIds([]);
    setMedia([]);
    setVisibility('private');
    setPassportStamp(null);
    setProblem(null);
  }

  const chosen = sites.find((s) => s.id === siteId);
  const shownQuery = query ?? chosen?.name ?? '';

  // The chosen park's trails, as suggestions. Same query as the park map
  // screen, so it's often already loaded.
  const { data: parkMap } = useQuery({
    queryKey: ['parkMap', chosen?.id],
    queryFn: () => fetchParkMap(chosen!.id),
    enabled: !!chosen?.isNamedPark,
    staleTime: Infinity,
  });
  const trailSuggestions = useMemo(() => {
    const needle = trailText.trim().toLowerCase();
    const names = parkMap?.trailNames ?? [];
    return (needle ? names.filter((n) => n.toLowerCase().includes(needle)) : names)
      .filter((n) => !trails.includes(n))
      .slice(0, 10);
  }, [parkMap, trailText, trails]);

  function toggleTrail(name: string) {
    setTrails((list) => (list.includes(name) ? list.filter((t) => t !== name) : [...list, name]));
  }

  /** Add what's typed as a trail or spot of its own. */
  function addTypedTrail() {
    const name = trailText.trim();
    if (name && !trails.some((t) => t.toLowerCase() === name.toLowerCase())) {
      setTrails((list) => [...list, name]);
    }
    setTrailText('');
  }
  // Only while the park list is open: sorting every site by name is slow
  // on Android, and doing it as the sheet opens held the sheet up.
  const searching = listOpen && !chosen;
  const results = useMemo(() => {
    if (!searching) return [];
    const needle = (query ?? '').trim().toLowerCase();
    return sites
      .filter((s) => !needle || s.name.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.isNamedPark) - Number(a.isNamedPark) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .slice(0, 8);
  }, [sites, query, searching]);

  async function pickMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - media.length,
      quality: 0.85,
    });
    if (result.canceled) return;
    // Videos over a minute are left out, with a note saying how to fit one in.
    const tooLong = result.assets.filter(
      (asset) => asset.type === 'video' && (asset.duration ?? 0) > MAX_VIDEO_MS,
    );
    setMediaNote(
      tooLong.length === 0
        ? null
        : tooLong.length === 1
          ? `That video is ${clock(tooLong[0].duration!)}. Clips up to 1 minute can be added. Trim it in your Photos app first.`
          : `${tooLong.length} videos are longer than 1 minute and weren't added. Trim them in your Photos app first.`,
    );
    const picked: TripMedia[] = result.assets.filter((asset) => !tooLong.includes(asset)).map((asset) => ({
      uri: asset.uri,
      kind: asset.type === 'video' ? 'video' : 'photo',
      caption: '',
      ...(asset.type === 'video' && asset.duration ? { duration: asset.duration } : {}),
    }));
    setMedia((current) => [...current, ...picked].slice(0, MAX_MEDIA));
  }

  /** A photo of the passport book's stamp, from the camera or the photos. */
  async function pickPassportStamp(from: 'camera' | 'library') {
    setStampNote(null);
    if (from === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setStampNote('ParkPath needs the camera to photograph your stamp. You can allow it in Settings.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, allowsEditing: true };
    const result =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) setPassportStamp(result.assets[0].uri);
  }

  function setCaption(uri: string, caption: string) {
    setMedia((list) => list.map((m) => (m.uri === uri ? { ...m, caption } : m)));
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
      const details = {
        siteId: chosen.id,
        date: day,
        title: title.trim(),
        notes: notes.trim(),
        media: media.map((m) => ({ ...m, caption: m.caption.trim() })),
        with: [
          ...friends.filter((f) => withIds.includes(f.user.id)).map((f) => f.user),
          // Someone tagged before who's no longer a friend stays tagged.
          ...(editing?.with ?? []).filter(
            (p) => withIds.includes(p.id) && !friends.some((f) => f.user.id === p.id),
          ),
        ],
        rating,
        visibility,
        passportStamp,
        // Something typed but not added yet still counts.
        trails: trailText.trim() && !trails.includes(trailText.trim()) ? [...trails, trailText.trim()] : trails,
      };
      const entry = editing ? await update(editing.id, details) : await add(details);
      if (!entry) throw new Error('Entry not found');
      if (!editing) {
        pending.current = undefined;
        setDraft(null);
      }
      onSaved(entry);
    } catch {
      setProblem("Couldn't save the entry. Try again.");
    } finally {
      setSaving(false);
    }
  }


  // The background dims at once, as a sign the tap landed. The sheet
  // slides up a moment later, once Android has the popup ready (its first
  // frames there stall, which made the slide jump), and the form inside
  // is built when the slide is done.
  const [bodyReady, setBodyReady] = useState(false);
  const dim = useSharedValue(0);
  const rise = useSharedValue(0);
  useEffect(() => {
    dim.value = withTiming(1, { duration: 160 });
    rise.value = withDelay(
      SLIDE_DELAY_MS,
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(setBodyReady, true);
      }),
    );
  }, [dim, rise]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    // Fully below the screen until it slides.
    transform: [{ translateY: (1 - rise.value) * 1200 }],
  }));

  return (
    <Modal
      visible
      transparent
      // Our own slide instead (see above).
      animationType="none"
      hardwareAccelerated
      onRequestClose={requestClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Close" />
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.grabber} />
          <ScrollView
            contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + space[4] }]}
            keyboardShouldPersistTaps="handled"
          >
            <Heading size={21}>{editing ? 'Edit memory' : 'New journal entry'}</Heading>
            {bodyReady ? (
              <>
              {restored ? (
                <View style={styles.restored}>
                  <BodyText size={12.5} color={colors.neutral[700]} style={styles.restoredText}>
                    {`Picked up your draft from ${dateLabel(toDay(new Date(restored.savedAt)))}.`}
                  </BodyText>
                  <Pressable onPress={startOver} hitSlop={8} accessibilityRole="button">
                    <BodyText size={12.5} weight="semibold" color={colors.accentRamp[700]}>
                      Start over
                    </BodyText>
                  </Pressable>
                </View>
              ) : null}

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
              {/* The app's own calendar, so it matches the rest of the app. */}
              <Pressable
                onPress={() => setCalendarOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityState={{ expanded: calendarOpen }}
                accessibilityLabel={`Date visited, ${dateLabel(day)}. ${calendarOpen ? 'Close calendar' : 'Change'}`}
                style={({ pressed }) => [
                  styles.date,
                  calendarOpen && styles.dateOpen,
                  pressed && styles.datePressed,
                ]}
              >
                <CalendarIcon />
                <BodyText size={14} weight="semibold" style={styles.dateText}>
                  {dateLabel(day)}
                </BodyText>
                <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
                  {calendarOpen ? 'Done' : 'Change'}
                </BodyText>
              </Pressable>
              {calendarOpen ? (
                <Calendar
                  value={day}
                  maxDate={toDay(new Date())}
                  onChange={(picked) => {
                    setDay(picked);
                    setCalendarOpen(false);
                  }}
                />
              ) : null}

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

              <Label>How was it?</Label>
              <View style={styles.stars} accessibilityRole="adjustable">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    // Tapping the current rating again clears it.
                    onPress={() => setRating((r) => (r === n ? null : n))}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
                    accessibilityState={{ selected: rating !== null && n <= rating }}
                  >
                    <StarIcon filled={rating !== null && n <= rating} />
                  </Pressable>
                ))}
                <BodyText size={12} color={colors.neutral[600]} style={styles.ratingText}>
                  {rating === null ? 'Optional' : RATING_WORDS[rating - 1]}
                </BodyText>
              </View>

              <Label>Trails &amp; spots</Label>
              <BodyText size={12} lineHeightRatio={1.45} color={colors.neutral[600]} style={styles.hint}>
                Every trail or spot you loved. They&apos;re stamped on your entry and show in your
                friends&apos; feed.
              </BodyText>
              {trails.length > 0 ? (
                <View style={[styles.chips, styles.chosenTrails]}>
                  {trails.map((name) => (
                    <Pressable
                      key={name}
                      onPress={() => toggleTrail(name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${name}`}
                      style={({ pressed }) => [styles.trailOn, pressed && styles.trailOnPressed]}
                    >
                      <PinIcon color={colors.neutral[100]} />
                      <BodyText size={12} weight="semibold" color={colors.neutral[100]} numberOfLines={1}>
                        {name}
                      </BodyText>
                      <BodyText size={11} weight="bold" color={colors.neutral[100]}>
                        ✕
                      </BodyText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={styles.trailInput}>
                <TextField
                  label="Add a trail or spot"
                  hideLabel
                  value={trailText}
                  onChangeText={setTrailText}
                  onSubmitEditing={addTypedTrail}
                  returnKeyType="done"
                  placeholder={chosen?.isNamedPark ? 'Search trails or type a spot' : 'Type a trail or spot'}
                  containerStyle={styles.trailField}
                />
                {trailText.trim() ? (
                  <Pressable
                    onPress={addTypedTrail}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${trailText.trim()}`}
                    style={({ pressed }) => [styles.trailAdd, pressed && styles.trailAddPressed]}
                  >
                    <BodyText size={13} weight="semibold" color={colors.neutral[100]}>
                      Add
                    </BodyText>
                  </Pressable>
                ) : null}
              </View>
              {trailSuggestions.length > 0 ? (
                <View style={[styles.chips, styles.suggestions]}>
                  {trailSuggestions.map((name) => (
                    <Pressable
                      key={name}
                      onPress={() => {
                        toggleTrail(name);
                        setTrailText('');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${name}`}
                      style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
                    >
                      <PinIcon />
                      <BodyText size={12} weight="semibold" color={colors.neutral[800]} numberOfLines={1}>
                        {name}
                      </BodyText>
                    </Pressable>
                  ))}
                </View>
              ) : null}

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
                          {firstName(friend.user)}
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

              <Label>Who can see it</Label>
              <View style={styles.visibility} accessibilityRole="radiogroup">
                {VISIBILITY.map((option) => {
                  const on = visibility === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setVisibility(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[styles.visibilityOption, on && styles.visibilityOn]}
                    >
                      <BodyText size={13} weight="semibold" color={on ? colors.neutral[100] : colors.neutral[800]}>
                        {option.label}
                      </BodyText>
                      <BodyText size={11} color={on ? colors.accentRamp[100] : colors.neutral[600]}>
                        {option.hint}
                      </BodyText>
                    </Pressable>
                  );
                })}
              </View>

              <Label>Photos &amp; videos</Label>
              <Pressable
                onPress={pickMedia}
                disabled={media.length >= MAX_MEDIA}
                accessibilityRole="button"
                style={({ pressed }) => [styles.addPhotos, pressed && styles.addPhotosPressed]}
              >
                <PlusIcon />
                <BodyText size={13} weight="semibold" color={colors.accentRamp[800]} style={styles.addText}>
                  {media.length >= MAX_MEDIA ? `Up to ${MAX_MEDIA} photos and videos` : 'Add photos or videos'}
                </BodyText>
                <BodyText size={11} color={colors.accentRamp[700]}>
                  Videos up to 1 min
                </BodyText>
              </Pressable>
              {mediaNote ? (
                <BodyText size={12.5} weight="medium" color={colors.accentRamp[800]} style={styles.mediaNote}>
                  {mediaNote}
                </BodyText>
              ) : null}
              {media.length > 0 ? (
                <View style={styles.mediaList}>
                  {media.map((m, i) => (
                    <View key={m.uri} style={styles.mediaRow}>
                      <View style={[styles.thumb, m.kind === 'video' && styles.videoThumb]}>
                        <Image source={{ uri: m.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        {m.kind === 'video' ? (
                          <View style={styles.videoBadge} pointerEvents="none">
                            <Svg width={10} height={10} viewBox="0 0 24 24">
                              <Path d="M7 4.5v15l12-7.5z" fill={colors.neutral[100]} />
                            </Svg>
                            {m.duration ? (
                              <BodyText size={10} weight="bold" color={colors.neutral[100]}>
                                {clock(m.duration)}
                              </BodyText>
                            ) : null}
                          </View>
                        ) : null}
                        <Pressable
                          onPress={() => setMedia((list) => list.filter((x) => x.uri !== m.uri))}
                          hitSlop={6}
                          accessibilityLabel={m.kind === 'video' ? 'Remove video' : 'Remove photo'}
                          style={styles.thumbRemove}
                        >
                          <BodyText size={11} weight="bold" color={colors.neutral[100]}>
                            ✕
                          </BodyText>
                        </Pressable>
                      </View>
                      <TextField
                        label={`Caption for ${m.kind} ${i + 1}`}
                        hideLabel
                        value={m.caption}
                        onChangeText={(text) => setCaption(m.uri, text)}
                        placeholder={m.kind === 'video' ? 'Say something about this video' : 'Say something about this photo'}
                        multiline
                        containerStyle={styles.captionBox}
                        style={styles.caption}
                      />
                    </View>
                  ))}
                </View>
              ) : null}

              <Label>Passport book stamp</Label>
              <BodyText size={12} lineHeightRatio={1.45} color={colors.neutral[600]} style={styles.hint}>
                Got the park&apos;s official stamp in your Passport To Your National Parks book?
                Add a photo of it: a souvenir that you were there in person.
              </BodyText>
              {passportStamp ? (
                <View style={styles.passportRow}>
                  <View style={styles.passportThumb}>
                    <Image source={{ uri: passportStamp }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  </View>
                  <View style={styles.passportActions}>
                    <BodyText size={13} weight="semibold" color={colors.accentRamp[800]}>
                      Stamped in person
                    </BodyText>
                    <View style={styles.chips}>
                      <Pressable
                        onPress={() => pickPassportStamp('camera')}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
                      >
                        <BodyText size={12} weight="semibold" color={colors.neutral[800]}>
                          Retake
                        </BodyText>
                      </Pressable>
                      <Pressable
                        onPress={() => setPassportStamp(null)}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
                      >
                        <BodyText size={12} weight="semibold" color={colors.neutral[800]}>
                          Remove
                        </BodyText>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.passportButtons}>
                  <Pressable
                    onPress={() => pickPassportStamp('camera')}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.addPhotos, styles.passportButton, pressed && styles.addPhotosPressed]}
                  >
                    <CameraIcon />
                    <BodyText size={13} weight="semibold" color={colors.accentRamp[800]}>
                      Photograph it
                    </BodyText>
                  </Pressable>
                  <Pressable
                    onPress={() => pickPassportStamp('library')}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.addPhotos, styles.passportButton, pressed && styles.addPhotosPressed]}
                  >
                    <PlusIcon />
                    <BodyText size={13} weight="semibold" color={colors.accentRamp[800]}>
                      From photos
                    </BodyText>
                  </Pressable>
                </View>
              )}
              {stampNote ? (
                <BodyText size={12.5} weight="medium" color={colors.accentRamp[800]} style={styles.mediaNote}>
                  {stampNote}
                </BodyText>
              ) : null}

              {problem ? (
                <BodyText size={12.5} weight="medium" color={colors.accentRamp[800]} style={styles.problem}>
                  {problem}
                </BodyText>
              ) : null}

              <View style={styles.actions}>
                <Button label="Cancel" variant="secondary" onPress={requestClose} />
                <Button
                  label={editing ? 'Save changes' : 'Save entry'}
                  block
                  onPress={save}
                  loading={saving}
                  style={styles.save}
                />
              </View>
              </>
            ) : null}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
      <Dialog
        visible={confirmDiscard}
        title="Discard your changes?"
        message="The changes you've made to this memory won't be saved."
        actions={[
          { label: 'Discard changes', tone: 'danger', onPress: onClose },
          { label: 'Keep editing', tone: 'cancel', onPress: () => setConfirmDiscard(false) },
        ]}
        onDismiss={() => setConfirmDiscard(false)}
        placement="bottom"
      />
    </Modal>
  );
}

/** An entry's details, to fill the sheet in for editing it. */
function fromEntry(entry: TripEntry): Omit<EntryDraft, 'savedAt'> {
  return {
    siteId: entry.siteId,
    date: entry.date,
    title: entry.title,
    notes: entry.notes,
    rating: entry.rating,
    trails: entry.trails,
    withIds: entry.with.map((p) => p.id),
    media: entry.media,
    visibility: entry.visibility,
    passportStamp: entry.passportStamp,
  };
}

/** The empty entry the sheet opens with when there's no draft. */
function blankDraft(initialSiteId: string | undefined): Omit<EntryDraft, 'savedAt'> {
  return {
    siteId: initialSiteId ?? null,
    date: toDay(new Date()),
    title: '',
    notes: '',
    rating: null,
    trails: [],
    withIds: [],
    media: [],
    visibility: 'private',
    passportStamp: null,
  };
}

/** Whether anything's been filled in beyond what the sheet opens with. */
function hasContent(draft: Omit<EntryDraft, 'savedAt'>, blank: Omit<EntryDraft, 'savedAt'>): boolean {
  return (
    !!draft.title.trim() ||
    !!draft.notes.trim() ||
    draft.trails.length > 0 ||
    draft.rating !== null ||
    draft.withIds.length > 0 ||
    draft.media.length > 0 ||
    draft.visibility !== blank.visibility ||
    draft.passportStamp != null ||
    draft.siteId !== blank.siteId ||
    draft.date !== blank.date
  );
}

/** "1:05", a video's length. */
function clock(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The picker's copies of photos and videos can be cleared by the phone. */
function mediaExists(uri: string): boolean {
  if (/^https?:/.test(uri)) return true;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

function Label({ children }: { children: string }) {
  return (
    <BodyText size={10.5} weight="semibold" color={colors.neutral[600]} style={styles.label}>
      {children.toUpperCase()}
    </BodyText>
  );
}

const VISIBILITY: { value: Visibility; label: string; hint: string }[] = [
  { value: 'private', label: 'Only me', hint: 'Just in your journal' },
  { value: 'friends', label: 'Friends', hint: "In your friends' feed" },
];

const RATING_WORDS = ['Not great', 'Okay', 'Good', 'Great', 'Unforgettable'];

/** A star for the rating: filled orange when on, outlined when off. */
export function StarIcon({ filled, size = 28 }: { filled: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.8l2.8 5.7 6.3.9-4.5 4.4 1 6.2L12 17l-5.6 3 1-6.2L2.9 9.4l6.3-.9z"
        fill={filled ? colors.accent : 'none'}
        stroke={filled ? colors.accent : colors.neutral[500]}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A map pin, for trails and spots. */
export function PinIcon({ color = colors.accentRamp[700], size = 13 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <Path d="M12 7.6a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z" fill={color} />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM4 10h16M8 3.5v4M16 3.5v4"
        fill="none"
        stroke={colors.neutral[700]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CameraIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      <Path
        d="M4 8h3l2-2.5h6L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
        fill="none"
        stroke={colors.accentRamp[700]}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Path d="M12 10a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4z" fill="none" stroke={colors.accentRamp[700]} strokeWidth={2.2} />
    </Svg>
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
  },
  backdrop: {
    backgroundColor: 'rgba(32, 30, 29, 0.32)',
  },
  // A steady height, so the sheet doesn't grow as its contents arrive.
  sheet: {
    height: '88%',
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
  date: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[100],
  },
  datePressed: {
    backgroundColor: colors.neutral[200],
  },
  dateText: {
    flex: 1,
  },
  dateOpen: {
    borderColor: colors.accent,
  },
  notes: {
    minHeight: 84,
    borderRadius: radius.md,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    marginLeft: space[2],
  },
  hint: {
    marginBottom: space[2],
  },
  suggestions: {
    marginTop: space[2],
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  suggestionPressed: {
    backgroundColor: colors.accentRamp[200],
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
  visibility: {
    flexDirection: 'row',
    gap: space[2],
  },
  visibilityOption: {
    flex: 1,
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[100],
  },
  visibilityOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  passportButtons: {
    flexDirection: 'row',
    gap: space[2],
  },
  passportButton: {
    flex: 1,
    gap: space[2],
    paddingHorizontal: 12,
  },
  passportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  passportThumb: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.neutral[200],
    transform: [{ rotate: '-3deg' }],
    ...shadow.sm,
  },
  passportActions: {
    flex: 1,
    gap: space[2],
  },
  mediaNote: {
    marginTop: space[2],
  },
  mediaList: {
    gap: space[3],
    marginTop: space[3],
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  captionBox: {
    flex: 1,
  },
  caption: {
    minHeight: 64,
    borderRadius: radius.md,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  // Behind a video's first frame, or in its place where the phone can't draw one.
  videoThumb: {
    backgroundColor: colors.neutral[800],
  },
  videoBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20, 17, 15, 0.7)',
  },
  chosenTrails: {
    marginBottom: space[2],
  },
  trailOn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  trailOnPressed: {
    backgroundColor: colors.accentRamp[600],
  },
  trailInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  trailField: {
    flex: 1,
  },
  trailAdd: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  trailAddPressed: {
    backgroundColor: colors.accentRamp[600],
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
  restored: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginTop: space[2],
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accentRamp[100],
  },
  restoredText: {
    flex: 1,
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
