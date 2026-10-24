/**
 * The Explore map on its own, full screen and sideways, opened from the
 * map's expand button. Like a video player's full screen, it switches to
 * landscape the moment it opens, however the phone is held, and back to
 * portrait when it closes. Everything else is laid out for a tall phone,
 * so the rest of the app is locked to portrait (see the root layout).
 *
 * The map runs edge to edge, under the status and navigation bars (on
 * Android a modal otherwise stops short of both, and the screen behind
 * shows along those edges), with the status bar hidden like a video's
 * full screen; only the controls floating over it keep clear of the notch
 * and home bar. Sideways the map is limited by the
 * screen's height, so it sits clear of the notch at the sides anyway.
 *
 * Tapping a park shows its name with a View button, which closes this
 * view and opens that park's card in Explore.
 *
 * Opening it quickly: the expand button calls turnSideways() as it's
 * pressed, so the screen starts turning before anything re-renders; the
 * modal appears at once (no fade of its own: the map fades in once the
 * screen has turned); and its window is the page's cream, not black, so
 * the part of the screen Android hasn't redrawn mid-turn isn't a dark band.
 */

import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Site } from '../data/parks';
import { regionForState, type RegionId } from '../data/regions';
import { colors, radius, shadow, space } from '../theme';
import { Button } from './Button';
import { ParkMap } from './ParkMap';
import { BodyText, Heading } from './Typography';

/** Room kept for a tapped park's card, which the title sits just above. */
const CHIP_SLOT = 72;

/** How long the map takes to fade in once the screen has turned. */
const FADE_MS = 180;

type FullMapViewProps = {
  visible: boolean;
  /** What the map is showing, e.g. "62 national parks". */
  title: string;
  sites: Site[];
  rankById?: ReadonlyMap<string, number>;
  matchIds?: ReadonlySet<string>;
  featureIcons?: boolean;
  /** Regions to mark as completed (every national park visited). */
  completedRegions?: ReadonlySet<RegionId>;
  /** Tuck completed regions' pins behind their stamps (see ParkMap). */
  tuckCompleted?: boolean;
  onClose: () => void;
  /** Opens a park's card back in Explore. */
  onView: (site: Site) => void;
};

/** Starts turning the screen sideways; call it as the map is opened. */
export function turnSideways() {
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
}

export function FullMapView(props: FullMapViewProps) {
  const { visible, onClose } = props;

  // Sideways as soon as it opens (either way round, following the phone),
  // upright again when it closes.
  useEffect(() => {
    if (!visible) return;
    // Usually already asked for by the expand button; harmless twice.
    turnSideways();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="none"
      backdropColor={colors.bg}
      onRequestClose={onClose}
      // Under the system bars, so the map fills the whole screen.
      statusBarTranslucent
      navigationBarTranslucent
      // iOS keeps a modal portrait unless it's told otherwise.
      supportedOrientations={['landscape-left', 'landscape-right']}
    >
      {/* Its own safe-area provider: the app's one, outside the modal, keeps
          the upright insets after the phone turns, which cut the map short. */}
      <SafeAreaProvider>
        {visible ? <StatusBar hidden /> : null}
        <FullMapBody {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function FullMapBody({
  title,
  sites,
  rankById,
  matchIds,
  featureIcons,
  completedRegions,
  tuckCompleted = true,
  onClose,
  onView,
}: FullMapViewProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  // The screen's sides, long and short, whichever way it's held now.
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const [selected, setSelected] = useState<Site | null>(null);
  /** A completed region whose pins were tapped back into view. */
  const [revealed, setRevealed] = useState<RegionId | null>(null);
  const region = selected ? regionForState(selected.state) : undefined;
  // The title and the park card sit far right, in the margin beside the
  // map. On a notched iPhone part of the side inset is just the rounded
  // corner, so they can go a little into it; never quite on the edge.
  const edgeRight = Math.max(insets.right - space[4], 2);

  return (
    // Gestures inside a modal need their own root on Android.
    <GestureHandlerRootView style={styles.screen}>
      {/* The map starts drawing straight away, hidden, at the size the
          screen will be once it has turned (its long side across), so it's
          ready the moment the rotation lands instead of starting then. A
          fixed size also means it doesn't lay out for the upright screen
          and jump into place. It shows only once the screen is sideways,
          and hides the moment it starts turning back on close. */}
      <View
        pointerEvents={landscape ? 'auto' : 'none'}
        style={[styles.mapBox, { width: long, height: short, opacity: landscape ? 1 : 0 }]}
      >
          <ParkMap
            sites={sites}
            rankById={rankById}
            matchIds={matchIds}
            featureIcons={featureIcons}
            completedRegions={completedRegions}
            // A completed region's pins are tucked away; tapping it shows
            // them, and tapping it again tucks them back.
            revealedRegion={revealed}
            tuckCompleted={tuckCompleted}
            onSelectRegion={
              tuckCompleted
                ? (id) => setRevealed((current) => (current === id ? null : id))
                : undefined
            }
            // The full-screen map has room for the badges without zooming.
            iconsAtAnyZoom
            selectedId={selected?.id ?? null}
            // A second tap on the same park clears it.
            onSelectSite={(site) =>
              setSelected((current) => (current?.id === site.id ? null : site))
            }
            // Keeps the map's Reset button clear of the notch and status bar.
            controlInset={{ top: insets.top, right: insets.right }}
            style={styles.map}
          />
      </View>

      {landscape ? (
        <Animated.View entering={FadeIn.duration(FADE_MS)} style={styles.fill} pointerEvents="box-none">

          {/* Top left, because the map's own Reset button takes the top right. */}
          <View
            pointerEvents="box-none"
            style={[styles.bar, { top: insets.top + space[2], left: insets.left + space[3] }]}
          >
            <Button
              label="Close"
              variant="secondary"
              onPress={() => {
                setSelected(null);
                onClose();
              }}
            />
          </View>

          {/* The title sits bottom right, over open ocean, just above where a
              tapped park's card appears, so it never covers the map. */}
          <View
            pointerEvents="none"
            style={[
              styles.titleWrap,
              {
                bottom: insets.bottom + space[4] + CHIP_SLOT + space[2],
                right: edgeRight,
              },
            ]}
          >
            <View style={styles.titles}>
              <Heading size={16} numberOfLines={1}>
                {title}
              </Heading>
            </View>
          </View>

          {selected ? (
            <View
              style={[
                styles.chipWrap,
                {
                  bottom: insets.bottom + space[4],
                  left: insets.left + space[4],
                  right: edgeRight,
                },
              ]}
            >
              <View style={styles.chip}>
                <View style={styles.chipText}>
                  <BodyText size={15} weight="semibold" numberOfLines={1}>
                    {selected.name}
                  </BodyText>
                  {/* The region, since the map key isn't shown here. */}
                  <View style={styles.meta}>
                    {region ? (
                      <View style={[styles.regionSwatch, { backgroundColor: region.fill }]} />
                    ) : null}
                    <BodyText size={12} color={colors.neutral[600]} numberOfLines={1}>
                      {region ? (
                        <BodyText size={12} weight="semibold" color={colors.neutral[800]}>
                          {`${region.label} · `}
                        </BodyText>
                      ) : null}
                      {`${selected.kind} · ${selected.state}`}
                    </BodyText>
                  </View>
                </View>
                <Button
                  label="View"
                  onPress={() => {
                    setSelected(null);
                    onView(selected);
                  }}
                />
              </View>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
  mapBox: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  map: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  // Stacked, so it fits in the empty margin left of the sideways map
  // instead of covering the Pacific Northwest.
  bar: {
    position: 'absolute',
    alignItems: 'flex-start',
    gap: space[2],
    maxWidth: '24%',
  },
  titleWrap: {
    position: 'absolute',
    alignItems: 'flex-end',
    maxWidth: 360,
  },
  titles: {
    flexShrink: 1,
    paddingVertical: 6,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    // Readable over the map without hiding it.
    backgroundColor: 'rgba(249, 244, 237, 0.9)',
  },
  // Bottom right and narrow, so the tapped park stays in view: that corner
  // is open ocean on the map.
  chipWrap: {
    position: 'absolute',
    alignItems: 'flex-end',
  },
  chip: {
    width: '100%',
    maxWidth: 360,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    paddingLeft: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.lg,
  },
  chipText: {
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  /** The same rounded square as the map key's region swatches. */
  regionSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.neutral[400],
  },
});
