/**
 * Relive: your trips played back as a story, oldest first, the way photo
 * apps play back memories.
 *
 * Each trip opens on a title card over the park's own photo, blurred (the
 * park, the date, and, for a national park, its stamp pressing down;
 * tapping the stamp opens that park in Passport), then the photo of its
 * passport-book stamp if
 * you added one, pasted onto a passport page, then its photos and videos
 * full screen, each
 * with its own caption, and the trip's notes and trails over the first.
 * Photos slowly pan and zoom; videos play through once. Trips without any
 * use the park's photo. A trip with stars or feedback tags closes on a
 * "How it was" page: the stars, then each tag stamped down like a rubber
 * stamp. It ends on a summary of the journey so far.
 *
 * Tap the right side for the next slide, the left for the previous; hold
 * to pause. The bars along the top are the current trip's slides.
 *
 * It opens with no transition of its own (see app/_layout.tsx). Dived into
 * from a memory bubble (`dive`, the bubble's place on screen), it starts
 * over Trips as that bubble: the circle grows into the first slide's
 * background while the bubble's words slide to their places on it
 * (components/trips/DiveIn.tsx). Otherwise it fades in.
 *
 * Opened from Trips: `only` plays just that entry (a memory bubble's play
 * button), at your own pace: its photos hold still, and though the bars
 * still fill, nothing moves on until you tap the right side. It closes
 * after the last slide, with no summary.
 */

import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { listSites } from '../api/parks';
import { BodyText, Button, Heading } from '../components';
import { WaxSeal } from '../components/passport/WaxSeal';
import { playSound, tap } from '../lib/sounds';
import { terrainTone } from '../components/TerrainIcon';
import { bubbleWordCentres } from '../components/trips/MemoryBubble';
import { firstName } from '../api/friends';
import { DIVE_MS, DiveBackground, parseDive, type DiveRect } from '../components/trips/DiveIn';
import { PassportPage } from '../components/trips/PassportPage';
import { PinIcon, StarIcon } from '../components/trips/NewEntrySheet';
import type { Site } from '../data/parks';
import { regionForState } from '../data/regions';
import { colors, radius, space, useTextScale } from '../theme';
import { cleanFeedback, feedbackLabel, isGood } from '../trips/feedback';
import {
  dateLabel,
  leadPhoto,
  monthLabel,
  useTrips,
  type TripEntry,
  type TripMedia,
} from '../trips/TripsContext';

/** How long each kind of slide shows, in ms. */
const TITLE_MS = 3500;
const PHOTO_MS = 6000;
/** Extra room under a slide's words for the "Tap to continue" hint. */
const HINT_ROOM = 52;
/** A video's slide, when its length isn't known. */
const VIDEO_MS = 15000;

type TripSlide = {
  /** Which trip, 0-based, oldest first. */
  trip: number;
  entry: TripEntry;
  site: Site | undefined;
  image: string | null;
};

type Slide =
  | (TripSlide & { kind: 'title' })
  /** The trip's passport-book stamp photo; `image` is the photo. */
  | (TripSlide & { kind: 'souvenir'; backdrop: string | null })
  /** How it was: the stars and feedback tags, over the park's photo (`image`). */
  | (TripSlide & { kind: 'review' })
  | (TripSlide & {
      kind: 'media';
      /** The photo or video; null when the park's photo stands in. */
      media: TripMedia | null;
      /** The trip's notes and trails go on its first slide only. */
      first: boolean;
      drift: 1 | -1;
    })
  | { kind: 'end' };

const INK = '#14110f';
/** The park's wax seal on the opening slide. */
const STAMP_SIZE = 124;
/** How long the seal's press takes, and when in it the seal hits (0 to 1). */
const PRESS_MS = 640;
const HIT = 0.5;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ON_INK = colors.neutral[100];
const ON_INK_SOFT = 'rgba(249, 244, 237, 0.78)';

export default function ReliveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { only, dive } = useLocalSearchParams<{ only?: string; dive?: string }>();
  // A light status bar while Relive is in view, dark again the moment it
  // isn't, however it's left.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );
  // Dived into: the dive plays out over Trips (see TitleSlide), and the
  // screen's dark ground comes in once it's covered. Otherwise fade in.
  const [diveRect] = useState<DiveRect | null>(() => parseDive(dive));
  const diving = useSharedValue(diveRect ? 0 : 1);
  const [dived, setDived] = useState(!diveRect);
  const shown = useSharedValue(diveRect ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(1, { duration: 280 });
    if (diveRect) {
      diving.value = withTiming(1, { duration: DIVE_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(setDived, true);
      });
    }
    // Once, as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fadeIn = useAnimatedStyle(() => ({ opacity: shown.value }));
  // The bars and close button arrive as the dive finishes.
  const chromeIn = useAnimatedStyle(() => ({
    opacity: interpolate(diving.value, [0.6, 1], [0, 1], 'clamp'),
  }));
  const { entries } = useTrips();
  const { data: sites = [] } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => listSites('all'),
  });

  // Entries are kept newest first; a journey plays oldest first.
  const trips = useMemo(
    () => entries.slice().reverse().filter((e) => !only || e.id === only),
    [entries, only],
  );
  const slides = useMemo(() => buildSlides(trips, sites, !only), [trips, sites, only]);
  // Start every photo downloading now, so each is there when its slide
  // opens (the parks' photos are large).
  useEffect(() => {
    const uris = slides.flatMap((s) =>
      s.kind !== 'end' && s.image && !(s.kind === 'media' && s.media?.kind === 'video') ? [s.image] : [],
    );
    if (uris.length > 0) void Image.prefetch([...new Set(uris)]).catch(() => {});
  }, [slides]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  /** A slide that's had its time and is waiting for a tap (one trip). */
  const [waiting, setWaiting] = useState(false);
  // A new slide starts its own wait.
  const [waitingFor, setWaitingFor] = useState(index);
  if (waitingFor !== index) {
    setWaitingFor(index);
    setWaiting(false);
  }
  const slide = slides[Math.min(index, slides.length - 1)];
  const duration =
    slide?.kind === 'title'
      ? TITLE_MS
      : slide?.kind === 'media' && slide.media?.kind === 'video'
        ? (slide.media.duration ?? VIDEO_MS)
        : PHOTO_MS;

  // Leave: back to where Relive was opened from, or to Trips when there's
  // nothing behind it (opened from a link, or a reload restored it).
  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/trips');
  }

  // Nothing to play (every entry deleted meanwhile, or opened before the
  // journal had loaded): leave.
  useEffect(() => {
    if (trips.length === 0) leave();
    // Only when the trips run out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips.length]);

  function advanceTo() {
    next();
  }
  /** A slide's time is up (or its video ended): wait for a tap, or move on. */
  function finishSlide() {
    cancelAnimation(progress);
    progress.value = 1;
    if (only) setWaiting(true);
    else next();
  }
  function next() {
    if (index >= slides.length - 1) leave();
    else setIndex(index + 1);
  }
  function previous() {
    setIndex(Math.max(0, index - 1));
  }

  // The current slide's progress, 0 to 1; reaching 1 moves on. The end
  // slide waits for you.
  const progress = useSharedValue(0);
  function run(start: number) {
    progress.value = start;
    progress.value = withTiming(
      1,
      { duration: duration * (1 - start), easing: Easing.linear },
      (finished) => {
        // One trip waits for a tap; the whole journey plays on.
        if (finished) scheduleOnRN(only ? setWaiting : advanceTo, true);
      },
    );
  }
  useEffect(() => {
    if (!slide || slide.kind === 'end') return;
    run(0);
    return () => cancelAnimation(progress);
    // A new slide restarts the clock; pausing is handled on press.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides.length]);

  function pause() {
    cancelAnimation(progress);
    setPaused(true);
  }
  function resume() {
    if (!paused) return;
    setPaused(false);
    if (slide && slide.kind !== 'end') run(progress.value);
  }

  if (!slide) return <View style={styles.screen} />;

  // The current trip's slides, for the bars along the top.
  const tripSlides =
    slide.kind === 'end'
      ? []
      : slides.filter((s) => s.kind !== 'end' && s.trip === slide.trip);
  const at = tripSlides.indexOf(slide);

  return (
    <Animated.View style={[styles.screen, !dived && styles.clearScreen, fadeIn]}>

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(event) => (event.nativeEvent.locationX < width / 3 ? previous() : next())}
        onLongPress={pause}
        delayLongPress={220}
        onPressOut={resume}
        accessibilityRole="button"
        accessibilityLabel="Next slide"
        accessibilityHint="Tap the left side to go back. Hold to pause."
      >
        {slide.kind === 'title' ? (
          <TitleSlide
            key={index}
            slide={slide}
            total={trips.length}
            paused={paused}
            still={!!only}
            dive={index === 0 && diveRect ? { rect: diveRect, progress: diving } : undefined}
          />
        ) : slide.kind === 'souvenir' ? (
          <SouvenirSlide key={index} slide={slide} still={!!only} />
        ) : slide.kind === 'review' ? (
          <ReviewSlide key={index} slide={slide} still={!!only} />
        ) : slide.kind === 'media' ? (
          <MediaSlide
            key={index}
            slide={slide}
            paused={paused}
            duration={duration}
            still={!!only}
            onEnded={finishSlide}
          />
        ) : (
          <EndSlide
            trips={trips}
            sites={sites}
            onReplay={() => setIndex(0)}
            onDone={() => leave()}
            bottom={insets.bottom}
          />
        )}
      </Pressable>

      {waiting ? (
        <View style={[styles.continue, { bottom: insets.bottom + space[4] }]} pointerEvents="none">
          <BodyText size={12.5} weight="semibold" color={ON_INK}>
            {index >= slides.length - 1 ? 'Tap to finish' : 'Tap to continue'}
          </BodyText>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path d="M9.5 5L16 12l-6.5 7" fill="none" stroke={ON_INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      ) : null}

      <Animated.View style={[styles.top, { paddingTop: insets.top + space[2] }, chromeIn]} pointerEvents="box-none">
        {tripSlides.length > 0 ? (
          <View style={styles.bars} pointerEvents="none">
            {tripSlides.map((s, i) => (
              <Bar key={i} state={i < at ? 'done' : i === at ? 'current' : 'next'} progress={progress} />
            ))}
          </View>
        ) : null}
        <View style={styles.topRow}>
          <BodyText size={12} weight="semibold" color={ON_INK_SOFT} style={styles.topLabel}>
            {slide.kind === 'end'
              ? 'Your journey'
              : `${only ? monthLabel(slide.entry.date) : `Trip ${slide.trip + 1} of ${trips.length}`}${paused ? ' · Paused' : ''}`}
          </BodyText>
          <Pressable
            onPress={() => leave()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M6 6l12 12M18 6L6 18" stroke={ON_INK} strokeWidth={2.6} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function buildSlides(trips: TripEntry[], sites: Site[], summary: boolean): Slide[] {
  const byId = new Map(sites.map((site) => [site.id, site]));
  const slides: Slide[] = [];
  trips.forEach((entry, trip) => {
    const site = byId.get(entry.siteId);
    // The opening card is always the park's own photo, when there is one.
    slides.push({
      kind: 'title',
      trip,
      entry,
      site,
      image: site?.imageUrl ?? leadPhoto(entry),
    });
    // The souvenir: the official stamp, collected in person.
    if (entry.passportStamp) {
      slides.push({
        kind: 'souvenir',
        trip,
        entry,
        site,
        image: entry.passportStamp,
        backdrop: site?.imageUrl ?? leadPhoto(entry),
      });
    }
    // No photos or videos of your own: the park's photo stands in, so
    // every trip has a photo slide with its details.
    const shots: (TripMedia | null)[] = entry.media.length > 0 ? entry.media : [null];
    shots.forEach((media, i) => {
      slides.push({
        kind: 'media',
        trip,
        entry,
        site,
        media,
        image: media ? media.uri : (site?.imageUrl ?? null),
        first: i === 0,
        drift: (slides.length % 2 === 0 ? 1 : -1) as 1 | -1,
      });
    });
    // How it was, when they said.
    if (entry.rating != null || cleanFeedback(entry.feedback).length > 0) {
      slides.push({ kind: 'review', trip, entry, site, image: site?.imageUrl ?? leadPhoto(entry) });
    }
  });
  if (summary && slides.length > 0) slides.push({ kind: 'end' });
  return slides;
}

/** One bar along the top: filled, filling, or empty. */
function Bar({ state, progress }: { state: 'done' | 'current' | 'next'; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({
    width: `${(state === 'done' ? 1 : state === 'current' ? progress.value : 0) * 100}%`,
  }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

/**
 * A photo filling the screen, slowly zooming and drifting sideways over
 * `duration`, as photo apps' memories do. Holds still while paused.
 */
function SlowPan({
  uri,
  duration,
  paused,
  still = false,
  drift = 1,
  blur = 0,
  fallback,
}: {
  uri: string | null;
  duration: number;
  paused: boolean;
  /** Hold the photo still instead. */
  still?: boolean;
  drift?: 1 | -1;
  blur?: number;
  fallback: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (paused || still) {
      cancelAnimation(t);
      return;
    }
    t.value = withTiming(1, { duration: duration * (1 - t.value), easing: Easing.linear });
  }, [paused, still, duration, t]);

  const motion = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(t.value, [0, 1], [1.06, 1.2]) },
      { translateX: interpolate(t.value, [0, 1], [-14 * drift, 14 * drift]) },
    ],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: fallback }]}>
      {uri ? (
        <Animated.View style={[StyleSheet.absoluteFill, motion]}>
          {/* A sharp photo can take a moment to load (the parks' are large),
              so the blurred copy the opening slide already loaded shows
              underneath until it does. */}
          {blur === 0 ? (
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={OPENING_BLUR}
            />
          ) : null}
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={blur}
            transition={400}
            priority="high"
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Darkens the top and bottom so the words over a photo stay readable. */
function Shade({ strength = 0.8 }: { strength?: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
      <Defs>
        <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={INK} stopOpacity={0.55} />
          <Stop offset="0.25" stopColor={INK} stopOpacity={0.05} />
          <Stop offset="0.5" stopColor={INK} stopOpacity={0.1} />
          <Stop offset="1" stopColor={INK} stopOpacity={strength} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill="url(#shade)" />
    </Svg>
  );
}

/** The opening slide's blur and dimming, which a dive grows into. */
const TITLE_BLUR = 12;
/** The same blur, for the photo shown while a sharp one loads. */
const OPENING_BLUR = TITLE_BLUR;
const TITLE_DIM = 0.45;

function TitleSlide({
  slide,
  total,
  paused,
  still,
  dive,
}: {
  slide: TripSlide;
  total: number;
  paused: boolean;
  still: boolean;
  /** Dived into from a bubble: where it was, and the dive's progress. */
  dive?: { rect: DiveRect; progress: SharedValue<number> };
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const textScale = useTextScale();
  const { entry, site } = slide;
  const name = site?.name ?? entry.siteId;
  // Only the 63 national parks have a stamp in Passport, so only they get
  // a seal here; a battlefield or monument trip shows none.
  const hasStamp = site?.isNamedPark ?? false;
  const fallback = terrainTone(site?.group ?? null).band;
  const [, month, dayOfMonth] = entry.date.split('-');
  const [year] = entry.date.split('-');

  // Where the bubble's words were, for them to slide from.
  const from = dive ? bubbleWordCentres(dive.rect, entry.title, textScale) : null;

  // The seal is pressed like a real one: it lifts into view above its
  // spot, drops fast, hits (a squash, the thud, a haptic tap, and a ring of
  // wax spreading out), rebounds a touch and settles. Its shadow on the
  // page darkens and tightens as it comes down. After the dive, if there
  // is one.
  const press = useSharedValue(0);
  const spread = useSharedValue(0);
  useEffect(() => {
    if (!hasStamp) return;
    const delay = dive ? DIVE_MS + 120 : 450;
    press.value = withDelay(delay, withTiming(1, { duration: PRESS_MS, easing: Easing.linear }));
    spread.value = withDelay(
      delay + PRESS_MS * HIT,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    const hit = setTimeout(() => {
      playSound('stamp');
      tap('medium');
    }, delay + PRESS_MS * HIT);
    return () => clearTimeout(hit);
    // Once, as the slide opens (or as soon as its park is known).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStamp]);
  const stampStyle = useAnimatedStyle(() => {
    const p = press.value;
    return {
      opacity: interpolate(p, [0, 0.18], [0, 1], 'clamp'),
      transform: [
        // Hovering above, then down: slow to start, fast at the end.
        { translateY: interpolate(p, [0, 0.3, HIT], [-30, -44, 0], 'clamp') },
        { scale: interpolate(p, [0, 0.3, HIT], [1.18, 1.3, 1], 'clamp') },
        // The squash on impact, the rebound, the settle.
        { scaleX: interpolate(p, [HIT, HIT + 0.08, HIT + 0.22, 1], [1, 1.09, 0.98, 1], 'clamp') },
        { scaleY: interpolate(p, [HIT, HIT + 0.08, HIT + 0.22, 1], [1, 0.88, 1.03, 1], 'clamp') },
        { rotate: `${interpolate(p, [0, HIT], [-14, -8], 'clamp')}deg` },
      ],
    };
  });
  // Its shadow on the page: faint and wide while it's high, dark and tight
  // as it lands, then gone (the seal draws its own resting shadow).
  const landingShadowStyle = useAnimatedStyle(() => {
    const p = press.value;
    return {
      opacity: interpolate(p, [0, 0.1, HIT, HIT + 0.15], [0, 0.15, 0.45, 0], 'clamp'),
      transform: [{ scale: interpolate(p, [0, HIT], [1.25, 0.9], 'clamp') }],
    };
  });
  // The wax spreading out from under the seal as it hits.
  const spreadStyle = useAnimatedStyle(() => ({
    opacity: interpolate(spread.value, [0, 0.15, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(spread.value, [0, 1], [0.92, 1.35]) }],
  }));
  // The rest of the slide arrives as the dive finishes.
  const lateIn = useAnimatedStyle(() =>
    dive ? { opacity: interpolate(dive.progress.value, [0.65, 1], [0, 1], 'clamp') } : {},
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      {dive ? (
        <DiveBackground
          rect={dive.rect}
          progress={dive.progress}
          photo={leadPhoto(entry) ?? site?.imageUrl ?? null}
          background={slide.image}
          blur={TITLE_BLUR}
          dim={TITLE_DIM}
          fallback={fallback}
        />
      ) : (
        <>
          <SlowPan
            uri={slide.image}
            duration={TITLE_MS}
            paused={paused}
            still={still}
            blur={TITLE_BLUR}
            fallback={fallback}
          />
          <View style={[StyleSheet.absoluteFill, styles.dim]} />
        </>
      )}

      <View style={[styles.titleBody, { paddingBottom: insets.bottom + space[8] + (still ? HINT_ROOM : 0) }]}>
        {/* The park's stamp: it opens the park in Passport. */}
        {hasStamp ? (
        <Animated.View style={lateIn}>
        <Pressable
          onPress={() => {
            // Close Relive first, as its ✕ does (which also hands the status
            // bar back), then open the park in Passport.
            if (router.canGoBack()) router.back();
            router.navigate({ pathname: '/passport', params: { park: entry.siteId } });
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${name} stamp. See it in your Passport`}
          style={styles.stampTap}
        >
          <View style={styles.stamp}>
            <Animated.View style={[styles.landingShadow, landingShadowStyle]} />
            <Animated.View style={[styles.spread, spreadStyle]} />
            <Animated.View style={stampStyle}>
              <WaxSeal
                code={entry.siteId}
                group={site?.group ?? null}
                name={name}
                date={`${MONTH_SHORT[Number(month) - 1]} ${Number(dayOfMonth)}, ${year}`}
                size={STAMP_SIZE}
              />
            </Animated.View>
          </View>
          <View style={styles.stampLink}>
            <BodyText size={11.5} weight="semibold" color={ON_INK_SOFT}>
              See in Passport
            </BodyText>
            <Svg width={11} height={11} viewBox="0 0 24 24">
              <Path d="M9.5 5L16 12l-6.5 7" fill="none" stroke={ON_INK_SOFT} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </Pressable>
        </Animated.View>
        ) : null}

        <Animated.View style={lateIn}>
          <BodyText size={12} weight="semibold" color={ON_INK_SOFT} style={styles.kicker}>
            {total === 1 ? 'A memory' : slide.trip === 0 ? 'Where it started' : slide.trip === total - 1 ? 'Most recently' : 'Then'}
          </BodyText>
        </Animated.View>
        {/* The bubble's words, sliding down and left to their places. The
            park name grows from the bubble's small capitals. */}
        <Mover dive={dive} from={from?.park} fromScale={(11 * 1.25) / 38} style={styles.titleName}>
          <Heading size={38} color={ON_INK}>
            {name}
          </Heading>
        </Mover>
        <Mover dive={dive} from={from?.date} fromScale={13 / 15} style={styles.titleDate}>
          <BodyText size={15} color={ON_INK_SOFT}>
            {dateLabel(entry.date)}
            {site ? ` · ${site.state}` : ''}
          </BodyText>
        </Mover>
        <Mover dive={dive} from={from?.title} fromScale={1} style={styles.entryTitle}>
          <Heading size={22} color={ON_INK}>
            {`“${entry.title}”`}
          </Heading>
        </Mover>
        {entry.rating ? (
          <Animated.View style={[styles.stars, lateIn]}>
            {[1, 2, 3, 4, 5].map((n) => (
              <StarIcon key={n} filled={n <= entry.rating!} size={18} />
            ))}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One of the opening slide's words, which after a dive slides (and scales)
 * from where the bubble showed it to its own place. Hidden until laid out,
 * so it never flashes in its final place first. Without a dive, it's just
 * there.
 */
function Mover({
  dive,
  from,
  fromScale,
  style,
  children,
}: {
  dive?: { progress: SharedValue<number> };
  from?: { x: number; y: number };
  fromScale: number;
  style?: object;
  children: ReactNode;
}) {
  // Its place on the slide (the slide fills the screen, so these are
  // screen positions).
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const moving = useAnimatedStyle(() => {
    if (!dive || !from) return {};
    if (!box) return { opacity: 0 };
    const t = dive.progress.value;
    return {
      opacity: 1,
      transform: [
        { translateX: interpolate(t, [0, 1], [from.x - (box.x + box.w / 2), 0]) },
        { translateY: interpolate(t, [0, 1], [from.y - (box.y + box.h / 2), 0]) },
        { scale: interpolate(t, [0, 1], [fromScale, 1]) },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.mover, style, moving]}
      onLayout={(event) => {
        const { x, y, width, height } = event.nativeEvent.layout;
        setBox({ x, y, w: width, h: height });
      }}
    >
      {children}
    </Animated.View>
  );
}

function MediaSlide({
  slide,
  paused,
  duration,
  still,
  onEnded,
}: {
  slide: TripSlide & { media: TripMedia | null; first: boolean; drift: 1 | -1 };
  paused: boolean;
  duration: number;
  still: boolean;
  /** A video played to its end. */
  onEnded: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { entry, site, media, first } = slide;
  const company = entry.with.map((p) => firstName(p));
  const notes = first ? entry.notes.trim() : '';
  const caption = media?.caption.trim() ?? '';
  const fallback = terrainTone(site?.group ?? null).band;

  return (
    <View style={StyleSheet.absoluteFill}>
      {media?.kind === 'video' ? (
        <VideoBackground uri={media.uri} paused={paused} onEnded={onEnded} fallback={fallback} />
      ) : (
        <SlowPan
          uri={slide.image}
          duration={duration}
          paused={paused}
          still={still}
          drift={slide.drift}
          fallback={fallback}
        />
      )}
      <Shade strength={notes || caption ? 0.88 : 0.6} />

      <View style={[styles.photoBody, { paddingBottom: insets.bottom + space[8] + (still ? HINT_ROOM : 0) }]}>
        {first && entry.trails.length > 0 ? (
          <View style={styles.trails}>
            {entry.trails.map((name) => (
              <View key={name} style={styles.trail}>
                <PinIcon color={ON_INK} />
                <BodyText size={12} weight="bold" color={ON_INK}>
                  {name}
                </BodyText>
              </View>
            ))}
          </View>
        ) : null}
        {notes ? (
          <BodyText size={18} lineHeightRatio={1.45} color={ON_INK} style={styles.notes}>
            {notes}
          </BodyText>
        ) : null}
        {caption ? (
          <BodyText
            size={notes ? 15 : 18}
            weight={notes ? 'medium' : 'regular'}
            lineHeightRatio={1.45}
            color={notes ? ON_INK_SOFT : ON_INK}
            style={[styles.notes, notes ? styles.captionUnderNotes : null]}
          >
            {notes ? `\u201c${caption}\u201d` : caption}
          </BodyText>
        ) : null}
        <BodyText size={12.5} weight="semibold" color={ON_INK_SOFT}>
          {[site?.name ?? entry.siteId, dateLabel(entry.date), company.length ? `with ${company.join(', ')}` : null]
            .filter(Boolean)
            .join(' \u00b7 ')}
        </BodyText>
      </View>
    </View>
  );
}

/**
 * The trip's passport-book stamp: the photo pasted onto a passport page,
 * settling down over the park's blurred photo like it's being laid on a
 * table.
 */
function SouvenirSlide({ slide, still }: { slide: TripSlide & { backdrop: string | null }; still: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const fallback = terrainTone(slide.site?.group ?? null).band;
  const settle = useSharedValue(0);
  useEffect(() => {
    settle.value = withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [settle]);
  const pageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(settle.value, [0, 0.4], [0, 1]),
    transform: [
      { translateY: interpolate(settle.value, [0, 1], [40, 0]) },
      { rotate: `${interpolate(settle.value, [0, 1], [5, -1.5])}deg` },
      { scale: interpolate(settle.value, [0, 1], [1.08, 1]) },
    ],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: fallback }]}>
      {slide.backdrop ? (
        <Image source={{ uri: slide.backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={24} />
      ) : null}
      <Shade strength={0.75} />
      <View
        style={[
          styles.souvenir,
          { paddingTop: insets.top + space[8], paddingBottom: insets.bottom + space[6] + (still ? HINT_ROOM : 0) },
        ]}
      >
        <BodyText size={12} weight="bold" color={ON_INK_SOFT} style={styles.souvenirKicker}>
          SOUVENIR · COLLECTED IN PERSON
        </BodyText>
        <Animated.View style={pageStyle}>
          <PassportPage
            uri={slide.image ?? ''}
            park={slide.site?.name ?? slide.entry.siteId}
            date={slide.entry.date}
            width={Math.min(width - space[6] * 2, 400)}
          />
        </Animated.View>
      </View>
    </View>
  );
}

// Okay is the middle of the five (as on the entry sheet).
const RATING_WORDS = ['Awful', 'Poor', 'Okay', 'Good', 'Great'];
/** When the first tag is stamped, and the gap between tags, in ms. */
const FIRST_STAMP_MS = 900;
const STAMP_GAP_MS = 550;
/** Each stamp's tilt, so they look pressed by hand. */
const STAMP_TILTS = [-6, 4, -3, 5];
/** Ink: cream for the good side of a pair, orange for a complaint. */
const GOOD_INK = '#F4EADB';
const BAD_INK = colors.accentRamp[400];

/**
 * How it was: the trip's stars and rating word fade up over the park's
 * blurred photo, then each feedback tag is stamped onto the page, one
 * after another (a drop, a thud and a tap), tilted like a hand stamp.
 */
function ReviewSlide({ slide, still }: { slide: TripSlide; still: boolean }) {
  const insets = useSafeAreaInsets();
  const { entry, site } = slide;
  const fallback = terrainTone(site?.group ?? null).band;
  const tags = cleanFeedback(entry.feedback);
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withDelay(150, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [appear]);
  const headStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: interpolate(appear.value, [0, 1], [16, 0]) }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: fallback }]}>
      {slide.image ? (
        <Image source={{ uri: slide.image }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={24} />
      ) : null}
      <Shade strength={0.8} />
      <View
        style={[
          styles.review,
          { paddingTop: insets.top + space[8], paddingBottom: insets.bottom + space[8] + (still ? HINT_ROOM : 0) },
        ]}
      >
        <Animated.View style={[styles.reviewHead, headStyle]}>
          <BodyText size={12} weight="bold" color={ON_INK_SOFT} style={styles.kicker}>
            How it was
          </BodyText>
          <Heading size={26} color={ON_INK} style={styles.reviewPark} numberOfLines={2}>
            {site?.name ?? entry.title}
          </Heading>
          {entry.rating != null ? (
            <View style={styles.reviewStars} accessibilityLabel={`${entry.rating} of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <StarIcon key={n} filled={n <= entry.rating!} size={30} />
              ))}
              <BodyText size={15} weight="semibold" color={ON_INK} style={styles.reviewWord}>
                {RATING_WORDS[entry.rating - 1]}
              </BodyText>
            </View>
          ) : null}
        </Animated.View>
        {tags.length > 0 ? (
          <View style={styles.reviewStamps}>
            {tags.map((tag, i) => (
              <FeedbackStamp
                key={tag}
                label={feedbackLabel(tag)}
                ink={isGood(tag) ? GOOD_INK : BAD_INK}
                tilt={STAMP_TILTS[i % STAMP_TILTS.length]}
                delay={FIRST_STAMP_MS + i * STAMP_GAP_MS}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** One tag as a rubber stamp: it drops onto the page, squashes and settles. */
function FeedbackStamp({ label, ink, tilt, delay }: { label: string; ink: string; tilt: number; delay: number }) {
  const press = useSharedValue(0);
  useEffect(() => {
    press.value = withDelay(delay, withTiming(1, { duration: 420, easing: Easing.linear }));
    const hit = setTimeout(() => {
      playSound('stamp');
      tap('light');
    }, delay + 420 * HIT);
    return () => clearTimeout(hit);
  }, [press, delay]);
  const style = useAnimatedStyle(() => {
    const p = press.value;
    return {
      opacity: interpolate(p, [0, 0.25], [0, 1], 'clamp'),
      transform: [
        // Big and above the page, down fast, a squash on impact, settle.
        { scale: interpolate(p, [0, HIT, HIT + 0.15, 1], [1.9, 1, 0.94, 1], 'clamp') },
        { rotate: `${interpolate(p, [0, HIT], [tilt * 2.5, tilt], 'clamp')}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.tagStamp, { borderColor: ink }, style]}>
      <View style={[styles.tagStampInner, { borderColor: ink }]}>
        <BodyText size={14} weight="bold" color={ink} style={styles.tagStampText}>
          {label.toUpperCase()}
        </BodyText>
      </View>
    </Animated.View>
  );
}

/** A video filling the screen, played once through; holds while paused. */
function VideoBackground({
  uri,
  paused,
  onEnded,
  fallback,
}: {
  uri: string;
  paused: boolean;
  onEnded: () => void;
  fallback: string;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);
  useEffect(() => {
    const ended = player.addListener('playToEnd', onEnded);
    return () => ended.remove();
    // The slide's own handler for as long as it's shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: fallback }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </View>
  );
}

function EndSlide({
  trips,
  sites,
  onReplay,
  onDone,
  bottom,
}: {
  trips: TripEntry[];
  sites: Site[];
  onReplay: () => void;
  onDone: () => void;
  bottom: number;
}) {
  const byId = new Map(sites.map((site) => [site.id, site]));
  const parks = new Set(trips.map((t) => t.siteId));
  const regions = new Set(
    trips.map((t) => {
      const site = byId.get(t.siteId);
      return site ? regionForState(site.state)?.id : undefined;
    }).filter(Boolean),
  );
  const first = trips[0];
  const last = trips[trips.length - 1];
  const stats = [
    { value: trips.length, label: trips.length === 1 ? 'trip' : 'trips' },
    { value: parks.size, label: parks.size === 1 ? 'park' : 'parks' },
    { value: regions.size, label: regions.size === 1 ? 'region' : 'regions' },
  ];

  return (
    <View style={[StyleSheet.absoluteFill, styles.end, { paddingBottom: bottom + space[6] }]}>
      <BodyText size={12} weight="semibold" color={colors.accentRamp[300]} style={styles.kicker}>
        {first && last ? `${monthLabel(first.date)} – ${monthLabel(last.date)}` : ''}
      </BodyText>
      <Heading size={34} color={ON_INK} style={styles.endTitle}>
        Your journey so far
      </Heading>
      <View style={styles.statRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Heading size={40} color={colors.accentRamp[300]}>
              {String(stat.value)}
            </Heading>
            <BodyText size={13} weight="semibold" color={ON_INK_SOFT}>
              {stat.label}
            </BodyText>
          </View>
        ))}
      </View>
      <BodyText size={14} lineHeightRatio={1.5} color={ON_INK_SOFT} style={styles.endNote}>
        Where to next? Your recommendations are waiting on Explore.
      </BodyText>
      <View style={styles.endActions}>
        <Button
          label="Play again"
          variant="secondary"
          onPress={onReplay}
          // Light, so its dark label reads on the dark screen.
          style={[styles.endButton, styles.replay]}
        />
        <Button label="Done" onPress={onDone} style={styles.endButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  souvenir: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
  },
  souvenirKicker: {
    letterSpacing: 1.6,
  },
  screen: {
    flex: 1,
    backgroundColor: INK,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space[3],
  },
  bars: {
    flexDirection: 'row',
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(249, 244, 237, 0.3)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: ON_INK,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[2],
  },
  topLabel: {
    flex: 1,
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20, 17, 15, 0.35)',
  },
  continue: {
    position: 'absolute',
    right: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20, 17, 15, 0.55)',
  },
  dim: {
    backgroundColor: 'rgba(20, 17, 15, 0.45)',
  },
  titleBody: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: space[6],
  },
  stampTap: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[6],
  },
  stampLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stamp: {
    width: STAMP_SIZE,
    height: STAMP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingShadow: {
    position: 'absolute',
    width: STAMP_SIZE * 0.82,
    height: STAMP_SIZE * 0.82,
    borderRadius: STAMP_SIZE,
    backgroundColor: '#000',
  },
  spread: {
    position: 'absolute',
    width: STAMP_SIZE * 0.9,
    height: STAMP_SIZE * 0.9,
    borderRadius: STAMP_SIZE,
    borderWidth: 2.5,
    borderColor: '#9c2a2c',
  },
  mover: {
    alignSelf: 'flex-start',
  },
  clearScreen: {
    backgroundColor: 'transparent',
  },
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  titleName: {
    marginTop: space[2],
  },
  titleDate: {
    marginTop: space[1],
  },
  entryTitle: {
    marginTop: space[4],
  },
  stars: {
    flexDirection: 'row',
    gap: 3,
    marginTop: space[3],
  },
  photoBody: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: space[3],
    paddingHorizontal: space[6],
  },
  trails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  captionUnderNotes: {
    marginTop: -space[1],
  },
  trail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(249, 244, 237, 0.7)',
    transform: [{ rotate: '-2deg' }],
  },
  notes: {
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowRadius: 6,
  },
  review: {
    flex: 1,
    justifyContent: 'center',
    gap: space[8],
    paddingHorizontal: space[6],
  },
  reviewHead: {
    alignItems: 'center',
  },
  reviewPark: {
    marginTop: space[2],
    textAlign: 'center',
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: space[4],
  },
  reviewWord: {
    marginLeft: space[2],
  },
  reviewStamps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space[4],
  },
  tagStamp: {
    padding: 3,
    borderWidth: 2.5,
    borderRadius: 8,
    opacity: 0.92,
  },
  tagStampInner: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 5,
  },
  tagStampText: {
    letterSpacing: 1.6,
  },
  end: {
    justifyContent: 'flex-end',
    paddingHorizontal: space[6],
    backgroundColor: INK,
  },
  endTitle: {
    marginTop: space[2],
  },
  statRow: {
    flexDirection: 'row',
    gap: space[6],
    marginTop: space[6],
  },
  stat: {
    alignItems: 'flex-start',
  },
  endNote: {
    marginTop: space[6],
  },
  endActions: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[6],
  },
  endButton: {
    flex: 1,
  },
  replay: {
    backgroundColor: ON_INK,
  },
});
