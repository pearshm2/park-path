/**
 * A trip's comments, from a post in the feed: everyone's comments, oldest
 * first, and a field to add yours. You can delete your own comments, and
 * any on your own trip (long-press, or the × on one you can delete).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { addComment, deleteComment, fetchComments, type TripComment } from '../../api/comments';
import { displayName } from '../../api/friends';
import type { TripOut } from '../../api/trips';
import { useAuth } from '../../auth/AuthContext';
import { colors, fonts, radius, shadow, space } from '../../theme';
import { Avatar } from '../Avatar';
import { BodyText, Heading } from '../Typography';
import { postedAgo } from './FeedCard';

export function CommentsSheet({ trip, onClose }: { trip: TripOut; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const comments = useQuery({
    queryKey: ['comments', trip.id],
    queryFn: () => fetchComments(token!, trip.id),
    enabled: !!token,
  });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['comments', trip.id] }),
      queryClient.invalidateQueries({ queryKey: ['feed'] }),
    ]);
  const post = useMutation({
    mutationFn: (body: string) => addComment(token!, trip.id, body),
    onSuccess: () => {
      setDraft('');
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteComment(token!, trip.id, id),
    onSettled: refresh,
  });

  const mine = user?.id === trip.owner.id;
  function canDelete(c: TripComment) {
    return mine || c.author.id === user?.id;
  }
  function confirmDelete(c: TripComment) {
    if (!canDelete(c)) return;
    Alert.alert('Delete this comment?', c.body, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(c.id) },
    ]);
  }
  function send() {
    const body = draft.trim();
    if (body && !post.isPending) post.mutate(body);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Android resizes the modal's window for the keyboard itself, so
          'height' here moved the sheet a second time and it bounced up and
          down while typing. Same as the app's other sheets. */}
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close comments" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space[3] }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Heading size={19} style={styles.grow} numberOfLines={1}>
              {trip.title || trip.park_name}
            </Heading>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path d="M6 6l12 12M18 6L6 18" stroke={colors.neutral[800]} strokeWidth={2.6} strokeLinecap="round" />
              </Svg>
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            {comments.isPending ? (
              <ActivityIndicator color={colors.accent} style={styles.loading} />
            ) : comments.isError ? (
              <BodyText size={13} color={colors.accentRamp[800]}>
                Couldn&apos;t load the comments. Check your connection and try again.
              </BodyText>
            ) : comments.data.length === 0 ? (
              <BodyText size={13} color={colors.neutral[600]} style={styles.empty}>
                {`No comments yet. Say something nice to ${mine ? 'yourself' : displayName(trip.owner).split(' ')[0]}!`}
              </BodyText>
            ) : (
              comments.data.map((c) => (
                <Pressable
                  key={c.id}
                  onLongPress={() => confirmDelete(c)}
                  delayLongPress={350}
                  style={styles.comment}
                  accessibilityHint={canDelete(c) ? 'Long-press to delete' : undefined}
                >
                  <Avatar person={c.author} size={34} />
                  <View style={styles.grow}>
                    <View style={styles.commentHead}>
                      <BodyText size={13} weight="bold" numberOfLines={1} style={styles.shrink}>
                        {displayName(c.author)}
                      </BodyText>
                      <BodyText size={11} color={colors.neutral[600]}>
                        {postedAgo(c.created_at)}
                      </BodyText>
                    </View>
                    <BodyText size={13.5} lineHeightRatio={1.45} color={colors.neutral[800]}>
                      {c.body}
                    </BodyText>
                  </View>
                  {canDelete(c) ? (
                    <Pressable
                      onPress={() => confirmDelete(c)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Delete comment"
                    >
                      <Svg width={12} height={12} viewBox="0 0 24 24">
                        <Path d="M6 6l12 12M18 6L6 18" stroke={colors.neutral[500]} strokeWidth={2.6} strokeLinecap="round" />
                      </Svg>
                    </Pressable>
                  ) : null}
                </Pressable>
              ))
            )}
          </ScrollView>

          {post.isError ? (
            <BodyText size={12} color={colors.accentRamp[800]} style={styles.error}>
              {post.error.message}
            </BodyText>
          ) : null}
          <View style={styles.composer}>
            {user ? <Avatar person={user} size={32} /> : null}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment…"
              placeholderTextColor={colors.neutral[500]}
              multiline
              maxLength={1000}
              style={styles.input}
              accessibilityLabel="Add a comment"
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim() || post.isPending}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              style={({ pressed }) => [styles.send, (!draft.trim() || post.isPending) && styles.sendOff, pressed && styles.sendPressed]}
            >
              {post.isPending ? (
                <ActivityIndicator color={colors.neutral[100]} size="small" />
              ) : (
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path d="M4 12l16-8-6 16-2.5-6.5z" fill={colors.neutral[100]} />
                </Svg>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
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
    ...shadow.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
    marginBottom: space[2],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingBottom: space[2],
  },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  grow: {
    flex: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: space[3],
    paddingVertical: space[2],
  },
  loading: {
    marginVertical: space[6],
  },
  empty: {
    textAlign: 'center',
    marginVertical: space[6],
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
  },
  error: {
    marginTop: space[1],
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[2],
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  input: {
    flex: 1,
    maxHeight: 110,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    borderRadius: 20,
    backgroundColor: colors.neutral[200],
    color: colors.neutral[900],
    fontFamily: fonts.body,
    fontSize: 14,
  },
  send: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  sendOff: {
    opacity: 0.45,
  },
  sendPressed: {
    backgroundColor: colors.accentRamp[600],
  },
});
