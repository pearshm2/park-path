/**
 * Font loading for the Organic type pairing: Caprasimo for display
 * headings, Figtree for everything else.
 *
 * The design system treats Caprasimo as the only display voice, so the
 * heading weight is 400 only — there is nothing else to load.
 */

import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  useFonts,
} from '@expo-google-fonts/figtree';

/**
 * Loads the type pairing. Returns false until the fonts are ready — the
 * root layout holds the splash screen open on that, so no screen ever
 * renders a heading in a fallback face and then reflows.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  // A font that fails to download should not block the app behind a
  // splash screen forever; RN falls back to the system face instead.
  return loaded || error !== null;
}
