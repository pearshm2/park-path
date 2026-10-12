/**
 * A national park's own trail map, drawn in the app's style: the park's
 * boundary in its region's tint, roads in grey, trails on top. Tapping a
 * trail (on the map or in the list under it) highlights it and shows its
 * length, who can use it and its surface.
 *
 * The data is the NPS's public GIS trails, roads and boundaries, synced
 * into our API (GET /sites/{code}/map). Where the NPS has no trail data
 * (Gates of the Arctic has no maintained trails; Sequoia & Kings Canyon
 * isn't in the dataset) the screen says so, and the official park map on
 * nps.gov is always one tap away.
 */

import { useQuery } from '@tanstack/react-query';
import { geoMercator } from 'd3-geo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  fetchParkMap,
  officialMapUrl,
  type MapPath,
  type ParkMap,
  type TrailUse,
} from '../../api/parkMaps';
import { listSites } from '../../api/parks';
import { BodyText, Button, Heading, Kicker } from '../../components';
import { regionForState } from '../../data/regions';
import { colors, radius, shadow, space } from '../../theme';

const USE_LABEL: Record<TrailUse, string> = {
  hike: 'Hiking',
  horse: 'Horses',
  bike: 'Bikes',
  motorized: 'Motorized',
};

const TRAIL_INK = colors.accentRamp[800];
const TRAIL_SELECTED = colors.accent;
const ROAD_INK = colors.neutral[500];
const PAD = 12;

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

/** SVG path data for the map at a given size, or null if there is nothing to draw. */
function draw(map: ParkMap, width: number, height: number) {
  const fitTo = map.boundary.length
    ? map.boundary.flat()
    : [...map.trails, ...map.roads].flatMap((line) => line.paths.flat());
  if (fitTo.length === 0) return null;

  // Projected point by point rather than through geoPath: the NPS rings
  // wind the way GeoJSON specifies, which d3's spherical polygons read as
  // "everything but the park".
  const projection = geoMercator().fitExtent(
    [
      [PAD, PAD],
      [width - PAD, height - PAD],
    ],
    { type: 'MultiPoint', coordinates: fitTo },
  );
  const toD = (paths: MapPath[], close = false) =>
    paths
      .map(
        (path) =>
          path
            .map((point, i) => {
              const [x, y] = projection(point) ?? [0, 0];
              return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join('') + (close ? 'Z' : ''),
      )
      .join('');

  return {
    boundary: toD(map.boundary, true),
    roads: map.roads.map((road, i) => ({ key: i, kind: road.kind, d: toD(road.paths) })),
    trails: map.trails.map((trail, i) => ({
      key: i,
      name: trail.name,
      closed: trail.closed,
      d: toD(trail.paths),
    })),
  };
}

export default function ParkMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [selected, setSelected] = useState<string | null>(null);

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

  const mapWidth = windowWidth - space[4] * 2;
  const mapHeight = Math.min(Math.round(mapWidth * 1.05), 520);
  const drawn = useMemo(
    () => (parkMap ? draw(parkMap, mapWidth, mapHeight) : null),
    [parkMap, mapWidth, mapHeight],
  );
  const trails = useMemo(() => (parkMap ? summarise(parkMap) : []), [parkMap]);
  const chosen = trails.find((trail) => trail.name === selected);
  const tint = site ? regionForState(site.state) : undefined;
  const mapsPage = parkMap?.officialMapUrl ?? officialMapUrl(id);

  function choose(name: string | null) {
    setSelected((current) => (current === name ? null : name));
  }

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

      <Kicker style={styles.kicker}>Trail map</Kicker>
      <Heading size={26}>{site?.name ?? 'Park map'}</Heading>

      {drawn ? (
        <>
          <View style={[styles.map, { height: mapHeight }]}>
            <Svg width={mapWidth} height={mapHeight}>
              {drawn.boundary ? (
                <Path
                  d={drawn.boundary}
                  fill={tint?.fill ?? colors.accent2Ramp[100]}
                  fillRule="evenodd"
                  stroke={colors.neutral[600]}
                  strokeWidth={1}
                  strokeLinejoin="round"
                />
              ) : null}
              {drawn.roads.map((road) => (
                <Path
                  key={`road-${road.key}`}
                  d={road.d}
                  fill="none"
                  stroke={ROAD_INK}
                  strokeWidth={road.kind === 'primary' ? 2.2 : road.kind === 'secondary' ? 1.6 : 1}
                  strokeDasharray={road.kind === '4wd' ? '3 3' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {drawn.trails.map((trail) => (
                <Path
                  key={`trail-${trail.key}`}
                  d={trail.d}
                  fill="none"
                  stroke={TRAIL_INK}
                  strokeOpacity={selected && trail.name !== selected ? 0.45 : 1}
                  strokeWidth={1.4}
                  strokeDasharray={trail.closed ? '2 3' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {/* The selected trail again, on top of everything else. */}
              {drawn.trails
                .filter((trail) => trail.name !== null && trail.name === selected)
                .map((trail) => (
                  <Path
                    key={`selected-${trail.key}`}
                    d={trail.d}
                    fill="none"
                    stroke={TRAIL_SELECTED}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              {/* Wide, nearly invisible copies of the named trails, so a
                  thin line is still easy to tap. */}
              {drawn.trails
                .filter((trail) => trail.name !== null)
                .map((trail) => (
                  <Path
                    key={`hit-${trail.key}`}
                    d={trail.d}
                    fill="none"
                    stroke="#000"
                    strokeOpacity={0.01}
                    strokeWidth={14}
                    onPress={() => choose(trail.name)}
                  />
                ))}
            </Svg>
          </View>

          <View style={styles.legend}>
            <LegendLine color={TRAIL_INK} label="Trail" />
            <LegendLine color={TRAIL_INK} dashed label="Temporarily closed" />
            <LegendLine color={ROAD_INK} label="Road" />
          </View>

          {chosen ? (
            <View style={styles.selectedCard}>
              <BodyText size={15} weight="semibold">
                {chosen.name}
              </BodyText>
              <BodyText size={12.5} color={colors.neutral[700]}>
                {[
                  `${chosen.miles.toFixed(1)} mi`,
                  chosen.uses.map((use) => USE_LABEL[use]).join(', '),
                  chosen.surfaces.join(', '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </BodyText>
              {chosen.closed ? (
                <BodyText size={12.5} weight="semibold" color={colors.accentRamp[800]}>
                  Part of this trail is temporarily closed.
                </BodyText>
              ) : null}
            </View>
          ) : trails.length > 0 ? (
            <BodyText size={12.5} color={colors.textMuted} style={styles.hint}>
              Tap a trail on the map or in the list for its details.
            </BodyText>
          ) : null}
        </>
      ) : (
        <View style={styles.notice}>
          <BodyText size={13.5} lineHeightRatio={1.5} color={colors.neutral[700]}>
            {isPending
              ? 'Loading the trail map…'
              : isError
                ? "Couldn't load the trail map. Check your connection and try again."
                : "We don't have a trail map for this park yet."}
          </BodyText>
        </View>
      )}

      {parkMap && trails.length === 0 ? (
        <BodyText size={12.5} lineHeightRatio={1.5} color={colors.textMuted} style={styles.hint}>
          The National Park Service doesn&apos;t publish trail data for this park. The official
          park map has what&apos;s there.
        </BodyText>
      ) : null}

      <Button
        label="Official park map (nps.gov)"
        variant="ghost"
        onPress={() => Linking.openURL(mapsPage)}
        style={styles.official}
      />

      {trails.length > 0 ? (
        <View style={styles.list}>
          <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.listTitle}>
            {`${trails.length} ${trails.length === 1 ? 'TRAIL' : 'TRAILS'}`}
          </BodyText>
          {trails.map((trail) => {
            const active = trail.name === selected;
            return (
              <Pressable
                key={trail.name}
                onPress={() => {
                  choose(trail.name);
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
        Trails, roads and boundary: National Park Service.
      </BodyText>
    </ScrollView>
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
  map: {
    marginTop: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
    ...shadow.sm,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
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
  hint: {
    marginTop: space[3],
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
});
