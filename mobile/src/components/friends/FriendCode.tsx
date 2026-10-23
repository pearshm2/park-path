/**
 * Friending in person: your QR code for a friend to scan, and a scanner
 * for theirs.
 *
 * A code holds a ParkPath link with the username and the name to show
 * while asking ("parkpath://friend/jane.doe?name=Jane%20Doe"), never the
 * email. Scanning one asks "Add Jane Doe?"; adding sends a friend request
 * by username, which they still accept (or it makes you friends at once
 * if they'd already asked you).
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { displayName, handle, type Person } from '../../api/friends';
import type { useFriends } from '../../friends/useFriends';
import { colors, radius, shadow, space } from '../../theme';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { BodyText, Heading } from '../Typography';

/** The link a friend code holds. */
export function friendLink(person: Person): string {
  return `parkpath://friend/${encodeURIComponent(person.username ?? '')}?name=${encodeURIComponent(displayName(person))}`;
}

/** The username and name in a scanned code, or null if it isn't a ParkPath one. */
export function readFriendLink(data: string): { username: string; name: string } | null {
  const match = /^parkpath:\/\/friend\/([a-z0-9._]{3,20})(?:\?name=([^&]*))?$/i.exec(data.trim());
  if (!match) return null;
  let name = '';
  try {
    name = decodeURIComponent(match[2] ?? '');
  } catch {
    // A garbled name: show the username alone.
  }
  return { username: match[1].toLowerCase(), name };
}

type Send = ReturnType<typeof useFriends>['send'];

export function FriendCodeSheet({
  visible,
  me,
  send,
  onClose,
}: {
  visible: boolean;
  me: Person;
  send: Send;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [scanning, setScanning] = useState(false);

  function close() {
    setScanning(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      {scanning ? (
        <Scanner me={me} send={send} onBack={() => setScanning(false)} onClose={close} />
      ) : (
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
          <View style={[styles.card, { marginBottom: insets.bottom + 14 }]}>
            <Heading size={20}>Your friend code</Heading>
            <BodyText size={12.5} lineHeightRatio={1.45} color={colors.neutral[700]} style={styles.centered}>
              Have a friend scan this from their Friends tab to send you a request.
            </BodyText>
            <View style={styles.code}>
              <QRCode
                value={friendLink(me)}
                size={208}
                color={colors.neutral[900]}
                backgroundColor={colors.neutral[100]}
              />
            </View>
            <View style={styles.who}>
              <Avatar person={me} size={34} />
              <View>
                <BodyText size={15} weight="bold">
                  {displayName(me)}
                </BodyText>
                <BodyText size={12.5} weight="semibold" color={colors.neutral[600]}>
                  {handle(me)}
                </BodyText>
              </View>
            </View>
            <View style={styles.actions}>
              <Button label="Done" variant="secondary" onPress={close} />
              <Button label="Scan a friend's code" block onPress={() => setScanning(true)} style={styles.grow} />
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}

/** The camera, looking for a friend code; then "Add them?". */
function Scanner({
  me,
  send,
  onBack,
  onClose,
}: {
  me: Person;
  send: Send;
  onBack: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [found, setFound] = useState<{ username: string; name: string } | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  function onScanned(data: string) {
    if (found) return;
    const friend = readFriendLink(data);
    if (!friend) {
      setNote({ ok: false, text: "That isn't a ParkPath friend code." });
      return;
    }
    setNote(
      friend.username === me.username ? { ok: false, text: "That's your own code." } : null,
    );
    if (friend.username !== me.username) setFound(friend);
  }

  function add() {
    if (!found) return;
    const name = found.name || `@${found.username}`;
    send.mutate(
      { username: found.username },
      {
        onSuccess: (req) =>
          setNote({
            ok: true,
            text:
              req.status === 'accepted'
                ? `You and ${name} are now friends.`
                : `Request sent. ${name} will see it in their Friends.`,
          }),
        onError: (err) => setNote({ ok: false, text: err.message }),
      },
    );
  }

  function scanAgain() {
    send.reset();
    setFound(null);
    setNote(null);
  }

  const sent = send.isSuccess;

  return (
    <View style={styles.scanner}>
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={found ? undefined : ({ data }) => onScanned(data)}
        />
      ) : null}

      <View style={[styles.scanTop, { paddingTop: insets.top + space[2] }]}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to your code" style={styles.round}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M15 5l-7 7 7 7" fill="none" stroke={colors.neutral[100]} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <BodyText size={15} weight="bold" color={colors.neutral[100]}>
          Scan a friend code
        </BodyText>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.round}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M6 6l12 12M18 6L6 18" stroke={colors.neutral[100]} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      {permission && !permission.granted ? (
        <View style={styles.permission}>
          <BodyText size={14} lineHeightRatio={1.5} color={colors.neutral[100]} style={styles.centered}>
            {permission.canAskAgain
              ? 'ParkPath needs the camera to scan a friend code.'
              : 'Camera access is off for ParkPath. You can turn it on in Settings.'}
          </BodyText>
          {permission.canAskAgain ? <Button label="Allow camera" onPress={requestPermission} /> : null}
        </View>
      ) : !found ? (
        // The frame to hold the code in.
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
          <BodyText size={13} weight="semibold" color={colors.neutral[100]} style={styles.centered}>
            Point at the code on your friend&apos;s phone
          </BodyText>
        </View>
      ) : null}

      {found || note ? (
        <View style={[styles.result, { marginBottom: insets.bottom + 14 }]}>
          {found ? (
            <View style={styles.who}>
              <Avatar
                person={{ id: found.username.length, email: '', username: found.username, first_name: found.name }}
                size={40}
              />
              <View style={styles.grow}>
                <BodyText size={16} weight="bold" numberOfLines={1}>
                  {found.name || `@${found.username}`}
                </BodyText>
                {found.name ? (
                  <BodyText size={12.5} weight="semibold" color={colors.neutral[600]}>
                    {`@${found.username}`}
                  </BodyText>
                ) : null}
              </View>
            </View>
          ) : null}
          {note ? (
            <BodyText size={12.5} weight="medium" color={note.ok ? colors.accent2Ramp[800] : colors.accentRamp[800]}>
              {note.text}
            </BodyText>
          ) : null}
          <View style={styles.actions}>
            {found && !sent ? (
              <>
                <Button label="Cancel" variant="secondary" onPress={scanAgain} />
                <Button label="Add friend" block onPress={add} loading={send.isPending} style={styles.grow} />
              </>
            ) : (
              <>
                <Button label="Scan another" variant="secondary" onPress={scanAgain} />
                <Button label="Done" block onPress={onClose} style={styles.grow} />
              </>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const FRAME = 236;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 30, 29, 0.32)',
  },
  card: {
    alignItems: 'center',
    gap: space[3],
    marginHorizontal: 14,
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.lg,
  },
  centered: {
    textAlign: 'center',
  },
  code: {
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: space[2],
    marginTop: space[1],
  },
  grow: {
    flex: 1,
  },
  scanner: {
    flex: 1,
    backgroundColor: '#14110f',
  },
  scanTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
  },
  round: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20, 17, 15, 0.5)',
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    paddingHorizontal: space[8],
  },
  frameWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
  },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: 'rgba(249, 244, 237, 0.9)',
  },
  result: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 0,
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.lg,
  },
});
