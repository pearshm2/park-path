/**
 * The floating tab bar's measurements, shared with the screens under it.
 *
 * The bar floats over the tab screens rather than taking its own strip at
 * the bottom, so the Explore card sheet can run down behind it. Each screen
 * keeps its own content clear of it with `useTabBarSpace()`.
 */

import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BAR_HEIGHT = 66;
/** How far the Explore circle (with its ring) rises above the bar's top edge. */
export const RAISE = 18;

/**
 * Space under the bar. With a gesture bar at the bottom (Android's
 * gesture navigation, iPhone's home indicator), half the bottom inset, so
 * the bar sits partly in that zone, but never under 16, which clears the
 * indicator line (its top sits about 13 up from the edge). Android's
 * button navigation (◁ ○ ▢) is a full bar of buttons, about 48 tall, that
 * the app now draws behind (edge to edge): the bar sits wholly above it,
 * or the buttons land on top of the tabs. With no inset at all, the app
 * ends above the system's bar already, so a small gap does.
 */
export function tabBarBottom(insetBottom: number): number {
  if (insetBottom < 1) return 6;
  if (Platform.OS === 'android' && insetBottom >= BUTTON_NAV_MIN) return insetBottom + 6;
  return Math.max(insetBottom / 2, 16);
}

/**
 * An Android bottom inset this tall is button navigation (about 48);
 * gesture navigation's is about 16 to 24.
 */
const BUTTON_NAV_MIN = 32;

/** How much of the bottom of the screen the bar covers, circle included. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return RAISE + BAR_HEIGHT + tabBarBottom(insets.bottom);
}
