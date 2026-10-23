/**
 * Friends, following the prototype's screen: a header with Invite and your
 * initials, a sideways row of your friends, any pending requests, then the
 * friends' feed.
 *
 * Real data from the friendships backend (api/app/routers/friends.py):
 * adding a friend by their username or email, or by scanning their QR
 * code (the QR button by Invite), accepting or declining requests,
 * cancelling your own, and removing a friend. People show as their name
 * and @username; emails stay private.
 *
 * The feed of friends' trips, with reactions and comments, needs the trips
 * backend; until then it says so rather than showing made-up posts.
 */

import { useState } from 'react';
import {
  Alert,
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

import { displayName, handle, targetFrom, type Friend } from '../../api/friends';
import { useAuth } from '../../auth/AuthContext';
import { BodyText, Button, Heading, TextField, useTabBarSpace } from '../../components';
import { Avatar } from '../../components/Avatar';
import { FriendCodeSheet } from '../../components/friends/FriendCode';
import { useFriends } from '../../friends/useFriends';
import { colors, radius, shadow, space } from '../../theme';

/** "Oct 2026" from an ISO date. */
function monthYear(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { user } = useAuth();
  const { friends, incoming, outgoing, loading, error, accept, dismiss, remove, send } = useFriends();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  function confirmRemove(friend: Friend) {
    const name = displayName(friend.user);
    Alert.alert(name, handle(friend.user), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove friend',
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Remove ${name}?`, "You'll stop seeing each other's trips.", [
            { text: 'Keep', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(friend.user.id) },
          ]),
      },
    ]);
  }

  const requests = incoming.length + outgoing.length;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          // Clear of the floating tab bar, which covers the bottom of the screen.
          { paddingTop: insets.top + space[2], paddingBottom: tabSpace + space[6] },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Heading size={26}>Friends</Heading>
            <BodyText size={12} color={colors.neutral[600]} style={styles.subtitle}>
              {`Visible to friends only · ${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}`}
            </BodyText>
          </View>
          <Button
            label="Invite"
            variant="secondary"
            onPress={() => setInviteOpen(true)}
            style={styles.invite}
          />
          {user?.username ? (
            <Pressable
              onPress={() => setCodeOpen(true)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Friend code: show yours or scan a friend's"
              style={({ pressed }) => [styles.qrButton, pressed && styles.pressed]}
            >
              <QrIcon />
            </Pressable>
          ) : null}
          {user ? <Avatar person={user} size={40} /> : null}
        </View>

        {/* Your friends, a sideways row as in the prototype. */}
        {friends.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.row}
            contentContainerStyle={styles.rowContent}
          >
            {friends.map((friend) => (
              <Pressable
                key={friend.friendshipId}
                onPress={() => confirmRemove(friend)}
                accessibilityRole="button"
                accessibilityLabel={`${displayName(friend.user)}, friends since ${monthYear(friend.since) ?? 'recently'}`}
                style={({ pressed }) => [styles.friend, pressed && styles.pressed]}
              >
                <Avatar person={friend.user} size={54} ring />
                <BodyText size={11.5} weight="semibold" numberOfLines={1} style={styles.friendName}>
                  {displayName(friend.user)}
                </BodyText>
                <BodyText size={10} weight="medium" color={colors.neutral[600]} numberOfLines={1}>
                  {monthYear(friend.since) ? `since ${monthYear(friend.since)}` : 'friend'}
                </BodyText>
              </Pressable>
            ))}
          </ScrollView>
        ) : !loading ? (
          <View style={styles.card}>
            <BodyText size={14} weight="semibold">
              No friends yet
            </BodyText>
            <BodyText size={13} lineHeightRatio={1.5} color={colors.neutral[700]}>
              Tap Invite to add someone by their username, or the QR button to scan their friend
              code. Once they accept, you can see each other&apos;s trips.
            </BodyText>
          </View>
        ) : null}

        {error ? (
          <BodyText size={12.5} color={colors.accentRamp[800]} style={styles.error}>
            Couldn&apos;t load your friends. Check your connection and try again.
          </BodyText>
        ) : null}

        {requests > 0 ? (
          <View style={styles.section}>
            <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.label}>
              REQUESTS
            </BodyText>
            {incoming.map((req) => (
              <View key={req.id} style={styles.request}>
                <Avatar person={req.requester} size={36} />
                <View style={styles.requestText}>
                  <BodyText size={13.5} weight="semibold" numberOfLines={1}>
                    {`${displayName(req.requester)} wants to be friends`}
                  </BodyText>
                  <BodyText size={11.5} color={colors.neutral[600]} numberOfLines={1}>
                    {handle(req.requester)}
                  </BodyText>
                </View>
                <Button
                  label="Accept"
                  onPress={() => accept.mutate(req.id)}
                  loading={accept.isPending && accept.variables === req.id}
                  style={styles.smallButton}
                />
                <Button
                  label="Decline"
                  variant="ghost"
                  onPress={() => dismiss.mutate(req.id)}
                  style={styles.smallButton}
                />
              </View>
            ))}
            {outgoing.map((req) => (
              <View key={req.id} style={styles.request}>
                <Avatar person={req.addressee} size={36} />
                <View style={styles.requestText}>
                  <BodyText size={13.5} weight="semibold" numberOfLines={1}>
                    {`Waiting for ${displayName(req.addressee)}`}
                  </BodyText>
                  <BodyText size={11.5} color={colors.neutral[600]} numberOfLines={1}>
                    {`Sent ${monthYear(req.createdAt) ?? ''} · ${handle(req.addressee)}`}
                  </BodyText>
                </View>
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => dismiss.mutate(req.id)}
                  style={styles.smallButton}
                />
              </View>
            ))}
          </View>
        ) : null}

        {/* The feed, in the prototype's card style, until there are trips to show. */}
        <View style={styles.section}>
          <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.label}>
            FRIENDS&apos; TRIPS
          </BodyText>
          <View style={styles.card}>
            <BodyText size={14} weight="semibold">
              Your friends&apos; trips will show up here
            </BodyText>
            <BodyText size={13} lineHeightRatio={1.5} color={colors.neutral[700]}>
              When friends log a trip, you&apos;ll see their photos, notes and location stamps
              here, and can react and comment. This arrives with the trips backend.
            </BodyText>
          </View>
        </View>
      </ScrollView>

      <InviteSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} send={send} />
      {user ? (
        <FriendCodeSheet visible={codeOpen} me={user} send={send} onClose={() => setCodeOpen(false)} />
      ) : null}
    </View>
  );
}

/** A QR code, for the friend-code button. */
function QrIcon() {
  const stroke = colors.accentRamp[700];
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 18.5h1.5M18.5 14H20" fill="none" stroke={stroke} strokeWidth={2} />
    </Svg>
  );
}

/** Add a friend by username or email: a sheet from the bottom with one field. */
function InviteSheet({
  visible,
  onClose,
  send,
}: {
  visible: boolean;
  onClose: () => void;
  send: ReturnType<typeof useFriends>['send'];
}) {
  const insets = useSafeAreaInsets();
  const [who, setWho] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function close() {
    setWho('');
    setResult(null);
    send.reset();
    onClose();
  }

  function submit() {
    if (!who.trim()) return;
    setResult(null);
    send.mutate(targetFrom(who), {
      onSuccess: (req) => {
        const name = displayName(req.addressee);
        setResult(
          req.status === 'accepted'
            ? // They had already asked you, so that made you friends.
              { ok: true, text: `You and ${name} are now friends.` }
            : { ok: true, text: `Request sent. ${name} will see it in their Friends.` },
        );
        setWho('');
      },
      onError: (err) =>
        setResult({
          ok: false,
          text:
            err.message === 'No user with that email'
              ? "There's no ParkPath account with that email yet."
              : err.message === 'No user with that username'
                ? "There's no ParkPath account with that username."
                : err.message,
        }),
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { marginBottom: insets.bottom + 14 }]}>
          <Heading size={19}>Invite a friend</Heading>
          <BodyText size={12.5} lineHeightRatio={1.45} color={colors.neutral[700]}>
            Add someone by their ParkPath username (or the email they signed up with). They&apos;ll
            see your request in their Friends.
          </BodyText>
          <TextField
            label="Their username or email"
            value={who}
            onChangeText={(text) => {
              setWho(text);
              setResult(null);
            }}
            onSubmitEditing={submit}
            placeholder="@jane.doe"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="send"
          />
          {result ? (
            <BodyText
              size={12.5}
              weight="medium"
              color={result.ok ? colors.accent2Ramp[800] : colors.accentRamp[800]}
            >
              {result.text}
            </BodyText>
          ) : null}
          <View style={styles.sheetActions}>
            <Button label="Done" variant="secondary" onPress={close} />
            <Button
              label="Send request"
              block
              onPress={submit}
              loading={send.isPending}
              disabled={!who.trim()}
              style={styles.sheetSend}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: space[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  headerText: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  qrButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accentRamp[400],
    backgroundColor: colors.neutral[100],
  },
  invite: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  row: {
    marginTop: space[4],
    marginHorizontal: -space[4],
  },
  rowContent: {
    gap: space[3],
    paddingHorizontal: space[4],
    paddingBottom: space[2],
  },
  friend: {
    width: 74,
    alignItems: 'center',
    gap: 4,
  },
  friendName: {
    textAlign: 'center',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  section: {
    marginTop: space[6],
    gap: space[2],
  },
  label: {
    letterSpacing: 1,
  },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  requestText: {
    flex: 1,
  },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  card: {
    gap: space[2],
    marginTop: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  error: {
    marginTop: space[3],
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 30, 29, 0.32)',
  },
  sheet: {
    gap: space[3],
    marginHorizontal: 14,
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.lg,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[1],
  },
  sheetSend: {
    flex: 1,
  },
});
