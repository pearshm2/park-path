/**
 * The onboarding quiz, following the prototype's quiz screen: a progress
 * pill and step label, a Caprasimo question, a supporting line, the
 * answer rows, then Back / Continue pinned to the bottom.
 *
 * Answers are held in QuizContext and persisted locally — there is no
 * /quiz endpoint.
 */

import { Redirect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import {
  BodyText,
  Button,
  ChoiceRow,
  Heading,
  ProgressBar,
  TextField,
  Toast,
} from '../components';
import type { Season } from '../data/parks';
import {
  isKnownZip,
  isStepAnswered,
  QUIZ_STEPS,
  type QuizAnswers,
  type QuizStep,
} from '../data/quizSpec';
import { useQuiz } from '../quiz/QuizContext';
import { colors, fonts, space } from '../theme';

export default function QuizScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useAuth();
  const { answers: savedAnswers, completed, save } = useQuiz();

  // Seeded from whatever was saved, so re-taking the quiz shows the
  // previous answers rather than starting blank. With nothing saved this
  // is the empty answer set.
  const [answers, setAnswers] = useState<QuizAnswers>(savedAnswers);
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

  async function advance(next: QuizAnswers) {
    if (isLast) {
      await save(next);
      router.replace('/explore');
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function onNext() {
    if (!answered) {
      flash(MISSING_ANSWER[step.key]);
      return;
    }
    advance(answers);
  }

  /** The zip step's way past without a zip code; distance then drops out. */
  function onSkipZip() {
    const next = { ...answers, zip: null };
    setAnswers(next);
    advance(next);
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
        keyboardShouldPersistTaps="handled"
      >
        {step.key === 'zip' ? (
          <ZipStep
            zip={answers.zip ?? ''}
            onChange={(zip) => setAnswers((prev) => ({ ...prev, zip }))}
            onSubmit={onNext}
            onSkip={onSkipZip}
          />
        ) : (
          renderOptions(step, answers, setAnswers)
        )}
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

/** What the toast says when Continue is tapped with the step unanswered. */
const MISSING_ANSWER: Record<QuizStep['key'], string> = {
  zip: 'Enter a 5-digit zip code, or skip for now.',
  terrains: 'Pick at least one to continue.',
  seasons: 'Tap a season, or pick any season.',
  crowds: 'Pick an answer to continue.',
};

function ZipStep({
  zip,
  onChange,
  onSubmit,
  onSkip,
}: {
  zip: string;
  onChange: (zip: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  // Only flag a zip code once all five digits are in.
  const unknown = zip.length === 5 && !isKnownZip(zip);
  return (
    <View style={styles.zip}>
      <TextField
        label="Zip code"
        value={zip}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 5))}
        onSubmitEditing={onSubmit}
        placeholder="e.g. 80302"
        keyboardType="number-pad"
        textContentType="postalCode"
        autoComplete="postal-code"
        returnKeyType="next"
        maxLength={5}
        error={unknown ? "We couldn't place that zip code. Check it, or skip for now." : null}
      />
      <Button label="Skip for now" variant="ghost" onPress={onSkip} style={styles.skip} />
    </View>
  );
}

/**
 * Pulled out of the component so the discriminated union narrows cleanly
 * — each branch knows its own option value type.
 */
function renderOptions(
  step: Exclude<QuizStep, { key: 'zip' }>,
  answers: QuizAnswers,
  setAnswers: (update: (prev: QuizAnswers) => QuizAnswers) => void,
) {
  switch (step.key) {
    case 'terrains':
      return step.options.map((option) => (
        <ChoiceRow
          key={option.value}
          label={option.label}
          sub={option.sub}
          multi
          selected={answers.terrains.includes(option.value)}
          onPress={() =>
            setAnswers((prev) => ({
              ...prev,
              terrains: toggle(prev.terrains, option.value),
            }))
          }
        />
      ));

    case 'seasons': {
      // Tapping ranks a season after the ones already picked; tapping it
      // again takes it out and the rest close up. "Any season" clears the
      // ranking, and untapping the last season leaves the question open
      // again rather than turning into "any".
      const ranked = answers.seasons ?? [];
      const anySeason = answers.seasons !== null && ranked.length === 0;
      return [
        ...step.options.map((option) => {
          const place = ranked.indexOf(option.value);
          return (
            <ChoiceRow
              key={option.value}
              label={option.label}
              sub={option.sub}
              multi
              selected={place >= 0}
              rank={place >= 0 ? place + 1 : undefined}
              onPress={() =>
                setAnswers((prev) => {
                  const next = toggle<Season>(prev.seasons ?? [], option.value);
                  return { ...prev, seasons: next.length ? next : null };
                })
              }
            />
          );
        }),
        <ChoiceRow
          key="any"
          label={step.anyLabel}
          selected={anySeason}
          onPress={() => setAnswers((prev) => ({ ...prev, seasons: anySeason ? null : [] }))}
        />,
      ];
    }

    case 'crowds':
      return step.options.map((option) => (
        <ChoiceRow
          key={option.value}
          label={option.label}
          sub={option.sub}
          selected={answers.crowds === option.value}
          onPress={() => setAnswers((prev) => ({ ...prev, crowds: option.value }))}
        />
      ));
  }
}

/** Adds a value to the end of the list, or removes it if already there. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
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
  zip: {
    gap: space[2],
  },
  skip: {
    alignSelf: 'flex-start',
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
