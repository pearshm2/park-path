/**
 * The onboarding quiz, following the prototype's quiz screen: a progress
 * pill and step label, a Caprasimo question, a supporting line, the
 * answer rows, then Back / Continue pinned to the bottom.
 *
 * Answers are held in QuizContext and persisted locally — there is no
 * /quiz endpoint yet (api/app/main.py mounts only the auth router).
 */

import { Redirect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { BodyText, Button, ChoiceRow, Heading, ProgressBar, Toast } from '../components';
import {
  EMPTY_ANSWERS,
  isStepAnswered,
  QUIZ_STEPS,
  type QuizAnswers,
  type QuizStep,
  type QuizTerrain,
} from '../data/quizSpec';
import { useQuiz } from '../quiz/QuizContext';
import { colors, fonts, space } from '../theme';

export default function QuizScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useAuth();
  const { answers: savedAnswers, completed, save } = useQuiz();

  // Seeded from whatever was saved, so re-taking the quiz shows the
  // previous answers rather than starting blank.
  const [answers, setAnswers] = useState<QuizAnswers>(
    completed ? savedAnswers : EMPTY_ANSWERS,
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const step = QUIZ_STEPS[stepIndex];
  const isLast = stepIndex === QUIZ_STEPS.length - 1;
  const answered = isStepAnswered(step, answers);

  const flash = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }, []);

  if (status !== 'signedIn') return <Redirect href="/sign-in" />;

  function choose(value: string | number) {
    setAnswers((prev) => {
      if (step.key === 'terrains') {
        const terrain = value as QuizTerrain;
        const next = prev.terrains.includes(terrain)
          ? prev.terrains.filter((t) => t !== terrain)
          : [...prev.terrains, terrain];
        return { ...prev, terrains: next };
      }
      // Single-select steps each write one key; the spec's discriminated
      // union guarantees the value type matches the key.
      return { ...prev, [step.key]: value } as QuizAnswers;
    });
  }

  async function onNext() {
    if (!answered) {
      flash(
        step.key === 'terrains' ? 'Pick at least one to continue.' : 'Pick an answer to continue.',
      );
      return;
    }

    if (isLast) {
      await save(answers);
      router.replace('/explore');
      return;
    }

    setStepIndex((i) => i + 1);
  }

  function onBack() {
    if (stepIndex === 0) {
      // Nowhere further back inside the quiz. If they have taken it
      // before, let them bail out to the app rather than trapping them.
      if (completed) router.replace('/explore');
      return;
    }
    setStepIndex((i) => i - 1);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[8] }]}>
      <View style={styles.progressRow}>
        <ProgressBar progress={(stepIndex + 1) / QUIZ_STEPS.length} />
        <BodyText size={11} weight="semibold" color={colors.neutral[600]}>
          {`Step ${stepIndex + 1} of ${QUIZ_STEPS.length}`}
        </BodyText>
      </View>

      <Heading size={30} style={styles.question}>
        {step.title}
      </Heading>
      <BodyText size={14} lineHeightRatio={1.45} color={colors.neutral[700]} style={styles.sub}>
        {step.sub}
      </BodyText>

      <ScrollView
        style={styles.options}
        contentContainerStyle={styles.optionsContent}
        showsVerticalScrollIndicator={false}
      >
        {renderOptions(step, answers, choose)}
      </ScrollView>

      <View style={styles.toastSlot}>
        <Toast message={toast} />
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space[6] }]}>
        <Button
          label="Back"
          variant="secondary"
          onPress={onBack}
          // Step 1 of a first run has nowhere to go back to.
          disabled={stepIndex === 0 && !completed}
        />
        <Button
          label={isLast ? 'See my parks' : 'Continue'}
          onPress={onNext}
          block
          // The prototype dims this until the step is answered but keeps
          // it pressable, so tapping it explains what is missing.
          style={!answered && styles.actionDimmed}
        />
      </View>
    </View>
  );
}

/**
 * Pulled out of the component so the discriminated union narrows cleanly
 * — each branch knows its own option value type.
 */
function renderOptions(
  step: QuizStep,
  answers: QuizAnswers,
  choose: (value: string | number) => void,
) {
  if (step.key === 'terrains') {
    return step.options.map((option) => (
      <ChoiceRow
        key={option.value}
        label={option.label}
        sub={option.sub}
        multi
        selected={answers.terrains.includes(option.value)}
        onPress={() => choose(option.value)}
      />
    ));
  }

  const current = answers[step.key];
  return step.options.map((option) => (
    <ChoiceRow
      key={String(option.value)}
      label={option.label}
      sub={option.sub}
      selected={current === option.value}
      onPress={() => choose(option.value)}
    />
  ));
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space[6],
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  question: {
    marginTop: space[6],
    marginBottom: space[2],
    fontFamily: fonts.heading,
  },
  sub: {
    marginBottom: space[4],
  },
  options: {
    flex: 1,
    // Negative margin lets the rows' shadows breathe without the list
    // clipping them, matching the prototype's inset trick.
    marginHorizontal: -space[2],
  },
  optionsContent: {
    gap: space[2],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  toastSlot: {
    minHeight: 34,
    justifyContent: 'center',
    paddingVertical: space[1],
  },
  actions: {
    flexDirection: 'row',
    gap: space[2],
    paddingTop: space[2],
  },
  actionDimmed: {
    opacity: 0.45,
  },
});
