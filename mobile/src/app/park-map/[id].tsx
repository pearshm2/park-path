/**
 * A national park's official NPS brochure map, pinch-to-zoom, with a
 * switch between maps for parks that have more than one (Saguaro's East
 * and West units, say).
 *
 * Under the map, the visitor centers labelled on it. Tapping one zooms the
 * map to its label and rings it, so it's easy to find; tapping it again
 * zooms back out to the whole map. Full screen keeps the selection.
 *
 * The expand button opens the map full screen: turned sideways for wide
 * brochures, upright for tall ones (New River Gorge's runs north-south),
 * so a map is never shrunk to fit the wrong way round.
 */

import { useQuery } from '@tanstack/react-query';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchParkMap,
  officialMapUrl,
  type BrochureMap,
  type MapLabel,
} from '../../api/parkMaps';
import { listSites } from '../../api/parks';
import { BodyText, Button, ExpandIcon, Heading, Kicker } from '../../components';
import { BrochureMapView } from '../../components/maps/BrochureMapView';
import { colors, radius, shadow, space } from '../../theme';

/**
 * The names to show for a map's visitor centers. Some maps print just
 * "Visitor Center" more than once (Big Bend), so repeats are numbered.
 */
function displayNames(labels: MapLabel[]): string[] {
  const totals = new Map<string, number>();
  for (const label of labels) totals.set(label.name, (totals.get(label.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return labels.map((label) => {
    if ((totals.get(label.name) ?? 0) < 2) return label.name;
    const n = (seen.get(label.name) ?? 0) + 1;
    seen.set(label.name, n);
    return `${label.name} ${n}`;
  });
}

export default function ParkMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  // On Android the page can scroll itself as it opens. Until the person
  // touches the page, any scroll is one of those and is undone.
  const touched = useRef(false);
  // Where the map sits on the page, to bring it into view from the list.
  const mapY = useRef(0);

  const [brochureIndex, setBrochureIndex] = useState(0);
  const [highlight, setHighlight] = useState<MapLabel | null>(null);
  const [fullScreen, setFullScreen] = useState(false);

  // Same query key as Explore, so this is already cached.
  const { data: sites } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => listSites('all'),
  });
  const site = sites?.find((candidate) => candidate.id === id);

  const {
    data: parkMap,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['parkMap', id],
    queryFn: () => fetchParkMap(id),
    // The maps don't change between visits to the screen.
    staleTime: Infinity,
  });

  const brochures = parkMap?.brochures ?? [];
  const brochure = brochures[brochureIndex] ?? brochures[0];
  const mapsPage = parkMap?.officialMapUrl ?? officialMapUrl(id);
  const centerNames = brochure ? displayNames(brochure.visitorCenters) : [];
  const highlightName = highlight
    ? centerNames[brochure?.visitorCenters.indexOf(highlight) ?? -1] ?? highlight.name
    : null;

  const mapWidth = windowWidth - space[4] * 2;
  // The map's box takes the brochure's shape, so a tall map isn't
  // squeezed into a square; within reason either way.
  const mapHeight = brochure
    ? Math.round(
        Math.min(Math.max((mapWidth * brochure.height) / brochure.width, 260), windowHeight * 0.72),
      )
    : 0;
  // Full screen turns sideways only for maps wider than tall.
  const sideways = brochure ? brochure.width >= brochure.height : true;

  function chooseBrochure(index: number) {
    setBrochureIndex(index);
    setHighlight(null);
  }

  function toggleVisitorCenter(label: MapLabel) {
    if (highlight === label) {
      setHighlight(null);
      return;
    }
    setHighlight(label);
    // The list is under the map; scroll up so the zoom is in view.
    scrollRef.current?.scrollTo({ y: Math.max(0, mapY.current - space[3]), animated: true });
  }

  return (
    <ScrollView
      ref={scrollRef}
      onTouchStart={() => {
        touched.current = true;
      }}
      scrollEventThrottle={32}
      onScroll={(event) => {
        if (!touched.current && event.nativeEvent.contentOffset.y > 0) {
          scrollRef.current?.scrollTo({ y: 0, animated: false });
        }
      }}
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space[3], paddingBottom: insets.bottom + space[6] },
      ]}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      >
        <BodyText size={13} weight="semibold" color={colors.accentRamp[700]}>
          ‹ Back
        </BodyText>
      </Pressable>

      <Kicker style={styles.kicker}>Park map</Kicker>
      <Heading size={26}>{site?.name ?? 'Park map'}</Heading>

      {brochure ? (
        <>
          <BrochureChoice brochures={brochures} index={brochureIndex} onChoose={chooseBrochure} />

          <View
            style={[styles.map, { height: mapHeight }]}
            onLayout={(event) => {
              mapY.current = event.nativeEvent.layout.y;
            }}
          >
            <BrochureMapView
              brochure={brochure}
              width={mapWidth}
              height={mapHeight}
              highlight={highlight}
            />
            <Pressable
              onPress={() => setFullScreen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={sideways ? 'Full screen, sideways' : 'Full screen'}
              style={({ pressed }) => [styles.expand, pressed && styles.expandPressed]}
            >
              <ExpandIcon color={colors.neutral[800]} />
            </Pressable>
          </View>

          <BodyText size={11.5} color={colors.textMuted} style={styles.hint}>
            {sideways
              ? 'Pinch or double-tap to zoom. Tap the expand button to turn it sideways.'
              : 'Pinch or double-tap to zoom. Tap the expand button for full screen.'}
          </BodyText>

          <VisitorCenters
            labels={brochure.visitorCenters}
            names={centerNames}
            selected={highlight}
            onSelect={toggleVisitorCenter}
          />
        </>
      ) : (
        <View style={styles.notice}>
          <BodyText size={13.5} lineHeightRatio={1.5} color={colors.neutral[700]}>
            {isPending
              ? 'Loading the park map…'
              : isError
                ? "Couldn't load the park map. Check your connection and try again."
                : "We don't have a map for this park yet. The park's own maps page has one."}
          </BodyText>
        </View>
      )}

      <Button
        label="Official park maps (nps.gov)"
        variant="ghost"
        onPress={() => Linking.openURL(mapsPage)}
        style={styles.official}
      />

      <BodyText size={11} color={colors.textMuted} style={styles.credit}>
        Map: National Park Service.
      </BodyText>

      {brochure ? (
        <FullScreenMap
          visible={fullScreen}
          sideways={sideways}
          onClose={() => setFullScreen(false)}
          title={site?.name ?? 'Park map'}
          brochures={brochures}
          brochureIndex={brochureIndex}
          onChooseBrochure={chooseBrochure}
          highlight={highlight}
          highlightName={highlightName}
        />
      ) : null}
    </ScrollView>
  );
}

/** The visitor centers labelled on the map; tapping one shows it, again hides it. */
function VisitorCenters({
  labels,
  names,
  selected,
  onSelect,
}: {
  labels: MapLabel[];
  names: string[];
  selected: MapLabel | null;
  onSelect: (label: MapLabel) => void;
}) {
  if (labels.length === 0) return null;
  return (
    <View style={styles.list}>
      <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.listTitle}>
        VISITOR CENTERS
      </BodyText>
      {labels.map((label, i) => {
        const active = selected === label;
        return (
          <Pressable
            key={`${label.name}-${label.x}-${label.y}`}
            onPress={() => onSelect(label)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityHint={active ? 'Zooms back out to the whole map' : 'Zooms the map to it'}
            style={({ pressed }) => [
              styles.row,
              active && styles.rowActive,
              pressed && styles.rowPressed,
            ]}
          >
            <BodyText size={13.5} weight="semibold" style={styles.rowName} numberOfLines={1}>
              {names[i]}
            </BodyText>
            <BodyText size={12.5} weight="semibold" color={colors.accentRamp[700]}>
              {active ? 'Show whole map' : 'Show on map'}
            </BodyText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A switch between a park's maps, when it has more than one. */
function BrochureChoice({
  brochures,
  index,
  onChoose,
  floating = false,
}: {
  brochures: BrochureMap[];
  index: number;
  onChoose: (index: number) => void;
  floating?: boolean;
}) {
  if (brochures.length < 2) return null;
  return (
    <View style={[styles.chips, floating && styles.chipsFloating]}>
      {brochures.map((b, i) => {
        const active = i === index;
        return (
          <Pressable
            key={b.uri}
            onPress={() => onChoose(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <BodyText
              size={11.5}
              weight="semibold"
              color={active ? colors.neutral[100] : colors.neutral[800]}
              numberOfLines={1}
            >
              {b.title}
            </BodyText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The map full screen: sideways (either way round) for a wide map, upright
 * for a tall one, and upright again when it closes. Same approach as
 * Explore's FullMapView.
 */
function FullScreenMap({
  visible,
  sideways,
  onClose,
  ...props
}: {
  visible: boolean;
  sideways: boolean;
  onClose: () => void;
  title: string;
  brochures: BrochureMap[];
  brochureIndex: number;
  onChooseBrochure: (index: number) => void;
  highlight: MapLabel | null;
  highlightName: string | null;
}) {
  useEffect(() => {
    if (!visible) return;
    ScreenOrientation.lockAsync(
      sideways
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [visible, sideways]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      // iOS keeps a modal portrait unless it's told otherwise.
      supportedOrientations={sideways ? ['landscape-left', 'landscape-right'] : ['portrait']}
      // Edge to edge on Android, so the page doesn't show through beside
      // the camera cutout or under the status and navigation bars. The
      // buttons are placed inside the safe-area insets.
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* Its own safe-area provider: the app's one keeps the upright insets
          after the phone turns. */}
      <SafeAreaProvider>
        <FullScreenBody onClose={onClose} {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function FullScreenBody({
  onClose,
  title,
  brochures,
  brochureIndex,
  onChooseBrochure,
  highlight,
  highlightName,
}: Omit<Parameters<typeof FullScreenMap>[0], 'visible' | 'sideways'>) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const brochure = brochures[brochureIndex] ?? brochures[0];

  return (
    <View style={styles.full}>
      <BrochureMapView brochure={brochure} width={width} height={height} highlight={highlight} />

      <View
        style={[
          styles.fullTop,
          { top: insets.top + space[2], left: insets.left + space[3], right: insets.right + space[3] },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close full screen"
          style={({ pressed }) => [styles.fullButton, pressed && styles.expandPressed]}
        >
          <BodyText size={18} weight="semibold" color={colors.neutral[800]}>
            ✕
          </BodyText>
        </Pressable>
        <View style={styles.fullTitle}>
          <BodyText size={13} weight="semibold" numberOfLines={1}>
            {highlightName ?? title}
          </BodyText>
        </View>
      </View>

      <View
        style={[
          styles.fullBottom,
          {
            bottom: insets.bottom + space[2],
            left: insets.left + space[3],
            right: insets.right + space[3],
          },
        ]}
        pointerEvents="box-none"
      >
        <BrochureChoice
          brochures={brochures}
          index={brochureIndex}
          onChoose={onChooseBrochure}
          floating
        />
      </View>
    </View>
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
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: space[3],
    borderRadius: radius.sm,
  },
  backPressed: {
    opacity: 0.6,
  },
  kicker: {
    marginBottom: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: space[3],
  },
  chipsFloating: {
    marginTop: 0,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  chipActive: {
    backgroundColor: colors.neutral[800],
    borderColor: colors.neutral[800],
  },
  map: {
    marginTop: space[3],
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
    ...shadow.sm,
  },
  expand: {
    position: 'absolute',
    top: space[2],
    right: space[2],
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  expandPressed: {
    backgroundColor: colors.neutral[300],
  },
  hint: {
    marginTop: space[2],
  },
  notice: {
    marginTop: space[4],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
  },
  official: {
    alignSelf: 'flex-start',
    marginTop: space[2],
  },
  list: {
    marginTop: space[4],
    gap: 2,
  },
  listTitle: {
    letterSpacing: 1,
    marginBottom: space[1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: 10,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
  },
  rowActive: {
    backgroundColor: colors.accentRamp[100],
  },
  rowPressed: {
    backgroundColor: colors.neutral[200],
  },
  rowName: {
    flex: 1,
  },
  credit: {
    marginTop: space[6],
  },
  full: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  fullTop: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  fullButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  fullTitle: {
    flexShrink: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  fullBottom: {
    position: 'absolute',
    alignItems: 'flex-start',
  },
});
