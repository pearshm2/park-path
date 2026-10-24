/**
 * The notification for something a trip earned (CelebrationsContext.tsx):
 * a banner that slides down from the top with a chime, and goes after a
 * few seconds or when swiped up. Tapping it opens where it's revealed: an
 * achievement in Passport's Achievements, a region on Passport's map.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '../auth/AuthContext';
import { BodyText } from '../components';
import { playSound, tap } from '../lib/sounds';
import { colors, radius, shadow, space } from '../theme';
import { useCelebrations } from './CelebrationsContext';

/** How long a notification stays up untouched. */
const SHOW_MS = 6000;

export function CelebrationBanner() {
  const { notice, dismissNotice } = useCelebrations();
  const { status } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Chime as each one arrives; and put it away after a while.
  useEffect(() => {
    if (!notice) return;
    playSound('chime');
    tap('light');
    const timer = setTimeout(dismissNotice, SHOW_MS);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (!notice || status !== 'signedIn') return null;

  function open() {
    if (!notice) return;
    dismissNotice();
    if (notice.kind === 'achievement') {
      router.navigate({ pathname: '/passport', params: { show: 'achievements' } });
    } else {
      router.navigate({ pathname: '/passport', params: { show: 'region', region: notice.region } });
    }
  }

  return (
    <Animated.View
      key={notice.id}
      entering={SlideInUp.springify().damping(18)}
      exiting={SlideOutUp.duration(220)}
      style={[styles.wrap, { top: insets.top + space[2] }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityHint="Opens it in your Passport"
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
      >
        <View style={styles.badge}>
          {notice.kind === 'achievement' ? <MedalIcon /> : <RegionIcon />}
        </View>
        <View style={styles.text}>
          <BodyText size={13.5} weight="bold" color={colors.neutral[100]} numberOfLines={1}>
            {notice.title}
          </BodyText>
          <BodyText size={12} lineHeightRatio={1.35} color="rgba(249, 244, 237, 0.8)" numberOfLines={2}>
            {notice.body}
          </BodyText>
        </View>
        <Pressable onPress={dismissNotice} hitSlop={10} accessibilityLabel="Dismiss" style={styles.close}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path d="M6 6l12 12M18 6L6 18" stroke={colors.neutral[100]} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

function MedalIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M8 2.5l2.5 6M16 2.5l-2.5 6" stroke="#5c1316" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 9a6 6 0 100 12 6 6 0 000-12z" fill="#5c1316" />
      <Path d="M12 12.2l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="#f3d27a" />
    </Svg>
  );
}

function RegionIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z" fill="#5c1316" />
      <Path d="M8.5 12.5l2.2 2.2 4.8-4.8" stroke="#f3d27a" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space[3],
    right: space[3],
    zIndex: 50,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    backgroundColor: '#5c1316',
    borderWidth: 1.5,
    borderColor: '#d9a94a',
    ...shadow.lg,
  },
  pressed: {
    opacity: 0.9,
  },
  badge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#f3d27a',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  close: {
    padding: 4,
  },
});
