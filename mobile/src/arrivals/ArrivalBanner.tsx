/**
 * The arrival nudge: a banner that slides down from the top when you've
 * arrived at a park (see ArrivalsContext). "Start an entry" opens a new
 * journal entry for that park; "Later" puts it away.
 */

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listSites } from '../api/parks';
import { useAuth } from '../auth/AuthContext';
import { BodyText, Button } from '../components';
import { PinIcon } from '../components/trips/NewEntrySheet';
import { colors, radius, shadow, space } from '../theme';
import { useArrivals } from './ArrivalsContext';

export function ArrivalBanner() {
  const { arrival, dismiss } = useArrivals();
  const { status } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: sites = [] } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => listSites('all'),
    enabled: arrival !== null,
  });

  if (!arrival || status !== 'signedIn') return null;
  const site = sites.find((s) => s.id === arrival);
  // "Zion" + "National Park"; names that already end in it stay as they are.
  const name = site
    ? site.name.endsWith(site.kind)
      ? site.name
      : `${site.name} ${site.kind}`
    : 'a park';

  return (
    <Animated.View
      entering={SlideInUp.duration(320)}
      exiting={SlideOutUp.duration(220)}
      style={[styles.banner, { top: insets.top + space[2] }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View style={styles.heading}>
        <PinIcon color={colors.accent2Ramp[700]} size={18} />
        <BodyText size={15} weight="semibold" style={styles.title}>
          {`You've arrived at ${name}`}
        </BodyText>
      </View>
      <BodyText size={13} lineHeightRatio={1.45} color={colors.neutral[700]}>
        Don&apos;t forget to document your trip with photos and more!
      </BodyText>
      <View style={styles.actions}>
        <Pressable
          onPress={dismiss}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.later, pressed && styles.laterPressed]}
        >
          <BodyText size={13} weight="semibold" color={colors.neutral[700]}>
            Later
          </BodyText>
        </Pressable>
        <Button
          label="Start an entry"
          onPress={() => {
            dismiss();
            router.navigate({ pathname: '/trips', params: { add: arrival } });
          }}
          style={styles.start}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: space[3],
    right: space[3],
    gap: space[2],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.accent2Ramp[300],
    backgroundColor: colors.neutral[100],
    zIndex: 100,
    ...shadow.lg,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  title: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space[3],
    marginTop: space[1],
  },
  later: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  laterPressed: {
    backgroundColor: colors.neutral[200],
  },
  start: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
