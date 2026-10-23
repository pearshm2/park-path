/**
 * One journal entry in Trips, as a memory bubble: a round photo (yours, or
 * the park's without one) with the park, the entry's title and date over
 * it, and nothing else. The rest of the entry plays in Relive.
 *
 * The bubbles zigzag: each sits out to its own side, alternately right and
 * left down the list (the second bubble right, the third left, ...), and
 * slides in from that side to the centre as it reaches the middle. The one
 * in the middle is full size and sharp; the rest are much smaller,
 * blurred, with their edge dissolving into the page, so the memories you
 * aren't on look half-remembered. All of it follows the list's scroll on
 * the UI thread.
 *
 * Tapping a bubble brings it to the middle; tapping the one in the middle,
 * or its play button, dives into it (Trips grows it to fill the screen and
 * opens Relive for just that trip); the dots open its options. A trip with
 * a passport-book stamp photo has a "Stamped in person" tag over its park
 * name, which opens the photo.
 *
 * A bubble is taller than its row, spilling into its neighbours', and
 * Android only takes touches inside a view's own bounds. So the buttons
 * sit well inside the row (more than ROW_SPILL from the bubble's top and
 * bottom), where they can be pressed.
 */

import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { Site } from '../../data/parks';
import { colors, HEADING_LINE_HEIGHT_RATIO, radius, shadow, space } from '../../theme';
import type { DiveRect } from './DiveIn';
import { dateLabel, leadPhoto, type TripEntry } from '../../trips/TripsContext';
import { PassportTag } from './PassportPage';
import { TerrainIcon, terrainTone } from '../TerrainIcon';
import { BodyText, Heading } from '../Typography';

/** How small a bubble gets away from the middle. */
const AWAY_SCALE = 0.46;

/** How far (a share of a row) the bubbles two or more away are drawn in
 *  towards the middle, so the next-but-one is in view. */
const PULL_IN = 0.3;

/** Keep the buttons this far (a share of the bubble) from its top and
 *  bottom, inside the row's bounds; see above. Trips' rows are 0.72 of
 *  the bubble, so 0.14 of it spills each way. */
const ROW_SPILL = 0.14;

/** The play button's size, and its gap above. */
const PLAY_SIZE = 48;

/**
 * The centres of the bubble's park name, title and date on screen, for
 * Relive to start them from when it's dived into. Worked out from the
 * layout below (they sit at the bubble's foot, over the play button), with
 * the title's line count estimated from its length.
 */
export function bubbleWordCentres(rect: DiveRect, title: string, textScale: number) {
  const d = rect.size;
  const x = rect.x + d / 2;
  const bottom = rect.y + d - d * (ROW_SPILL + 0.05);
  const dateBottom = bottom - PLAY_SIZE - space[2];
  const dateHeight = 13 * textScale * 1.55;
  const titleBottom = dateBottom - dateHeight - 4;
  const lineHeight = 22 * textScale * HEADING_LINE_HEIGHT_RATIO;
  const perLine = (d * 0.7) / (22 * textScale * 0.56);
  const lines = Math.min(2, Math.max(1, Math.ceil(title.length / perLine)));
  const titleTop = titleBottom - lines * lineHeight;
  return {
    park: { x, y: titleTop - 3 - (11 * textScale * 1.55) / 2 },
    title: { x, y: titleBottom - (lines * lineHeight) / 2 },
    date: { x, y: dateBottom - dateHeight / 2 },
  };
}

const ON_PHOTO = colors.neutral[100];

export function MemoryBubble({
  entry,
  site,
  index,
  height,
  diameter,
  swing,
  focused,
  scrollY,
  onFocus,
  onPlay,
  onOptions,
  onPassportStamp,
}: {
  entry: TripEntry;
  /** The park, once the site list has loaded. */
  site: Site | undefined;
  index: number;
  /** The row's height: the distance between bubbles in the list. */
  height: number;
  /** The bubble's size in the middle. */
  diameter: number;
  /** How far a bubble away from the middle sits out to its side. */
  swing: number;
  /** The bubble the list has settled on: only it has the buttons. */
  focused: boolean;
  scrollY: SharedValue<number>;
  onFocus: () => void;
  /** Dive in (only the bubble in the middle offers it). */
  onPlay: () => void;
  onOptions: () => void;
  /** Open the trip's passport-book stamp photo. */
  onPassportStamp: () => void;
}) {
  // How far this row is from the middle, in rows (0 = in focus).
  const away = (y: number) => {
    'worklet';
    return Math.min(Math.abs(y / height - index), 1.5);
  };
  // Odd rows sit to the right, even rows to the left.
  const side = index % 2 === 1 ? 1 : -1;
  const bubbleStyle = useAnimatedStyle(() => {
    const a = away(scrollY.value);
    return {
      transform: [
        { translateX: interpolate(a, [0, 1], [0, side * swing], Extrapolation.CLAMP) },
        {
          // Rows below the middle are drawn up, rows above drawn down.
          translateY:
            -Math.sign(index - scrollY.value / height) *
            height *
            PULL_IN *
            interpolate(a, [1, 1.5], [0, 1], Extrapolation.CLAMP),
        },
        { scale: interpolate(a, [0, 1], [1, AWAY_SCALE], Extrapolation.CLAMP) },
      ],
    };
  });
  const hazeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(away(scrollY.value), [0, 0.6], [0, 1], Extrapolation.CLAMP),
  }));
  // A bubble scrolled past goes up behind Trips' header; its words fade so
  // they don't tangle with the header's. The ones still to come keep theirs.
  const wordsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value / height - index, [0.3, 0.8], [1, 0], Extrapolation.CLAMP),
  }));
  const controlsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(away(scrollY.value), [0, 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  const tone = terrainTone(site?.group ?? null);
  const photo = leadPhoto(entry) ?? site?.imageUrl ?? null;

  return (
    <View style={[styles.row, { height }]}>
      <Animated.View style={[styles.wrap, { width: diameter, height: diameter }, bubbleStyle]}>
        <Pressable
          onPress={focused ? onPlay : onFocus}
          accessibilityRole="button"
          accessibilityLabel={`${entry.title}, ${dateLabel(entry.date)}`}
          style={[styles.bubble, { backgroundColor: tone.band }]}
        >
          {photo ? (
            <>
              <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
              {/* The hazy version, faded in as the bubble leaves the middle. */}
              <Animated.View style={[StyleSheet.absoluteFill, hazeStyle]} pointerEvents="none">
                <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={14} />
              </Animated.View>
            </>
          ) : site?.group ? (
            <TerrainIcon group={site.group} size={diameter * 0.3} />
          ) : null}

          {/* Darkens the lower half so the title reads over any photo. */}
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
            <Defs>
              <LinearGradient id={`shade-${entry.id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.4" stopColor="#14110f" stopOpacity={0} />
                <Stop offset="1" stopColor="#14110f" stopOpacity={0.72} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="1" height="1" fill={`url(#shade-${entry.id})`} />
          </Svg>

          <Animated.View
            style={[
              styles.words,
              { paddingHorizontal: diameter * 0.15, bottom: diameter * (ROW_SPILL + 0.05) },
              wordsStyle,
            ]}
          >
            {entry.passportStamp ? (
              <Animated.View style={[styles.tagSlot, controlsStyle]} pointerEvents={focused ? 'auto' : 'none'}>
                <PassportTag onPress={onPassportStamp} />
              </Animated.View>
            ) : null}
            <BodyText size={11} weight="bold" color={ON_PHOTO} style={styles.park} numberOfLines={1}>
              {(site?.name ?? entry.siteId).toUpperCase()}
            </BodyText>
            <Heading size={22} color={ON_PHOTO} style={styles.title} numberOfLines={2}>
              {entry.title}
            </Heading>
            <BodyText size={13} weight="semibold" color={ON_PHOTO} style={styles.date}>
              {dateLabel(entry.date)}
            </BodyText>
            <Animated.View style={[styles.reliveSlot, controlsStyle]} pointerEvents={focused ? 'auto' : 'none'}>
              <Pressable
                onPress={onPlay}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Relive ${entry.title}`}
                style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path d="M8 5.5v13l10.5-6.5z" fill={colors.neutral[100]} />
                </Svg>
              </Pressable>
            </Animated.View>
          </Animated.View>

          {/* The edge dissolving into the page. */}
          <Animated.View style={[StyleSheet.absoluteFill, hazeStyle]} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id={`haze-${entry.id}`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                  <Stop offset="0.5" stopColor={colors.bg} stopOpacity={0} />
                  <Stop offset="0.82" stopColor={colors.bg} stopOpacity={0.6} />
                  <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100" height="100" fill={`url(#haze-${entry.id})`} />
            </Svg>
          </Animated.View>
        </Pressable>

        <Animated.View
          style={[
            styles.options,
            { top: diameter * (ROW_SPILL + 0.05), right: diameter * (ROW_SPILL + 0.05) },
            controlsStyle,
          ]}
          pointerEvents={focused ? 'auto' : 'none'}
        >
          <Pressable
            onPress={onOptions}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${entry.title}`}
            style={({ pressed }) => [styles.optionsButton, pressed && styles.optionsPressed]}
          >
            <MoreIcon />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
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
  // Shorter than the bubble: neighbours overlap its band, out to their side.
  row: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  wrap: {
    ...shadow.md,
    borderRadius: radius.pill,
    // Android only draws a shadow under something with a background.
    backgroundColor: colors.bg,
  },
  bubble: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  words: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  park: {
    alignSelf: 'stretch',
    textAlign: 'center',
    letterSpacing: 1.1,
    marginBottom: 3,
    opacity: 0.92,
  },
  // Full width, and without the heading's tightened letter spacing:
  // Android measures this font's tightened titles differently from how it
  // draws them, clipping a second line or leaving room for one that isn't
  // there.
  title: {
    alignSelf: 'stretch',
    textAlign: 'center',
    letterSpacing: 0,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowRadius: 6,
  },
  date: {
    marginTop: 4,
    opacity: 0.9,
  },
  options: {
    position: 'absolute',
  },
  optionsButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(249, 244, 237, 0.9)',
  },
  optionsPressed: {
    backgroundColor: colors.neutral[300],
  },
  tagSlot: {
    marginBottom: space[2],
  },
  reliveSlot: {
    marginTop: space[2],
  },
  play: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2.5,
    borderColor: 'rgba(249, 244, 237, 0.85)',
    backgroundColor: colors.accent,
    ...shadow.sm,
  },
  playPressed: {
    backgroundColor: colors.accentRamp[600],
  },
});
