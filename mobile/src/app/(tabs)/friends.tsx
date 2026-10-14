/**
 * Friends, following the prototype's screen: a header with Invite and your
 * initials, a sideways row of your friends, any pending requests, then the
 * friends' feed.
 *
 * Real data from the friendships backend (api/app/routers/friends.py):
 * adding a friend by the email they signed up with, accepting or declining
 * requests, cancelling your own, and removing a friend. Profiles are only
 * an email for now, so names and initials are made from it.
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

import { displayName, type Friend } from '../../api/friends';
import { useAuth } from '../../auth/AuthContext';
import { BodyText, Button, Heading, TextField, useTabBarSpace } from '../../components';
import { Avatar } from '../../components/Avatar';
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

  function confirmRemove(friend: Friend) {
    const name = displayName(friend.user.email);
    Alert.alert(name, friend.user.email, [
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
                accessibilityLabel={`${displayName(friend.user.email)}, friends since ${monthYear(friend.since) ?? 'recently'}`}
                style={({ pressed }) => [styles.friend, pressed && styles.pressed]}
              >
                <Avatar person={friend.user} size={54} ring />
                <BodyText size={11.5} weight="semibold" numberOfLines={1} style={styles.friendName}>
                  {displayName(friend.user.email)}
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
              Tap Invite and add someone by the email they signed up to ParkPath with. Once they
              accept, you can see each other&apos;s trips.
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
                    {`${displayName(req.requester.email)} wants to be friends`}
                  </BodyText>
                  <BodyText size={11.5} color={colors.neutral[600]} numberOfLines={1}>
                    {req.requester.email}
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
                    {`Waiting for ${displayName(req.addressee.email)}`}
                  </BodyText>
                  <BodyText size={11.5} color={colors.neutral[600]} numberOfLines={1}>
                    {`Sent ${monthYear(req.createdAt) ?? ''} · ${req.addressee.email}`}
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
              When friends log a trip, you&apos;ll see their photos and notes here, and can react
              and comment. This arrives with Trips.
            </BodyText>
          </View>
        </View>
      </ScrollView>

      <InviteSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} send={send} />
    </View>
  );
}

/** Add a friend by email: a sheet from the bottom with one field. */
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
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function close() {
    setEmail('');
    setResult(null);
    send.reset();
    onClose();
  }

  function submit() {
    if (!email.trim()) return;
    setResult(null);
    send.mutate(email, {
      onSuccess: (req) => {
        const name = displayName(req.addressee.email);
        setResult(
          req.status === 'accepted'
            ? // They had already asked you, so that made you friends.
              { ok: true, text: `You and ${name} are now friends.` }
            : { ok: true, text: `Request sent. ${name} will see it in their Friends.` },
        );
        setEmail('');
      },
      onError: (err) =>
        setResult({
          ok: false,
          text:
            err.message === 'No user with that email'
              ? "There's no ParkPath account with that email yet."
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
            Add someone by the email they use for ParkPath. They&apos;ll see your request in their
            Friends.
          </BodyText>
          <TextField
            label="Their email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setResult(null);
            }}
            onSubmitEditing={submit}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
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
              disabled={!email.trim()}
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
