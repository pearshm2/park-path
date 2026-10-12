/**
 * A national park's maps, three ways, switched at the top:
 *
 *   - Trail map: drawn in the app's style from the NPS's trails, roads and
 *     boundary.
 *   - Real map: Apple Maps / Google Maps (map, terrain or satellite) with
 *     the same trails on top.
 *   - Park brochure: the official NPS printed map.
 *
 * All three pinch to zoom, and the expand button turns the phone sideways
 * into a full-screen view, like Explore's map. Visitor centers are green
 * stars; where you are is a red "you are here" star, once location is
 * allowed and you're in the park. Tapping a trail (on the map or in the
 * list) highlights it and shows its length, uses and surface.
 *
 * Gaps in the NPS data: Gates of the Arctic has no maintained trails and
 * Sequoia & Kings Canyon's aren't published; both still have the brochure.
 */

import { useQuery } from '@tanstack/react-query';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import Svg, { Path } from 'react-native-svg';

import { fetchParkMap, officialMapUrl, type ParkMap, type TrailUse } from '../../api/parkMaps';
import { listSites } from '../../api/parks';
import { BodyText, Button, ExpandIcon, Heading, Kicker } from '../../components';
import {
  isOnMap,
  ROAD_INK,
  TRAIL_INK,
  type MapSelection,
} from '../../components/maps/DrawnParkMap';
import { ParkMapCanvas, type MapKind } from '../../components/maps/ParkMapCanvas';
import type { RealMapStyle } from '../../components/maps/RealParkMap';
import { StarIcon, VISITOR_CENTER_STAR, YOU_STAR } from '../../components/maps/stars';
import { regionForState } from '../../data/regions';
import { useYouAreHere } from '../../location/useYouAreHere';
import { colors, radius, shadow, space } from '../../theme';

const USE_LABEL: Record<TrailUse, string> = {
  hike: 'Hiking',
  horse: 'Horses',
  bike: 'Bikes',
  motorized: 'Motorized',
};

const KINDS: { value: MapKind; label: string }[] = [
  { value: 'drawn', label: 'Trail map' },
  { value: 'real', label: 'Real map' },
  { value: 'brochure', label: 'Park brochure' },
];

const REAL_STYLES: { value: RealMapStyle; label: string }[] = [
  { value: 'standard', label: 'Map' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'satellite', label: 'Satellite' },
];

/** One named trail as the list shows it: all its NPS entries merged. */
type TrailSummary = {
  name: string;
  miles: number;
  uses: TrailUse[];
  surfaces: string[];
  closed: boolean;
};

function summarise(map: ParkMap): TrailSummary[] {
  const byName = new Map<string, TrailSummary>();
  for (const trail of map.trails) {
    if (!trail.name) continue;
    const entry = byName.get(trail.name) ?? {
      name: trail.name,
      miles: 0,
      uses: [],
      surfaces: [],
      closed: false,
    };
    entry.miles += trail.lengthMiles;
    for (const use of trail.uses) if (!entry.uses.includes(use)) entry.uses.push(use);
    if (trail.surface && !entry.surfaces.includes(trail.surface)) entry.surfaces.push(trail.surface);
    entry.closed ||= trail.closed;
    byName.set(trail.name, entry);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function ParkMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [kind, setKind] = useState<MapKind>('drawn');
  const [realStyle, setRealStyle] = useState<RealMapStyle>('terrain');
  const [brochureIndex, setBrochureIndex] = useState(0);
  const [selection, setSelection] = useState<MapSelection>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const you = useYouAreHere();

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
    // Trails don't change between visits to the screen.
    staleTime: Infinity,
  });

  const trails = useMemo(() => (parkMap ? summarise(parkMap) : []), [parkMap]);
  const tint = (site && regionForState(site.state)?.fill) ?? colors.accent2Ramp[100];
  const mapsPage = parkMap?.officialMapUrl ?? officialMapUrl(id);
  const kinds = KINDS.filter((k) => k.value !== 'brochure' || (parkMap?.brochures.length ?? 0) > 0);
  const inPark = parkMap ? isOnMap(parkMap, you.point) : false;

  const mapWidth = windowWidth - space[4] * 2;
  const mapHeight = Math.min(Math.round(mapWidth * 1.05), 520);

  const canvasProps = parkMap
    ? {
        kind,
        map: parkMap,
        tint,
        you: you.point,
        realStyle,
        brochureIndex,
        selection,
        onSelect: setSelection,
      }
    : null;

  return (
    <ScrollView
      ref={scrollRef}
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

      <Kicker style={styles.kicker}>Park maps</Kicker>
      <Heading size={26}>{site?.name ?? 'Park map'}</Heading>

      {parkMap && canvasProps ? (
        <>
          <Segmented options={kinds} value={kind} onChange={setKind} style={styles.kinds} />
          <MapOptions
            kind={kind}
            map={parkMap}
            realStyle={realStyle}
            onRealStyle={setRealStyle}
            brochureIndex={brochureIndex}
            onBrochure={setBrochureIndex}
          />

          <View style={[styles.map, { height: mapHeight }]}>
            <ParkMapCanvas {...canvasProps} width={mapWidth} height={mapHeight} />
            <Pressable
              onPress={() => setFullScreen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Full screen, sideways"
              style={({ pressed }) => [styles.expand, pressed && styles.expandPressed]}
            >
              <ExpandIcon color={colors.neutral[800]} />
            </Pressable>
          </View>

          <BodyText size={11.5} color={colors.textMuted} style={styles.hint}>
            {kind === 'real'
              ? 'Pinch and drag to explore. Tap a trail or a star for details.'
              : 'Pinch or double-tap to zoom. Tap the expand button to turn it sideways.'}
          </BodyText>

          {kind !== 'brochure' ? <Legend kind={kind} /> : null}
          <LocationNote kind={kind} status={you.status} hasFix={you.point !== null} inPark={inPark} />
          <SelectionCard selection={selection} trails={trails} />
        </>
      ) : (
        <View style={styles.notice}>
          <BodyText size={13.5} lineHeightRatio={1.5} color={colors.neutral[700]}>
            {isPending
              ? 'Loading the park maps…'
              : isError
                ? "Couldn't load the park maps. Check your connection and try again."
                : "We don't have maps for this park yet."}
          </BodyText>
        </View>
      )}

      {parkMap && trails.length === 0 && kind !== 'brochure' ? (
        <BodyText size={12.5} lineHeightRatio={1.5} color={colors.textMuted} style={styles.hint}>
          The National Park Service doesn&apos;t publish trail data for this park. The park
          brochure map has what&apos;s there.
        </BodyText>
      ) : null}

      <Button
        label="Official park maps (nps.gov)"
        variant="ghost"
        onPress={() => Linking.openURL(mapsPage)}
        style={styles.official}
      />

      {trails.length > 0 && kind !== 'brochure' ? (
        <View style={styles.list}>
          <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.listTitle}>
            {`${trails.length} ${trails.length === 1 ? 'TRAIL' : 'TRAILS'}`}
          </BodyText>
          {trails.map((trail) => {
            const active = selection !== null && 'trail' in selection && selection.trail === trail.name;
            return (
              <Pressable
                key={trail.name}
                onPress={() => {
                  setSelection(active ? null : { trail: trail.name });
                  // Back up to the map so the highlight is in view.
                  if (!active) scrollRef.current?.scrollTo({ y: 0, animated: true });
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.row,
                  active && styles.rowActive,
                  pressed && styles.rowPressed,
                ]}
              >
                <BodyText size={13.5} weight="semibold" style={styles.rowName} numberOfLines={1}>
                  {trail.name}
                </BodyText>
                <BodyText size={12.5} color={colors.neutral[600]}>
                  {`${trail.miles.toFixed(1)} mi`}
                </BodyText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <BodyText size={11} color={colors.textMuted} style={styles.credit}>
        Trails, roads, boundaries, visitor centers and brochure maps: National Park Service.
      </BodyText>

      {parkMap && canvasProps ? (
        <FullScreenMap
          visible={fullScreen}
          onClose={() => setFullScreen(false)}
          title={site?.name ?? 'Park map'}
          kinds={kinds}
          onKind={setKind}
          canvasProps={canvasProps}
          trails={trails}
          onRealStyle={setRealStyle}
          onBrochure={setBrochureIndex}
        />
      ) : null}
    </ScrollView>
  );
}

type CanvasProps = Omit<Parameters<typeof ParkMapCanvas>[0], 'width' | 'height'>;

/**
 * The chosen map, full screen and sideways — as soon as it opens, either
 * way round, upright again when it closes. Same approach as Explore's
 * FullMapView.
 */
function FullScreenMap({
  visible,
  onClose,
  ...props
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  kinds: { value: MapKind; label: string }[];
  onKind: (kind: MapKind) => void;
  canvasProps: CanvasProps;
  trails: TrailSummary[];
  onRealStyle: (style: RealMapStyle) => void;
  onBrochure: (index: number) => void;
}) {
  useEffect(() => {
    if (!visible) return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      // iOS keeps a modal portrait unless it's told otherwise.
      supportedOrientations={['landscape-left', 'landscape-right']}
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
  kinds,
  onKind,
  canvasProps,
  trails,
  onRealStyle,
  onBrochure,
}: Omit<Parameters<typeof FullScreenMap>[0], 'visible'>) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.full}>
      <ParkMapCanvas {...canvasProps} width={width} height={height} />

      <View
        style={[styles.fullTop, { top: insets.top + space[2], left: insets.left + space[3], right: insets.right + space[3] }]}
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
            {title}
          </BodyText>
        </View>
        <Segmented options={kinds} value={canvasProps.kind} onChange={onKind} compact />
      </View>

      <View
        style={[styles.fullBottom, { bottom: insets.bottom + space[2], left: insets.left + space[3], right: insets.right + space[3] }]}
        pointerEvents="box-none"
      >
        <MapOptions
          kind={canvasProps.kind}
          map={canvasProps.map}
          realStyle={canvasProps.realStyle}
          onRealStyle={onRealStyle}
          brochureIndex={canvasProps.brochureIndex}
          onBrochure={onBrochure}
          floating
        />
        {canvasProps.kind !== 'brochure' ? (
          <SelectionCard selection={canvasProps.selection} trails={trails} floating />
        ) : null}
      </View>
    </View>
  );
}

/** The real map's style, or which brochure, depending on the map shown. */
function MapOptions({
  kind,
  map,
  realStyle,
  onRealStyle,
  brochureIndex,
  onBrochure,
  floating = false,
}: {
  kind: MapKind;
  map: ParkMap;
  realStyle: RealMapStyle;
  onRealStyle: (style: RealMapStyle) => void;
  brochureIndex: number;
  onBrochure: (index: number) => void;
  floating?: boolean;
}) {
  if (kind === 'real') {
    return (
      <Chips
        options={REAL_STYLES}
        value={realStyle}
        onChange={onRealStyle}
        floating={floating}
      />
    );
  }
  if (kind === 'brochure' && map.brochures.length > 1) {
    return (
      <Chips
        options={map.brochures.map((b, i) => ({ value: i, label: b.title }))}
        value={brochureIndex}
        onChange={onBrochure}
        floating={floating}
      />
    );
  }
  return null;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact = false,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
  style?: object;
}) {
  return (
    <View style={[styles.switch, compact && styles.switchCompact, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.switchOption, compact && styles.switchOptionCompact, active && styles.switchActive]}
          >
            <BodyText
              size={compact ? 11.5 : 12.5}
              weight="semibold"
              color={active ? colors.neutral[100] : colors.neutral[700]}
              numberOfLines={1}
            >
              {option.label}
            </BodyText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Chips<T extends string | number>({
  options,
  value,
  onChange,
  floating,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  floating: boolean;
}) {
  return (
    <View style={[styles.chips, floating && styles.chipsFloating]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
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
              {option.label}
            </BodyText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Legend({ kind }: { kind: MapKind }) {
  return (
    <View style={styles.legend}>
      <LegendLine color={TRAIL_INK} label="Trail" />
      <LegendLine color={TRAIL_INK} dashed label="Temporarily closed" />
      {kind === 'drawn' ? <LegendLine color={ROAD_INK} label="Road" /> : null}
      <View style={styles.legendItem}>
        <StarIcon color={VISITOR_CENTER_STAR} size={13} />
        <BodyText size={11.5} color={colors.neutral[700]}>
          Visitor center
        </BodyText>
      </View>
      <View style={styles.legendItem}>
        <StarIcon color={YOU_STAR} size={13} />
        <BodyText size={11.5} color={colors.neutral[700]}>
          You are here
        </BodyText>
      </View>
    </View>
  );
}

function LegendLine({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <Svg width={22} height={6}>
        <Path
          d="M1,3L21,3"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dashed ? '2 3' : undefined}
          strokeLinecap="round"
        />
      </Svg>
      <BodyText size={11.5} color={colors.neutral[700]}>
        {label}
      </BodyText>
    </View>
  );
}

/** Why there's no red star, when there isn't one. */
function LocationNote({
  kind,
  status,
  hasFix,
  inPark,
}: {
  kind: MapKind;
  status: 'asking' | 'granted' | 'denied';
  hasFix: boolean;
  inPark: boolean;
}) {
  let note: string | null = null;
  if (kind === 'brochure') {
    note = 'The brochure is the printed map, so it has no "you are here" star. Switch to the trail or real map for that.';
  } else if (status === 'denied') {
    note = 'Allow location for ParkPath in your phone\'s settings to see a "you are here" star.';
  } else if (status === 'granted' && hasFix && !inPark) {
    note = "You're not in the park right now. The red star shows where you are once you're here.";
  }
  return note ? (
    <BodyText size={12} lineHeightRatio={1.45} color={colors.textMuted} style={styles.hint}>
      {note}
    </BodyText>
  ) : null;
}

function SelectionCard({
  selection,
  trails,
  floating = false,
}: {
  selection: MapSelection;
  trails: TrailSummary[];
  floating?: boolean;
}) {
  if (!selection) return null;
  if ('place' in selection) {
    return (
      <View style={[styles.selectedCard, floating && styles.selectedFloating]}>
        <View style={styles.legendItem}>
          <StarIcon color={VISITOR_CENTER_STAR} size={15} />
          <BodyText size={15} weight="semibold">
            {selection.place.name}
          </BodyText>
        </View>
        <BodyText size={12.5} color={colors.neutral[700]}>
          Visitor center
        </BodyText>
      </View>
    );
  }
  const trail = trails.find((t) => t.name === selection.trail);
  if (!trail) return null;
  return (
    <View style={[styles.selectedCard, floating && styles.selectedFloating]}>
      <BodyText size={15} weight="semibold">
        {trail.name}
      </BodyText>
      <BodyText size={12.5} color={colors.neutral[700]}>
        {[
          `${trail.miles.toFixed(1)} mi`,
          trail.uses.map((use) => USE_LABEL[use]).join(', '),
          trail.surfaces.join(', '),
        ]
          .filter(Boolean)
          .join(' · ')}
      </BodyText>
      {trail.closed ? (
        <BodyText size={12.5} weight="semibold" color={colors.accentRamp[800]}>
          Part of this trail is temporarily closed.
        </BodyText>
      ) : null}
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
  kinds: {
    marginTop: space[4],
  },
  switch: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  switchCompact: {
    ...shadow.sm,
  },
  switchOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
  },
  switchOptionCompact: {
    flex: 0,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  switchActive: {
    backgroundColor: colors.accent,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: space[2],
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space[4],
    rowGap: space[1],
    marginTop: space[2],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedCard: {
    gap: 3,
    marginTop: space[3],
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.accentRamp[100],
  },
  selectedFloating: {
    marginTop: 0,
    maxWidth: 360,
    ...shadow.md,
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
    marginRight: 'auto',
    ...shadow.sm,
  },
  fullBottom: {
    position: 'absolute',
    alignItems: 'flex-start',
    gap: space[2],
  },
});
