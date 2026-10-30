/**
 * Settings opens straight on Profile: a strip of section icons down the
 * left (the one you're on in orange) and the section beside it as a title
 * over a wide white card of rows split by hairlines. Each row is a label and
 * a line of explanation, with its control to the right or below.
 *
 *  - Profile: your picture, name and @username (what friends see), your
 *    starting location, and your quiz answers.
 *  - Account: your email and password, the server, logging out, and
 *    deleting the account.
 *  - Privacy & preferences: what friends can see of you (every trip is
 *    shared with them), the parks you've set aside ("Not for now") with a
 *    way to bring them back, and location.
 *  - Notifications: the chime and buzz, and arrival reminders.
 *  - Display: text size.
 *
 * Everything under Profile and Account comes from GET /auth/me, which is
 * where a demo proves the session is real; Account also shows which API
 * the app is talking to, the first thing to check when a device can't
 * reach it.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { API_BASE_URL } from '../../api/client';
import { displayName, handle } from '../../api/friends';
import { listSites } from '../../api/parks';
import { useArrivals } from '../../arrivals/ArrivalsContext';
import { useAuth } from '../../auth/AuthContext';
import { UsernameField } from '../../auth/UsernameField';
import { normalizeUsername, usernameRuleProblem, useUsernameCheck } from '../../auth/useUsernameCheck';
import { BodyText, Heading, TextField, useTabBarSpace } from '../../components';
import { Avatar } from '../../components/Avatar';
import { Dialog, type DialogAction } from '../../components/Dialog';
import { isKnownZip, QUIZ_STEPS, type QuizAnswers } from '../../data/quizSpec';
import { useSoundEffects } from '../../lib/sounds';
import { useQuiz } from '../../quiz/QuizContext';
import { useSnoozed } from '../../wishlist/useSnoozed';
import { colors, radius, space, TEXT_SIZES, useTextSize } from '../../theme';

type Section = 'profile' | 'account' | 'privacy' | 'notifications' | 'display';

/** Each section, and its icon's strokes on a 24px grid. */
const SECTIONS: { key: Section; label: string; icon: string[] }[] = [
  { key: 'profile', label: 'Profile', icon: ['M12 12a4 4 0 100-8 4 4 0 000 8z', 'M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6'] },
  { key: 'account', label: 'Account', icon: ['M8 11V8a4 4 0 118 0v3', 'M5 11h14v9H5z'] },
  { key: 'privacy', label: 'Privacy & preferences', icon: ['M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z'] },
  { key: 'notifications', label: 'Notifications', icon: ['M6 16V11a6 6 0 1112 0v5l2 2H4z', 'M10 21h4'] },
  { key: 'display', label: 'Display', icon: ['M4 19L9 5l5 14', 'M5.8 14h6.4', 'M15 19l3-8 3 8', 'M16 16.5h4'] },
];

type Note = { ok: boolean; text: string } | null;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const [section, setSection] = useState<Section>('profile');
  const open = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[2] }]}>
      <Heading size={26} style={styles.title}>
        Settings
      </Heading>
      <View style={styles.body}>
        <View style={[styles.nav, styles.navFolded]} accessibilityRole="tablist">
          {SECTIONS.map((s) => {
            const on = s.key === section;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSection(s.key)}
                accessibilityRole="tab"
                accessibilityLabel={s.label}
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [
                  styles.navItem,
                  styles.navItemFolded,
                  on && styles.navItemOn,
                  pressed && !on && styles.navItemPressed,
                ]}
              >
                <View style={styles.navIcon}>
                  <Svg width={20} height={20} viewBox="0 0 24 24">
                    {s.icon.map((d) => (
                      <Path
                        key={d}
                        d={d}
                        fill="none"
                        stroke={on ? colors.neutral[100] : colors.neutral[600]}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </Svg>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Animated.View key={open.key} entering={FadeIn.duration(150)} style={styles.panel}>
          <ScrollView
            contentContainerStyle={[styles.panelContent, { paddingBottom: tabSpace + space[6] }]}
            keyboardShouldPersistTaps="handled"
          >
            <Heading size={21} style={styles.sectionTitle}>
              {open.label}
            </Heading>
            <View style={styles.card}>
              {section === 'profile' ? <ProfileSection /> : null}
              {section === 'account' ? <AccountSection /> : null}
              {section === 'privacy' ? <PrivacySection /> : null}
              {section === 'notifications' ? <NotificationsSection /> : null}
              {section === 'display' ? <DisplaySection /> : null}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

// --- Profile -------------------------------------------------------------------

function ProfileSection() {
  const router = useRouter();
  const { user, changeAvatar, updateProfile } = useAuth();
  const { answers, save } = useQuiz();

  const [photoMenu, setPhotoMenu] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNote, setPhotoNote] = useState<string | null>(null);

  const [first, setFirst] = useState(user?.first_name ?? '');
  const [last, setLast] = useState(user?.last_name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const usernameStatus = useUsernameCheck(username, user?.username);
  const [nameNote, setNameNote] = useState<Note>(null);
  const [nameBusy, setNameBusy] = useState(false);

  const [zip, setZip] = useState(answers.zip ?? '');
  const [zipNote, setZipNote] = useState<Note>(null);

  if (!user) return null;
  const nameChanged =
    first.trim() !== user.first_name || last.trim() !== user.last_name || normalizeUsername(username) !== user.username;

  async function pickPhoto(from: 'camera' | 'library') {
    setPhotoNote(null);
    if (from === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPhotoNote('ParkPath needs the camera for that. You can allow it in your phone settings.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    };
    const result =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const picked = result.canceled ? null : result.assets[0];
    if (!picked) return;
    setPhotoBusy(true);
    try {
      // Small enough to keep on the server without a photo store. (The
      // older one-call API: the newer contextual one gets cancelled on
      // Android when the picker's activity hands back.)
      const saved = await ImageManipulator.manipulateAsync(
        picked.uri,
        [{ resize: { width: 320, height: 320 } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.72, base64: true },
      );
      if (!saved.base64) throw new Error('no picture');
      await changeAvatar(saved.base64);
    } catch {
      setPhotoNote("Couldn't save that photo. Try again, or pick a different one.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto() {
    setPhotoBusy(true);
    changeAvatar(null)
      .catch(() => setPhotoNote('Could not remove it. Try again.'))
      .finally(() => setPhotoBusy(false));
  }

  const photoActions: DialogAction[] = [
    {
      label: 'Take a photo',
      onPress: () => {
        setPhotoMenu(false);
        void pickPhoto('camera');
      },
    },
    {
      label: 'Choose from photos',
      onPress: () => {
        setPhotoMenu(false);
        void pickPhoto('library');
      },
    },
    { label: 'Cancel', tone: 'cancel', onPress: () => setPhotoMenu(false) },
  ];

  async function saveName() {
    const handleNow = normalizeUsername(username);
    const problem = !first.trim()
      ? 'Enter your first name.'
      : !last.trim()
        ? 'Enter your last name.'
        : (usernameRuleProblem(handleNow) ??
          (usernameStatus.state === 'problem' ? usernameStatus.message : null));
    if (problem) {
      setNameNote({ ok: false, text: problem });
      return;
    }
    setNameBusy(true);
    try {
      await updateProfile({
        first_name: first.trim(),
        last_name: last.trim(),
        ...(handleNow !== user!.username ? { username: handleNow } : {}),
      });
      setNameNote({ ok: true, text: 'Saved.' });
    } catch (err) {
      setNameNote({ ok: false, text: err instanceof Error ? err.message : 'Could not save that. Try again.' });
    } finally {
      setNameBusy(false);
    }
  }

  async function saveZip() {
    const value = zip.trim();
    if (value && !isKnownZip(value)) {
      setZipNote({ ok: false, text: "That doesn't look like a US zip code we know." });
      return;
    }
    await save({ ...answers, zip: value || null });
    setZipNote({ ok: true, text: value ? 'Saved. Recommendations now start from here.' : 'Location cleared.' });
  }

  return (
    <>
      <Row>
        <View style={styles.photoRow}>
          <Pressable
            onPress={() => setPhotoMenu(true)}
            disabled={photoBusy}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Avatar person={user} size={60} />
            {photoBusy ? (
              <View style={styles.photoBusy}>
                <ActivityIndicator color={colors.neutral[100]} />
              </View>
            ) : null}
          </Pressable>
          <View style={styles.grow}>
            <BodyText size={15} weight="bold" numberOfLines={1}>
              {displayName(user)}
            </BodyText>
            <BodyText size={12.5} weight="medium" color={colors.neutral[600]} numberOfLines={1}>
              {handle(user)}
            </BodyText>
          </View>
        </View>
        <View style={styles.buttons}>
          <SmallButton label={user.avatar_url ? 'Change photo' : 'Add photo'} onPress={() => setPhotoMenu(true)} />
          {user.avatar_url ? <SmallButton label="Remove" onPress={removePhoto} /> : null}
        </View>
        {photoNote ? <NoteText note={{ ok: false, text: photoNote }} /> : null}
      </Row>
      <Dialog
        visible={photoMenu}
        title="Profile photo"
        message="Friends see it beside your name and trips."
        placement="bottom"
        actions={photoActions}
        onDismiss={() => setPhotoMenu(false)}
      />

      <Row>
        <RowText title="Name" description="How you appear to friends, on your trips and comments." />
        <View style={styles.pair}>
          <TextField
            label="First name"
            value={first}
            onChangeText={(text) => {
              setFirst(text);
              setNameNote(null);
            }}
            autoCapitalize="words"
            autoComplete="given-name"
            containerStyle={styles.grow}
          />
          <TextField
            label="Last name"
            value={last}
            onChangeText={(text) => {
              setLast(text);
              setNameNote(null);
            }}
            autoCapitalize="words"
            autoComplete="family-name"
            containerStyle={styles.grow}
          />
        </View>
        <UsernameField
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            setNameNote(null);
          }}
          status={usernameStatus}
        />
        <NoteText note={nameNote} />
        <View style={styles.buttons}>
          <SmallButton label="Save changes" primary disabled={!nameChanged} busy={nameBusy} onPress={() => void saveName()} />
        </View>
      </Row>

      <Row>
        <RowText title="Location" description="Your starting zip code, for weighing how far away each park is." />
        <View style={styles.inline}>
          <TextField
            label="Zip code"
            hideLabel
            value={zip}
            onChangeText={(text) => {
              setZip(text.replace(/[^0-9]/g, '').slice(0, 5));
              setZipNote(null);
            }}
            placeholder="e.g. 80302"
            keyboardType="number-pad"
            maxLength={5}
            returnKeyType="done"
            onSubmitEditing={() => void saveZip()}
            containerStyle={styles.grow}
          />
          <SmallButton label="Save" disabled={zip === (answers.zip ?? '')} onPress={() => void saveZip()} />
        </View>
        <NoteText note={zipNote} />
      </Row>

      <Row last>
        <RowText title="Trip preferences" description="Your quiz answers, used for recommendations." />
        <Value label="Terrain" value={answers.terrains.length ? answers.terrains.join(', ') : 'none chosen'} />
        <Value label="Seasons" value={seasonSummary(answers.seasons)} />
        <Value label="Crowds" value={crowdsLabel(answers.crowds)} />
        <View style={styles.buttons}>
          <SmallButton label="Retake the quiz" onPress={() => router.push('/quiz')} />
        </View>
      </Row>
    </>
  );
}

// --- Account -------------------------------------------------------------------

function AccountSection() {
  const { user, signOut, updateProfile, changePassword } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailNote, setEmailNote] = useState<Note>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordNote, setPasswordNote] = useState<Note>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function saveEmail() {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailNote({ ok: false, text: 'That does not look like an email address.' });
      return;
    }
    if (!emailPassword) {
      setEmailNote({ ok: false, text: 'Enter your password to change your email.' });
      return;
    }
    setEmailBusy(true);
    try {
      await updateProfile({ email: value, current_password: emailPassword });
      setEmail('');
      setEmailPassword('');
      setEmailOpen(false);
      setEmailNote({ ok: true, text: 'Email changed. Use it next time you sign in.' });
    } catch (err) {
      setEmailNote({ ok: false, text: err instanceof Error ? err.message : 'Could not change it. Try again.' });
    } finally {
      setEmailBusy(false);
    }
  }

  async function savePassword() {
    if (next.length < 8) {
      setPasswordNote({ ok: false, text: 'Use at least 8 characters.' });
      return;
    }
    if (next !== confirm) {
      setPasswordNote({ ok: false, text: 'Those passwords do not match.' });
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setPasswordOpen(false);
      setPasswordNote({ ok: true, text: 'Password changed.' });
    } catch (err) {
      setPasswordNote({ ok: false, text: err instanceof Error ? err.message : 'Could not change it. Try again.' });
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <Row>
        {/* The button goes under the address, so a long one stays on a line. */}
        <RowText title="Email" description={user?.email ?? ''} />
        {emailOpen ? null : (
          <View style={styles.buttons}>
            <SmallButton
              label="Change email"
              onPress={() => {
                setEmailOpen(true);
                setEmailNote(null);
              }}
            />
          </View>
        )}
        {emailOpen ? (
          <>
            <TextField
              label="New email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailNote(null);
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
            <TextField
              label="Your password, to confirm it's you"
              value={emailPassword}
              onChangeText={setEmailPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
            />
          </>
        ) : null}
        <NoteText note={emailNote} />
        {emailOpen ? (
          <View style={styles.buttons}>
            <SmallButton label="Cancel" onPress={() => setEmailOpen(false)} />
            <SmallButton label="Save email" primary disabled={!email.trim()} busy={emailBusy} onPress={() => void saveEmail()} />
          </View>
        ) : null}
      </Row>

      <Row>
        <RowText
          title="Password"
          description="••••••••"
          control={
            passwordOpen ? null : (
              <SmallButton
                label="Change"
                onPress={() => {
                  setPasswordOpen(true);
                  setPasswordNote(null);
                }}
              />
            )
          }
        />
        {passwordOpen ? (
          <>
            <TextField
              label="Current password"
              value={current}
              onChangeText={(text) => {
                setCurrent(text);
                setPasswordNote(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
            />
            <TextField
              label="New password"
              value={next}
              onChangeText={setNext}
              placeholder="At least 8 characters"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
            />
            <TextField
              label="Confirm new password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
            />
          </>
        ) : null}
        <NoteText note={passwordNote} />
        {passwordOpen ? (
          <View style={styles.buttons}>
            <SmallButton label="Cancel" onPress={() => setPasswordOpen(false)} />
            <SmallButton
              label="Save password"
              primary
              disabled={!current || !next}
              busy={passwordBusy}
              onPress={() => void savePassword()}
            />
          </View>
        ) : null}
      </Row>

      <Row>
        <RowText title="Server" description={API_BASE_URL} />
      </Row>

      {/* Doesn't clear the quiz answers: they're kept per account for the
          next sign-in. Profile → Retake the quiz starts over. */}
      <Row>
        <RowText
          title="Log out"
          description="Sign out of ParkPath on this phone."
          control={<SmallButton label="Log out" onPress={signOut} />}
        />
      </Row>

      <Row last>
        <RowText
          title="Delete account"
          description="Permanently delete your account and everything in it: trips, photos, friends and comments."
          control={deleting ? null : <SmallButton label="Delete" danger onPress={() => setDeleting(true)} />}
        />
        {deleting && user ? (
          <DeleteAccountForm google={user.signs_in_with_google ?? false} onCancel={() => setDeleting(false)} />
        ) : null}
      </Row>
    </>
  );
}

/**
 * The last step before deleting the account: type DELETE, and the password
 * (not for an account that signs in with Google). Deleting signs out.
 */
function DeleteAccountForm({ google, onCancel }: { google: boolean; onCancel: () => void }) {
  const { deleteAccount } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const ready = confirm.trim().toUpperCase() === 'DELETE' && (google || password.length > 0);

  async function remove() {
    setBusy(true);
    setNote(null);
    try {
      await deleteAccount(confirm.trim(), google ? undefined : password);
      // Signed out: the app goes back to sign-in.
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Couldn't delete it. Try again." });
      setBusy(false);
    }
  }

  return (
    <View style={styles.dangerBox}>
      <BodyText size={13} weight="semibold" color={colors.accentRamp[800]}>
        This can&apos;t be undone. Your trips, photos, stamps, friends and comments will be gone for
        good, and friends will no longer see you.
      </BodyText>
      {google ? null : (
        <TextField
          label="Your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />
      )}
      <TextField
        label="Type DELETE to confirm"
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="DELETE"
      />
      <NoteText note={note} />
      <View style={styles.buttons}>
        <SmallButton label="Cancel" onPress={onCancel} />
        <SmallButton label="Delete forever" danger primary disabled={!ready} busy={busy} onPress={() => void remove()} />
      </View>
    </View>
  );
}

// --- Privacy -------------------------------------------------------------------

function PrivacySection() {
  const arrivals = useArrivals();
  return (
    <>
      <Row>
        <RowText
          title="What friends see"
          description="Your name, @username and profile photo, the trips you log, and the passport those trips earn you."
        />
      </Row>
      <Row>
        <RowText title="Your email" description="Never shown to anyone, friends included." />
      </Row>
      <SetAside />
      <Row last>
        <RowText
          title="Location"
          description={
            arrivals.enabled
              ? 'Arrival reminders use your location while ParkPath is open. It never leaves your phone.'
              : 'Not used. Turn on arrival reminders under Notifications to let ParkPath notice when you reach a park.'
          }
        />
        {arrivals.permission === 'denied' ? (
          <Pressable onPress={() => Linking.openSettings()} accessibilityRole="link">
            <BodyText size={12.5} weight="semibold" color={colors.accentRamp[700]}>
              Location is off for ParkPath. Turn it on in your phone&apos;s settings ›
            </BodyText>
          </Pressable>
        ) : null}
      </Row>
    </>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The parks set aside with "Not for now": a count here, and the full list
 * (each with when it's back and a way to bring it back now) in a sheet, so
 * a long list doesn't crowd Settings.
 */
function SetAside() {
  const { snoozes } = useSnoozed();
  const [open, setOpen] = useState(false);
  const count = Object.keys(snoozes).length;
  return (
    <Row>
      <RowText
        title="Set aside"
        description={
          count > 0
            ? `${count} ${count === 1 ? 'park' : 'parks'} you passed on with “Not for now”. Each comes back to your picks by itself after 30 days, or bring one back now.`
            : 'Nothing set aside. Parks you pass on with “Not for now” wait here for 30 days, then come back to your picks.'
        }
        control={count > 0 ? <SmallButton label="See all" onPress={() => setOpen(true)} /> : undefined}
      />
      {open ? <SetAsideSheet onClose={() => setOpen(false)} /> : null}
    </Row>
  );
}

/** The full Set aside list, soonest back first, in a sheet from the bottom. */
function SetAsideSheet({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { snoozes, unsnooze } = useSnoozed();
  // Same query key as Explore, so the names are usually already cached.
  const { data: sites = [] } = useQuery({ queryKey: ['sites', 'all'], queryFn: () => listSites('all') });
  const nameOf = new Map(sites.map((site) => [site.id, site.name]));
  const parks = Object.entries(snoozes).sort(([, a], [, b]) => a - b);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close set aside parks" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space[3] }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Heading size={19} style={styles.grow}>
              Set aside
            </Heading>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.sheetClose}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path d="M6 6l12 12M18 6L6 18" stroke={colors.neutral[800]} strokeWidth={2.6} strokeLinecap="round" />
              </Svg>
            </Pressable>
          </View>
          <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListContent}>
            {parks.length === 0 ? (
              <BodyText size={13} color={colors.neutral[600]} style={styles.sheetEmpty}>
                All back in your picks.
              </BodyText>
            ) : (
              parks.map(([id, until]) => {
                const back = new Date(until);
                return (
                  <View key={id} style={styles.setAsideRow}>
                    <View style={styles.grow}>
                      <BodyText size={13.5} weight="semibold" numberOfLines={1}>
                        {nameOf.get(id) ?? id.toUpperCase()}
                      </BodyText>
                      <BodyText size={12} color={colors.neutral[600]}>
                        {`Back on ${MONTHS[back.getMonth()]} ${back.getDate()}`}
                      </BodyText>
                    </View>
                    <SmallButton label="Bring back" onPress={() => unsnooze(id)} />
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// --- Notifications -------------------------------------------------------------

function NotificationsSection() {
  const [soundsOn, setSoundsOn] = useSoundEffects();
  const arrivals = useArrivals();
  return (
    <>
      <Row>
        <RowText
          title="Sounds"
          description="A chime when you earn an achievement or complete a region, and a light buzz when a stamp goes down."
          control={<Toggle label="Sounds" value={soundsOn} onChange={setSoundsOn} />}
        />
      </Row>
      <Row last>
        <RowText
          title="Arrival reminders"
          description="While ParkPath is open, it notices when you've reached a national park and reminds you to log the trip."
          control={
            <Toggle label="Arrival reminders" value={arrivals.enabled} onChange={(on) => void arrivals.setEnabled(on)} />
          }
        />
      </Row>
    </>
  );
}

// --- Display -------------------------------------------------------------------

function DisplaySection() {
  const { size: textSize, setSize: setTextSize } = useTextSize();
  return (
    <Row last>
      <RowText title="Text size" description="Your phone's own text size setting applies on top of this." />
      <Segmented options={TEXT_SIZES} value={textSize} onChange={setTextSize} />
      {/* A sample at the chosen size, so the effect is visible right here. */}
      <BodyText size={13.5} lineHeightRatio={1.5} color={colors.neutral[800]}>
        Zion: a river cut a narrow corridor through sandstone.
      </BodyText>
    </Row>
  );
}

// --- pieces --------------------------------------------------------------------

/** One setting: everything in it, then a hairline (none after the last). */
function Row({ children, last = false }: { children: ReactNode; last?: boolean }) {
  return <View style={[styles.row, !last && styles.rowRule]}>{children}</View>;
}

/** A row's title and explanation, with an optional control to the right. */
function RowText({ title, description, control }: { title: string; description?: string; control?: ReactNode }) {
  return (
    <View style={styles.rowText}>
      <View style={styles.grow}>
        <BodyText size={14} weight="semibold">
          {title}
        </BodyText>
        {description ? (
          <BodyText size={12.5} lineHeightRatio={1.45} color={colors.neutral[600]} style={styles.description}>
            {description}
          </BodyText>
        ) : null}
      </View>
      {control}
    </View>
  );
}

function SmallButton({
  label,
  onPress,
  primary = false,
  danger = false,
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  /** Red: for deleting the account. */
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy }}
      style={({ pressed }) => [
        styles.smallButton,
        primary ? (danger ? styles.smallDanger : styles.smallPrimary) : danger ? styles.smallDangerPlain : styles.smallPlain,
        pressed && (primary ? styles.smallPrimaryPressed : styles.smallPlainPressed),
        (disabled || busy) && styles.smallDisabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={primary ? colors.neutral[100] : colors.accent} />
      ) : (
        <BodyText
          size={13}
          weight="semibold"
          color={primary ? colors.neutral[100] : danger ? DANGER : colors.neutral[900]}
        >
          {label}
        </BodyText>
      )}
    </Pressable>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <BodyText size={12.5} weight="semibold" color={on ? colors.neutral[900] : colors.neutral[600]}>
              {option.label}
            </BodyText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (on: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: colors.accent, false: colors.neutral[300] }}
      thumbColor={colors.neutral[100]}
      accessibilityLabel={label}
    />
  );
}

function NoteText({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <BodyText size={12.5} weight="medium" color={note.ok ? colors.accent2Ramp[800] : colors.accentRamp[800]}>
      {note.text}
    </BodyText>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.value}>
      <BodyText size={13} color={colors.neutral[600]}>
        {label}
      </BodyText>
      <BodyText size={13} weight="semibold" style={styles.valueText} numberOfLines={2}>
        {value}
      </BodyText>
    </View>
  );
}

/** "fall, then spring", in ranked order. */
function seasonSummary(seasons: QuizAnswers['seasons']): string {
  if (seasons === null) return 'not set';
  if (seasons.length === 0) return 'any season';
  return seasons.join(', then ');
}

function crowdsLabel(crowds: QuizAnswers['crowds']): string {
  const step = QUIZ_STEPS.find((s) => s.key === 'crowds');
  const option = step?.key === 'crowds' ? step.options.find((o) => o.value === crowds) : undefined;
  return option?.label ?? 'not set';
}

/** The folded menu: a strip of icons. */
/** For deleting the account: a clear red, apart from the app's terracotta. */
const DANGER = '#a82424';

const NAV_FOLDED = 60;
const RULE = 'rgba(32, 30, 29, 0.12)';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  title: {
    paddingHorizontal: space[4],
    marginBottom: space[3],
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  nav: {
    gap: space[1],
  },
  navFolded: {
    width: NAV_FOLDED,
    paddingLeft: space[3],
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
  },
  navItemFolded: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  // No shadow: Android draws it as a grey box around the rounded square.
  navItemOn: {
    backgroundColor: colors.accent,
  },
  navItemPressed: {
    backgroundColor: 'rgba(32, 30, 29, 0.06)',
  },
  navIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    flex: 1,
  },
  panelContent: {
    paddingLeft: space[2],
    paddingRight: space[4],
  },
  sectionTitle: {
    letterSpacing: 0,
    marginBottom: space[3],
  },
  // White, so the settings stand off the sand page.
  card: {
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    // No shadow: Android draws it as a box while the card fades in.
    backgroundColor: '#fffdfa',
  },
  row: {
    gap: space[3],
    paddingVertical: space[4],
  },
  rowRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RULE,
  },
  rowText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  description: {
    marginTop: 2,
  },
  grow: {
    flex: 1,
  },
  setAsideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 30, 29, 0.32)',
  },
  sheet: {
    maxHeight: '78%',
    paddingHorizontal: space[4],
    paddingTop: space[2],
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.neutral[100],
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
    marginBottom: space[2],
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingBottom: space[2],
  },
  sheetClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  sheetList: {
    flexGrow: 0,
  },
  sheetListContent: {
    gap: space[4],
    paddingVertical: space[2],
  },
  sheetEmpty: {
    textAlign: 'center',
    marginVertical: space[6],
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  photoBusy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20, 17, 15, 0.45)',
  },
  pressed: {
    opacity: 0.75,
  },
  pair: {
    flexDirection: 'row',
    gap: space[2],
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  smallButton: {
    minHeight: 36,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  smallPlain: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[100],
  },
  smallPlainPressed: {
    backgroundColor: colors.neutral[200],
  },
  smallPrimary: {
    backgroundColor: colors.accent,
  },
  smallPrimaryPressed: {
    backgroundColor: colors.accentRamp[600],
  },
  smallDanger: {
    backgroundColor: DANGER,
  },
  smallDangerPlain: {
    borderWidth: 1,
    borderColor: 'rgba(168, 36, 36, 0.45)',
    backgroundColor: colors.neutral[100],
  },
  dangerBox: {
    gap: space[3],
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(168, 36, 36, 0.3)',
    backgroundColor: 'rgba(168, 36, 36, 0.05)',
  },
  smallDisabled: {
    opacity: 0.45,
  },
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(32, 30, 29, 0.07)',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  segmentOn: {
    backgroundColor: colors.neutral[100],
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  value: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space[3],
  },
  valueText: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
