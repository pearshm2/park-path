/**
 * The full detail page for one site, reached from the detail sheet's
 * "Open site".
 *
 * PLACEHOLDER: the real page is Week 5 (all nine signals, accessibility
 * callout, condition chips, directions handoff). For now it shows what we
 * already have from NPS (photo, name, description) and says plainly what
 * is coming, the same way the unbuilt tabs use ComingSoon.
 */

import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listSites } from '../../api/parks';
import { BodyText, Button, Heading, Kicker } from '../../components';
import { colors, radius, shadow, space } from '../../theme';

export default function SiteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Same query key as Explore, so this is already cached.
  const { data: sites, isPending } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => listSites('all'),
  });
  const site = sites?.find((candidate) => candidate.id === id);

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
          <Heading size={28}>{site.name}</Heading>

          {site.description ? (
            <BodyText size={14} lineHeightRatio={1.55} color={colors.neutral[800]} style={styles.description}>
              {site.description}
            </BodyText>
          ) : null}

          <View style={styles.card}>
            <BodyText size={13.5} weight="semibold">
              The full site page is coming in Week 5
            </BodyText>
            <BodyText size={13} lineHeightRatio={1.5} color={colors.neutral[700]}>
              How well it matches you on every signal, accessibility, conditions, camping and
              lodging, and directions to the visitor center in your maps app.
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
  description: {
    marginTop: space[3],
  },
  card: {
    gap: space[2],
    marginTop: space[6],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  nps: {
    alignSelf: 'flex-start',
    marginTop: space[3],
  },
});
