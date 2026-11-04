/**
 * Activity on your trips, at the top of Friends: friends' comments on your
 * trips. The strip keeps short: at most a few rows, unread first, then the
 * week's read ones (friends/activity.ts, stripItems); "See all" opens every
 * comment (ActivityPage). Unread ones are marked until their trip's
 * comments are opened. Tap one for those comments, to read and reply.
 * Nothing at all until someone comments.
 */

import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { displayName } from '../../api/friends';
import type { TripActivity } from '../../api/trips';
import { colors, radius, shadow, space } from '../../theme';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { BodyText, Heading } from '../Typography';
import { postedAgo } from './FeedCard';

export function ActivityStrip({
  items,
  total,
  unread,
  isRead,
  onOpen,
  onSeeAll,
}: {
  /** The rows to show (already cut down). */
  items: TripActivity[];
  /** How many comments there are in all. */
  total: number;
  /** How many are unread. */
  unread: number;
  isRead: (item: TripActivity) => boolean;
  onOpen: (item: TripActivity) => void;
  onSeeAll: () => void;
}) {
  if (total === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.label}>
          ACTIVITY ON YOUR TRIPS
        </BodyText>
        {unread > 0 ? (
          <View style={styles.newCount}>
            <BodyText size={10.5} weight="bold" color={colors.neutral[100]}>
              {`${unread} new`}
            </BodyText>
          </View>
        ) : null}
        <View style={styles.grow} />
        <Pressable onPress={onSeeAll} hitSlop={10} accessibilityRole="button">
          <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
            {`See all ${total} ›`}
          </BodyText>
        </Pressable>
      </View>
      {items.length > 0 ? (
        <View style={styles.card}>
          {items.map((item, i) => (
            <ActivityRow key={item.id} item={item} unread={!isRead(item)} first={i === 0} onOpen={onOpen} />
          ))}
        </View>
      ) : (
        <BodyText size={12.5} color={colors.neutral[600]}>
          All caught up. Older comments are under See all.
        </BodyText>
      )}
    </View>
  );
}

/** Every comment on your trips, full screen, with "Mark all as read". */
export function ActivityPage({
  items,
  isRead,
  onOpen,
  onMarkAllRead,
  onClose,
}: {
  items: TripActivity[];
  isRead: (item: TripActivity) => boolean;
  onOpen: (item: TripActivity) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const unread = items.filter((item) => !isRead(item)).length;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.page, { paddingTop: insets.top + space[3] }]}>
        <View style={styles.pageHead}>
          <Heading size={24} style={styles.grow}>
            Activity
          </Heading>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M6 6l12 12M18 6L6 18" stroke={colors.neutral[800]} strokeWidth={2.6} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>
        <BodyText size={12.5} color={colors.neutral[600]} style={styles.pageNote}>
          {unread > 0
            ? `${unread} unread · Opening a trip's comments marks them read.`
            : "Friends' comments on your trips. You're all caught up."}
        </BodyText>
        {unread > 0 ? (
          <Button label="Mark all as read" variant="secondary" onPress={onMarkAllRead} style={styles.markAll} />
        ) : null}
        <ScrollView contentContainerStyle={[styles.pageList, { paddingBottom: insets.bottom + space[6] }]}>
          <View style={styles.card}>
            {items.map((item, i) => (
              <ActivityRow key={item.id} item={item} unread={!isRead(item)} first={i === 0} onOpen={onOpen} />
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ActivityRow({
  item,
  unread,
  first,
  onOpen,
}: {
  item: TripActivity;
  unread: boolean;
  first: boolean;
  onOpen: (item: TripActivity) => void;
}) {
  return (
    <Pressable
      onPress={() => onOpen(item)}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'New. ' : ''}${displayName(item.author)} commented on your ${item.park_name} trip: ${item.body}. Open the comments`}
      style={({ pressed }) => [styles.row, !first && styles.rowRule, unread && styles.rowNew, pressed && styles.pressed]}
    >
      <Avatar person={item.author} size={36} />
      <View style={styles.text}>
        <BodyText size={13} lineHeightRatio={1.4} numberOfLines={2}>
          <BodyText size={13} weight="bold">
            {displayName(item.author)}
          </BodyText>
          {' commented on your '}
          <BodyText size={13} weight="bold">
            {item.park_name}
          </BodyText>
          {' trip'}
        </BodyText>
        <BodyText size={12.5} lineHeightRatio={1.4} color={colors.neutral[700]} numberOfLines={2}>
          {`“${item.body}”`}
        </BodyText>
      </View>
      <View style={styles.side}>
        <BodyText size={11} color={colors.neutral[600]}>
          {postedAgo(item.created_at)}
        </BodyText>
        {unread ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space[2],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  label: {
    letterSpacing: 1.2,
  },
  grow: {
    flex: 1,
  },
  newCount: {
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    padding: space[3],
  },
  rowRule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[300],
  },
  rowNew: {
    backgroundColor: colors.accentRamp[100],
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  side: {
    alignItems: 'flex-end',
    gap: space[2],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  page: {
    flex: 1,
    paddingHorizontal: space[4],
    backgroundColor: colors.bg,
  },
  pageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  pageNote: {
    marginTop: space[1],
  },
  markAll: {
    alignSelf: 'flex-start',
    marginTop: space[3],
  },
  pageList: {
    paddingTop: space[4],
  },
  close: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
});
