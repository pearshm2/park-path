/**
 * One journal entry in the Trips rail, as in the prototype: its lead photo
 * (or the park's terrain colour without one), the park and month, the
 * title and notes, then tags for the region, the park's feature, how many
 * photos and who was there.
 *
 * Cards either side of the centred one turn away a little in 3D, shrink
 * and fade, following the rail's scroll position as you swipe.
 */

import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { displayName } from '../../api/friends';
import type { Site } from '../../data/parks';
import { regionForState } from '../../data/regions';
import { colors, radius, shadow, space } from '../../theme';
import { monthLabel, type TripEntry } from '../../trips/TripsContext';
import { Tag } from '../Tag';
import { TerrainIcon, terrainTone } from '../TerrainIcon';
import { BodyText, Heading } from '../Typography';

export const MEDIA_HEIGHT = 150;

export function TripCard({
  entry,
  site,
  index,
  interval,
  width,
  scrollX,
  onDelete,
}: {
  entry: TripEntry;
  /** The park, once the site list has loaded. */
  site: Site | undefined;
  index: number;
  /** Distance between cards' starts in the rail. */
  interval: number;
  width: number;
  scrollX: SharedValue<number>;
  onDelete: () => void;
}) {
  // How far this card is from the centre, in cards (0 = centred).
  const tilt = useAnimatedStyle(() => {
    const offset = scrollX.value / interval - index;
    const away = Math.min(Math.abs(offset), 2);
    return {
      opacity: interpolate(away, [0, 1], [1, 0.7], Extrapolation.CLAMP),
      transform: [
        { perspective: 900 },
        { rotateY: `${interpolate(offset, [-2, 2], [-30, 30], Extrapolation.CLAMP)}deg` },
        { scale: 1 - away * 0.07 },
      ],
    };
  });

  const tone = terrainTone(site?.group ?? null);
  const region = site ? regionForState(site.state) : undefined;
  const lead = entry.photos[0];

  return (
    <Animated.View style={[styles.card, { width }, tilt]}>
      <View style={[styles.media, { backgroundColor: tone.band }]}>
        {lead ? (
          <Image source={{ uri: lead }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : site?.group ? (
          <TerrainIcon group={site.group} size={48} />
        ) : null}
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${entry.title}`}
          style={({ pressed }) => [styles.menu, pressed && styles.menuPressed]}
        >
          <MoreIcon />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.topLine}>
          <BodyText
            size={11}
            weight="semibold"
            color={colors.accentRamp[700]}
            style={styles.park}
            numberOfLines={1}
          >
            {(site?.name ?? entry.siteId).toUpperCase()}
          </BodyText>
          <BodyText size={11.5} weight="medium" color={colors.neutral[600]}>
            {monthLabel(entry.date)}
          </BodyText>
        </View>
        <Heading size={19} style={styles.title} numberOfLines={2}>
          {entry.title}
        </Heading>
        <BodyText
          size={13.5}
          lineHeightRatio={1.5}
          color={colors.neutral[800]}
          numberOfLines={4}
          style={styles.notes}
        >
          {entry.notes || 'No notes yet.'}
        </BodyText>
        <View style={styles.tags}>
          {region ? <Tag tone="neutral" label={region.label} /> : null}
          {site?.feature ? <Tag tone="outline" label={site.feature} /> : null}
          {entry.photos.length > 0 ? (
            <Tag
              tone="accent"
              label={`${entry.photos.length} ${entry.photos.length === 1 ? 'photo' : 'photos'}`}
            />
          ) : null}
          {entry.with.length > 0 ? (
            <Tag
              tone="accent2"
              label={`With ${entry.with.map((p) => displayName(p.email).split(' ')[0]).join(', ')}`}
            />
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

/** Three dots, for the entry's options. */
function MoreIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      {[5, 12, 19].map((cx) => (
        <Circle key={cx} cx={cx} cy={12} r={2.2} fill={colors.neutral[800]} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
    ...shadow.md,
  },
  media: {
    height: MEDIA_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    top: space[2],
    right: space[2],
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(249, 244, 237, 0.9)',
  },
  menuPressed: {
    backgroundColor: colors.neutral[300],
  },
  body: {
    padding: space[4],
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
  park: {
    flexShrink: 1,
    letterSpacing: 1,
  },
  title: {
    marginTop: space[2],
  },
  notes: {
    marginTop: space[2],
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: space[3],
  },
});
