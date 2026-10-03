/**
 * The signed-in app: the prototype's five tabs.
 *
 * Icon paths are lifted from the prototype's bottom nav and drawn at
 * stroke-width 2.75, which is the weight the design system specifies for
 * every icon in the system.
 */

import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, type ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useAuth } from '../../auth/AuthContext';
import { useQuiz } from '../../quiz/QuizContext';
import { colors, fonts } from '../../theme';

const ICON_SIZE = 23;
const STROKE = 2.75;

function ExploreIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={STROKE} />
      <Path
        d="M15.5 8.5l-2 5.5-5.5 2 2-5.5z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TripsIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 4h13a1 1 0 011 1v14a1 1 0 01-1 1H5z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M5 4v16" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M9 9h6M9 13h4" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

function PassportIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={9} r={5.5} stroke={color} strokeWidth={STROKE} />
      <Path
        d="M8.5 14L7 21l5-2.5L17 21l-1.5-7"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FriendsIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.5} stroke={color} strokeWidth={STROKE} />
      <Path
        d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M16 5.5a3.5 3.5 0 010 6.6" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path
        d="M18 20c0-2.3-.8-4.2-2-5.4"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SettingsIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <Path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" stroke={color} strokeWidth={STROKE} />
      <Path
        d="M19.3 14.5a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.3a2 2 0 01-4 0v-.2a1.6 1.6 0 00-2.7-1.2l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7h-.3a2 2 0 010-4h.2A1.6 1.6 0 004.6 6l-.1-.1a2 2 0 012.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V2a2 2 0 014 0v.2a1.6 1.6 0 002.7 1.2l.1-.1a2 2 0 012.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.3a2 2 0 010 4h-.2a1.6 1.6 0 00-1.5 1.6z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function TabsLayout() {
  const { status } = useAuth();
  const { completed } = useQuiz();

  if (status !== 'signedIn') return <Redirect href="/sign-in" />;
  // The app's content is keyed off the quiz answers, so there is nothing
  // meaningful to show before it has been taken.
  if (!completed) return <Redirect href="/quiz" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.neutral[600],
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        sceneStyle: styles.scene,
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{ title: 'Explore', tabBarIcon: ({ color }) => <ExploreIcon color={color} /> }}
      />
      <Tabs.Screen
        name="trips"
        options={{ title: 'Trips', tabBarIcon: ({ color }) => <TripsIcon color={color} /> }}
      />
      <Tabs.Screen
        name="passport"
        options={{ title: 'Passport', tabBarIcon: ({ color }) => <PassportIcon color={color} /> }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: 'Friends', tabBarIcon: ({ color }) => <FriendsIcon color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color }) => <SettingsIcon color={color} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.neutral[100],
    borderTopColor: colors.divider,
    borderTopWidth: 1,
  },
  tabLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10.5,
  },
  scene: {
    backgroundColor: colors.bg,
  },
});
