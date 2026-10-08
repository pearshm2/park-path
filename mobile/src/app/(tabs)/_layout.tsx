/**
 * The signed-in app: five tabs in a floating bar, with Explore in the
 * middle as an accent circle raised into a notch in the bar — it is where
 * the quiz lands and the centre of the app. The other four keep their
 * labels; the current tab is marked by accent colour and a dot beneath.
 *
 * Icon paths are lifted from the prototype's bottom nav and drawn at
 * stroke-width 2.75, which is the weight the design system specifies for
 * every icon in the system.
 */

import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useAuth } from '../../auth/AuthContext';
import { useQuiz } from '../../quiz/QuizContext';
import { colors, fonts, radius, shadow, space } from '../../theme';

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

// The cog's teeth run to the edge of the 24-unit box, so the viewBox is
// padded to keep the stroke from being clipped.
function SettingsIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="-1.5 -1.5 27 27" fill="none">
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
      // Explore is not first in the bar, so name it as the start tab and
      // send Android's back button there rather than to Passport.
      initialRouteName="explore"
      backBehavior="initialRoute"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: styles.scene,
      }}
    >
      <Tabs.Screen
        name="passport"
        options={{ title: 'Passport', tabBarIcon: ({ color }) => <PassportIcon color={color} /> }}
      />
      <Tabs.Screen
        name="trips"
        options={{ title: 'Trips', tabBarIcon: ({ color }) => <TripsIcon color={color} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Explore', tabBarIcon: ({ color }) => <ExploreIcon color={color} /> }}
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

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** The tab drawn as the raised circle. */
const CENTER_ROUTE = 'explore';

const BAR_HEIGHT = 66;
const CIRCLE = 54;
/** A ring in the page colour around the circle, which reads as a notch in the bar. */
const RING = 6;
/** How far the circle (with its ring) rises above the bar's top edge. */
const RAISE = 26;
const LABEL_LINE = 13;

/**
 * The floating bar. The circle is drawn on the wrapper rather than inside
 * the bar so all of it stays tappable: Android ignores touches on the part
 * of a child that hangs outside its parent.
 */
function FloatingTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  function go(index: number) {
    const route = state.routes[index];
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  }

  const centerIndex = state.routes.findIndex((route) => route.name === CENTER_ROUTE);
  const centerFocused = state.index === centerIndex;

  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, space[2]) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const center = index === centerIndex;
          const color = focused ? colors.accent : colors.neutral[500];

          return (
            <Pressable
              key={route.key}
              onPress={() => go(index)}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.title ?? route.name}
              style={styles.tab}
            >
              {/* The centre slot only holds the dot, level with the others';
                  the circle sits above it and needs no label. */}
              {center ? (
                <View style={styles.centerSpacer} />
              ) : (
                <>
                  {options.tabBarIcon?.({ focused, color, size: 23 })}
                  <Text style={[styles.label, { color }]} numberOfLines={1}>
                    {options.title ?? route.name}
                  </Text>
                </>
              )}
              <View style={[styles.dot, focused && styles.dotActive]} />
            </Pressable>
          );
        })}
      </View>

      {centerIndex >= 0 ? (
        <Pressable
          onPress={() => go(centerIndex)}
          accessibilityRole="tab"
          accessibilityState={{ selected: centerFocused }}
          accessibilityLabel={descriptors[state.routes[centerIndex].key].options.title ?? 'Explore'}
          style={styles.centerRing}
        >
          {({ pressed }) => (
            <View
              style={[
                styles.centerButton,
                // One fixed colour (the dot marks focus): Android can drop the
                // rounding when a rounded view's background changes after mount.
                pressed && styles.centerButtonPressed,
              ]}
            >
              <ExploreIcon color={colors.neutral[100]} />
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    // Leaves room above the bar for the raised circle, so it never
    // overlaps the screen above.
    paddingTop: RAISE,
    paddingHorizontal: space[4],
    backgroundColor: colors.bg,
  },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 3,
    fontFamily: fonts.bodySemibold,
    fontSize: 10.5,
    lineHeight: LABEL_LINE,
  },
  /** Icon plus label height, so the Explore dot lines up with the rest. */
  centerSpacer: {
    height: 23 + 3 + LABEL_LINE,
  },
  dot: {
    width: 6,
    height: 6,
    marginTop: 3,
    borderRadius: radius.pill,
    // Always filled and shown or hidden by opacity: on Android, changing a
    // rounded view's background colour after mount can drop the rounding.
    backgroundColor: colors.accent,
    opacity: 0,
  },
  dotActive: {
    opacity: 1,
  },
  centerRing: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: CIRCLE + RING * 2,
    height: CIRCLE + RING * 2,
    borderRadius: (CIRCLE + RING * 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  centerButton: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    ...shadow.sm,
  },
  centerButtonPressed: {
    opacity: 0.85,
  },
  scene: {
    backgroundColor: colors.bg,
  },
});
