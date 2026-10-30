/**
 * One post in the Friends feed: a trip a friend shared with friends. Who
 * went (tap them for their passport), the park and when, their own photos
 * (swipe through them; each with its caption), the title, stars, notes,
 * trails, how it went (feedback tags), who they went with, and a button
 * to read and add comments.
 *
 * Their own photos always come first; a trip without any shows the park's
 * own photo instead (and one without that either is a post of words). A
 * photo of their passport stamp, if they added one, is the last slide.
 */

import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { displayName, firstName, handle } from '../../api/friends';
import type { TripOut } from '../../api/trips';
import type { Site } from '../../data/parks';
import { colors, radius, shadow, space } from '../../theme';
import { dateLabel } from '../../trips/TripsContext';
import { cleanFeedback, feedbackLabel, isGood } from '../../trips/feedback';
import { Avatar } from '../Avatar';
import { terrainTone } from '../TerrainIcon';
import { PinIcon, StarIcon } from '../trips/NewEntrySheet';
import { BodyText, Heading } from '../Typography';

/** "just now", "5m", "3h", "2d", or the date for anything older. */
export function postedAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 60 * 24 * 7) return `${Math.round(minutes / (60 * 24))}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function FeedCard({
  trip,
  site,
  onOwner,
  onComments,
}: {
  trip: TripOut;
  /** The park, once the site list has loaded. */
  site: Site | undefined;
  /** Open the poster's passport. */
  onOwner: () => void;
  /** Open the trip's comments. */
  onComments: () => void;
}) {
  // Their own photos that have reached the server; without any, the
  // park's photo stands in.
  const own = trip.photos.filter((p) => p.kind === 'photo' && p.url);
  const stamp = trip.stamp_photo?.url
    ? [{ key: 'stamp', url: trip.stamp_photo.url, caption: '', stamp: true }]
    : [];
  const shots: { key: string; url: string | null; caption: string; stamp?: boolean }[] = [
    ...(own.length > 0
      ? own
      : site?.imageUrl
        ? [{ key: 'park', url: site.imageUrl, caption: '' }]
        : []),
    ...stamp,
  ];
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState(0);
  const caption = shots[at]?.caption.trim() ?? '';
  const tone = terrainTone(site?.group ?? null);
  const notes = trip.notes.trim();
  const company = trip.companions.map((p) => firstName(p));
  const feedback = cleanFeedback(trip.feedback);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOwner}
        accessibilityRole="button"
        accessibilityLabel={`${displayName(trip.owner)}'s passport`}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <Avatar person={trip.owner} size={38} />
        <View style={styles.headText}>
          <BodyText size={14} weight="bold" numberOfLines={1}>
            {displayName(trip.owner)}
          </BodyText>
          <BodyText size={11.5} weight="medium" color={colors.neutral[600]} numberOfLines={1}>
            {`${handle(trip.owner)} · ${postedAgo(trip.created_at)}`}
          </BodyText>
        </View>
      </Pressable>

      {shots.length > 0 ? (
        <View style={[styles.photo, { backgroundColor: tone.band }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => width && setAt(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {shots.map((shot) => (
              <Image
                key={shot.key}
                source={{ uri: shot.url! }}
                style={{ width, height: PHOTO_HEIGHT }}
                // The whole stamp, never cropped.
                contentFit={shot.stamp ? 'contain' : 'cover'}
                transition={250}
                accessibilityLabel={
                  shot.stamp ? `Passport stamp from ${trip.park_name}` : shot.caption || `Photo from ${trip.park_name}`
                }
              />
            ))}
          </ScrollView>
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
            <Defs>
              <LinearGradient id={`feed-${trip.id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.45" stopColor="#14110f" stopOpacity={0} />
                <Stop offset="1" stopColor="#14110f" stopOpacity={0.7} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="1" height="1" fill={`url(#feed-${trip.id})`} />
          </Svg>
          <View style={styles.photoWords} pointerEvents="none">
            <BodyText size={11} weight="bold" color={colors.neutral[100]} style={styles.park} numberOfLines={1}>
              {trip.park_name.toUpperCase()}
            </BodyText>
            <BodyText size={12.5} weight="semibold" color={colors.neutral[100]}>
              {dateLabel(trip.visited_on)}
            </BodyText>
          </View>
          {shots[at]?.stamp ? (
            <View style={styles.stampTag} pointerEvents="none">
              <BodyText size={11} weight="bold" color={colors.neutral[100]} style={styles.park}>
                PASSPORT STAMP
              </BodyText>
            </View>
          ) : null}
          {shots.length > 1 ? (
            <View style={styles.dots} pointerEvents="none">
              {shots.map((shot, i) => (
                <View key={shot.key} style={[styles.dot, i === at && styles.dotOn]} />
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        // No photo at all: the park and date as a line instead.
        <View style={styles.place}>
          <PinIcon />
          <BodyText size={12} weight="bold" color={colors.accentRamp[800]} style={styles.placeName} numberOfLines={1}>
            {trip.park_name.toUpperCase()}
          </BodyText>
          <BodyText size={12} weight="semibold" color={colors.neutral[600]}>
            {dateLabel(trip.visited_on)}
          </BodyText>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Heading size={19} style={styles.title} numberOfLines={2}>
            {trip.title || trip.park_name}
          </Heading>
          {trip.rating ? (
            <View style={styles.stars} accessibilityLabel={`${trip.rating} of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <StarIcon key={n} filled={n <= trip.rating!} size={14} />
              ))}
            </View>
          ) : null}
        </View>
        {notes ? (
          <BodyText size={13.5} lineHeightRatio={1.5} color={colors.neutral[800]} numberOfLines={4}>
            {notes}
          </BodyText>
        ) : null}
        {caption ? (
          <BodyText size={12.5} lineHeightRatio={1.45} color={colors.neutral[600]} numberOfLines={2}>
            {`“${caption}”`}
          </BodyText>
        ) : null}
        {trip.trails.length > 0 ? (
          <View style={styles.trails}>
            {trip.trails.map((name) => (
              <View key={name} style={styles.trail}>
                <PinIcon />
                <BodyText size={11.5} weight="semibold" color={colors.neutral[800]}>
                  {name}
                </BodyText>
              </View>
            ))}
          </View>
        ) : null}
        {feedback.length > 0 ? (
          <View style={styles.trails} accessibilityLabel={`How it was: ${feedback.map(feedbackLabel).join(', ')}`}>
            {feedback.map((tag) => (
              <View key={tag} style={[styles.feedback, isGood(tag) ? styles.feedbackGood : styles.feedbackBad]}>
                <BodyText
                  size={11.5}
                  weight="semibold"
                  color={isGood(tag) ? colors.accentRamp[800] : colors.neutral[800]}
                >
                  {feedbackLabel(tag)}
                </BodyText>
              </View>
            ))}
          </View>
        ) : null}
        {company.length > 0 ? (
          <BodyText size={12} weight="medium" color={colors.neutral[600]}>
            {`With ${company.join(', ')}`}
          </BodyText>
        ) : null}
      </View>
      <Pressable
        onPress={onComments}
        accessibilityRole="button"
        accessibilityLabel={trip.comment_count ? `${trip.comment_count} comments` : 'Comment'}
        style={({ pressed }) => [styles.footer, pressed && styles.footerPressed]}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path
            d="M4 5h16v11H9l-5 4z"
            fill="none"
            stroke={colors.accentRamp[700]}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
        <BodyText size={13} weight="semibold" color={colors.accentRamp[800]}>
          {trip.comment_count
            ? `${trip.comment_count} ${trip.comment_count === 1 ? 'comment' : 'comments'}`
            : 'Comment'}
        </BodyText>
      </Pressable>
    </View>
  );
}

const PHOTO_HEIGHT = 220;

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  footerPressed: {
    backgroundColor: colors.neutral[200],
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
    ...shadow.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
  },
  headText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  photo: {
    height: PHOTO_HEIGHT,
  },
  stampTag: {
    position: 'absolute',
    top: space[3],
    left: space[3],
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20, 17, 15, 0.55)',
  },
  dots: {
    position: 'absolute',
    right: space[3],
    bottom: space[3] + 4,
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(249, 244, 237, 0.5)',
  },
  dotOn: {
    backgroundColor: colors.neutral[100],
  },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: space[3],
    paddingTop: space[1],
  },
  placeName: {
    flexShrink: 1,
    letterSpacing: 1,
  },
  photoWords: {
    position: 'absolute',
    left: space[3],
    right: space[3],
    bottom: space[3],
  },
  park: {
    letterSpacing: 1.1,
    opacity: 0.92,
  },
  body: {
    gap: space[2],
    padding: space[3],
    paddingTop: space[3],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
  },
  title: {
    flex: 1,
    letterSpacing: 0,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
    marginTop: 5,
  },
  trails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  feedback: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  feedbackGood: {
    backgroundColor: colors.accentRamp[100],
    borderColor: colors.accentRamp[300],
  },
  feedbackBad: {
    borderColor: colors.neutral[400],
    borderStyle: 'dashed',
  },
  trail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
});
