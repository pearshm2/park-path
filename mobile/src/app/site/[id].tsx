/**
 * A site's page, opened from its card's expand button: the photo, the NPS
 * description, the quick actions (Directions, Park map, Save) and every
 * fact we have, with what's still to come said plainly.
 *
 * Still to come (week 5 and after): the four match signals, current
 * conditions and alerts, camping and lodging, fees and timed entry, which
 * mostly need the NPS Data API, and accessibility once there's real
 * per-park data.
 */

import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listSites } from '../../api/parks';
import { BodyText, Button, Heading, Kicker } from '../../components';
import { BookmarkIcon } from '../../components/ParkCard';
import { DirectionsIcon, MapIcon, QuickAction } from '../../components/QuickAction';
import { Tag } from '../../components/Tag';
import { crowdLabel, factRows } from '../../data/siteFacts';
import { openDirections } from '../../lib/directions';
import { colors, radius, shadow, space } from '../../theme';
import { useWishlist } from '../../wishlist/useWishlist';

export default function SiteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ids: wishlistIds, toggle: toggleWishlist } = useWishlist();

  // Same query key as Explore, so this is already cached.
  const { data: sites, isPending } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => listSites('all'),
  });
  const site = sites?.find((candidate) => candidate.id === id);
  // Great Smoky Mountains, the busiest park, is the crowding yardstick.
  const referenceVisits = sites?.find((candidate) => candidate.id === 'grsm')?.vis ?? undefined;
  const saved = site ? wishlistIds.has(site.id) : false;

  return (
    <ScrollView
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

      {site ? (
        <>
          {site.imageUrl ? (
            <Image
              source={{ uri: site.imageUrl }}
              style={styles.photo}
              accessibilityIgnoresInvertColors
            />
          ) : null}

          <Kicker style={styles.kicker}>{`${site.kind} · ${site.state}`}</Kicker>
          <View style={styles.titleRow}>
            <Heading size={28} style={styles.title}>
              {site.name}
            </Heading>
            {site.vis !== null ? <Tag tone="accent2" label={crowdLabel(site.vis)} /> : null}
          </View>

          <View style={styles.actions}>
            <QuickAction
              label="Directions"
              accessibilityLabel={`Directions to ${site.name} in Google Maps`}
              icon={<DirectionsIcon />}
              onPress={() => openDirections(site)}
            />
            {/* The park maps cover the national parks. */}
            {site.isNamedPark ? (
              <QuickAction
                label="Park map"
                accessibilityLabel={`Park map of ${site.name}`}
                icon={<MapIcon />}
                onPress={() => router.push({ pathname: '/park-map/[id]', params: { id: site.id } })}
              />
            ) : null}
            <QuickAction
              label={saved ? 'Saved' : 'Save'}
              accessibilityLabel={
                saved ? `Remove ${site.name} from your wishlist` : `Save ${site.name} to your wishlist`
              }
              selected={saved}
              icon={<BookmarkIcon filled={saved} size={18} />}
              onPress={() => toggleWishlist(site.id)}
            />
          </View>

          {site.description ? (
            <BodyText size={14} lineHeightRatio={1.55} color={colors.neutral[800]} style={styles.description}>
              {site.description}
            </BodyText>
          ) : null}

          <View style={styles.card}>
            <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.cardTitle}>
              FACTS
            </BodyText>
            {factRows(site, referenceVisits).map((row) => (
              <View key={row.label} style={styles.row}>
                <BodyText size={13} weight="medium" color={colors.neutral[700]} style={styles.rowLabel}>
                  {row.label}
                </BodyText>
                <BodyText size={13} weight="semibold" color={row.color} style={styles.rowValue}>
                  {row.value}
                </BodyText>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <BodyText size={13.5} weight="semibold">
              Coming next
            </BodyText>
            <BodyText size={13} lineHeightRatio={1.5} color={colors.neutral[700]}>
              Current conditions and alerts, camping and lodging, fees and timed entry, and how
              well it matches you on every signal. Accessibility details coming soon.
            </BodyText>
          </View>

          {site.npsUrl ? (
            <Button
              label="Official NPS page"
              variant="ghost"
              onPress={() => Linking.openURL(site.npsUrl!)}
              style={styles.nps}
            />
          ) : null}
        </>
      ) : (
        <BodyText size={14} color={colors.neutral[700]} style={styles.description}>
          {isPending ? 'Loading…' : 'This site could not be found.'}
        </BodyText>
      )}
    </ScrollView>
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  backPressed: {
    opacity: 0.8,
  },
  photo: {
    width: '100%',
    aspectRatio: 16 / 10,
    marginTop: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[200],
  },
  kicker: {
    marginTop: space[4],
    marginBottom: space[1],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  title: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[4],
  },
  description: {
    marginTop: space[4],
  },
  card: {
    gap: space[2],
    marginTop: space[4],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  cardTitle: {
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[3],
    paddingBottom: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowLabel: {
    flex: 1,
  },
  rowValue: {
    textAlign: 'right',
    flexShrink: 1,
  },
  nps: {
    alignSelf: 'flex-start',
    marginTop: space[3],
  },
});
