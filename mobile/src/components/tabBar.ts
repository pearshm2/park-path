/**
 * The floating tab bar's measurements, shared with the screens under it.
 *
 * The bar floats over the tab screens rather than taking its own strip at
 * the bottom, so the Explore card sheet can run down behind it. Each screen
 * keeps its own content clear of it with `useTabBarSpace()`.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BAR_HEIGHT = 66;
/** How far the Explore circle (with its ring) rises above the bar's top edge. */
export const RAISE = 18;

/**
 * Space under the bar: half the bottom inset, so it sits partly in the
 * home-indicator zone, but never under 16, which clears the indicator line
 * on both iOS and Android (its top sits about 13 up from the edge).
 */
export function tabBarBottom(insetBottom: number): number {
  return Math.max(insetBottom / 2, 16);
}

/** How much of the bottom of the screen the bar covers, circle included. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return RAISE + BAR_HEIGHT + tabBarBottom(insets.bottom);
}
