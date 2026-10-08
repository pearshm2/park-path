/**
 * Root layout: loads the type pairing, installs the providers every
 * screen depends on, and holds the splash screen until the app knows
 * which screen the user belongs on.
 *
 * Route groups:
 *   (auth)  signed out — sign in / create account
 *   quiz    signed in, quiz not yet taken
 *   (tabs)  signed in, quiz done — the app proper
 *
 * The redirect decisions live in each group's layout rather than here,
 * so a deep link into a group is guarded the same way a navigation is.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
// Needed at the root for any gesture to work, e.g. pinch-to-zoom on the Explore map.
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../auth/AuthContext';
import { QuizProvider, useQuiz } from '../quiz/QuizContext';
import { colors, useAppFonts } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unsupported on this platform (web). Not fatal.
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Park data is bundled fixtures for now, so there is nothing to
      // refetch on focus; this keeps the demo from flickering.
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60_000,
    },
  },
});

export default function RootLayout() {
  const fontsReady = useAppFonts();

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={styles.ground}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <QuizProvider>
              <StatusBar style="dark" />
              <SessionGate />
            </QuizProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Keeps the splash screen up until both the stored session and the
 * stored quiz answers have been read. Without this the user would see
 * the sign-in screen for a frame before being redirected into the app.
 */
function SessionGate() {
  const { status } = useAuth();
  const { ready: quizReady } = useQuiz();
  const settled = status !== 'restoring' && quizReady;

  useEffect(() => {
    if (settled) SplashScreen.hideAsync().catch(() => {});
  }, [settled]);

  if (!settled) return <View style={styles.ground} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: styles.ground,
        // The warm ground should be what shows through a transition,
        // not the default white.
        animation: 'fade',
      }}
    />
  );
}

const styles = StyleSheet.create({
  ground: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
