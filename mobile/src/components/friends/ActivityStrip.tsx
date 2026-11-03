/**
 * Activity, at the top of Friends: friends' comments on your trips,
 * newest first ("Maya commented on your Zion trip"), with ones that are
 * new since you last opened Friends marked. Tap one for that trip's
 * comments, to read them all and reply. Shows the latest few, with the
 * rest a tap away. Nothing at all until someone comments.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { displayName } from '../../api/friends';
import type { TripActivity } from '../../api/trips';
import { colors, radius, shadow, space } from '../../theme';
import { Avatar } from '../Avatar';
import { BodyText } from '../Typography';
import { postedAgo } from './FeedCard';

/** How many show before "Show all". */
const FIRST = 3;

export function ActivityStrip({
  items,
  newSince,
  onOpen,
}: {
  items: TripActivity[];
  /** Comments after this id are new; null = none are. */
  newSince: number | null;
  onOpen: (item: TripActivity) => void;
}) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, FIRST);
  const fresh = newSince === null ? 0 : items.filter((item) => item.id > newSince).length;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.label}>
          ACTIVITY ON YOUR TRIPS
        </BodyText>
        {fresh > 0 ? (
          <View style={styles.newCount}>
            <BodyText size={10.5} weight="bold" color={colors.neutral[100]}>
              {`${fresh} new`}
            </BodyText>
          </View>
        ) : null}
      </View>
      <View style={styles.card}>
        {shown.map((item, i) => {
          const isNew = newSince !== null && item.id > newSince;
          return (
            <Pressable
              key={item.id}
              onPress={() => onOpen(item)}
              accessibilityRole="button"
              accessibilityLabel={`${displayName(item.author)} commented on your ${item.park_name} trip: ${item.body}. Open the comments`}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.rowRule,
                isNew && styles.rowNew,
                pressed && styles.pressed,
              ]}
            >
              <Avatar person={item.author} size={36} />
              <View style={styles.grow}>
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
                {isNew ? <View style={styles.dot} /> : null}
              </View>
            </Pressable>
          );
        })}
        {items.length > FIRST ? (
          <Pressable
            onPress={() => setAll((open) => !open)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          >
            <BodyText size={12.5} weight="semibold" color={colors.accentRamp[700]}>
              {all ? 'Show fewer' : `Show all ${items.length}`}
            </BodyText>
          </Pressable>
        ) : null}
      </View>
    </View>
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
  grow: {
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
  more: {
    alignItems: 'center',
    paddingVertical: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[300],
  },
});
