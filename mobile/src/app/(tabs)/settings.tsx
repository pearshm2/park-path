/**
 * Settings. Deliberately functional rather than a mockup translation:
 * it is where the demo proves the session is real (the email comes from
 * GET /auth/me), lets you retake the quiz, and shows which API the app
 * is talking to — which is the first thing to check when a device cannot
 * reach the backend.
 */

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE_URL } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { BodyText, Button, Heading } from '../../components';
import { QUIZ_STEPS } from '../../data/quizSpec';
import { useQuiz } from '../../quiz/QuizContext';
import { colors, radius, shadow, space, TEXT_SIZES, useTextSize } from '../../theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { answers } = useQuiz();
  const { size: textSize, setSize: setTextSize } = useTextSize();

  const terrainSummary = answers.terrains.length
    ? answers.terrains.join(', ')
    : 'none chosen';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space[6], paddingBottom: space[8] },
      ]}
    >
      <Heading size={26}>Settings</Heading>
      <BodyText size={12} color={colors.neutral[600]}>
        {user ? user.email : 'Signed in'}
      </BodyText>

      <View style={styles.group}>
        <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.groupTitle}>
          TEXT SIZE
        </BodyText>
        <View style={styles.card}>
          <View style={styles.switch} accessibilityRole="radiogroup">
            {TEXT_SIZES.map((option) => {
              const active = option.value === textSize;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setTextSize(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[styles.switchOption, active && styles.switchActive]}
                >
                  <BodyText
                    size={12.5}
                    weight="semibold"
                    color={active ? colors.neutral[100] : colors.neutral[700]}
                  >
                    {option.label}
                  </BodyText>
                </Pressable>
              );
            })}
          </View>
          {/* A sample at the chosen size, so the effect is visible right here. */}
          <BodyText size={13.5} lineHeightRatio={1.5}>
            Zion: a river cut a narrow corridor through sandstone.
          </BodyText>
          <BodyText size={11.5} lineHeightRatio={1.45} color={colors.textMuted}>
            {"Your phone's own text size setting applies on top of this."}
          </BodyText>
        </View>
      </View>

      <View style={styles.group}>
        <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.groupTitle}>
          YOUR ANSWERS
        </BodyText>
        <View style={styles.card}>
          <Row label="Terrain" value={terrainSummary} />
          <Row label="Season" value={answers.season || 'not set'} />
          <Row label="Effort" value={effortLabel(answers.effort)} />
          <Row label="Adjustments" value={answers.needs || 'not set'} />
          <Row label="Trip length" value={answers.days ? `${answers.days} days` : 'not set'} />
        </View>
        <Button
          label={`Retake the quiz (${QUIZ_STEPS.length} questions)`}
          variant="secondary"
          onPress={() => router.push('/quiz')}
          style={styles.action}
        />
      </View>

      <View style={styles.group}>
        <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.groupTitle}>
          CONNECTION
        </BodyText>
        <View style={styles.card}>
          <Row label="API" value={API_BASE_URL} />
        </View>
      </View>

      <View style={styles.group}>
        <Button
          label="Sign out"
          variant="secondary"
          // Deliberately does NOT clear the quiz answers: they are stored
          // per account and should still be there on the next sign-in.
          // "Retake the quiz" above is the way to start over.
          onPress={signOut}
        />
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <BodyText size={12.5} weight="medium" color={colors.neutral[700]} style={styles.rowLabel}>
        {label}
      </BodyText>
      <BodyText size={12.5} weight="semibold" style={styles.rowValue}>
        {value}
      </BodyText>
    </View>
  );
}

function effortLabel(effort: number | null): string {
  if (effort === 1) return 'Easy walks';
  if (effort === 2) return 'Half-day hikes';
  if (effort === 3) return 'All day, strenuous';
  return 'not set';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: space[4],
    gap: space[2],
  },
  group: {
    marginTop: space[6],
    gap: space[2],
  },
  groupTitle: {
    letterSpacing: 1,
  },
  card: {
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
    gap: space[3],
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  rowLabel: {
    width: 96,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
  action: {
    alignSelf: 'flex-start',
  },
  // The same pill switch as the detail sheet's Features / Facts.
  switch: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  switchOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  switchActive: {
    backgroundColor: colors.accent,
  },
});
