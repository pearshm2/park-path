/**
 * A calendar in the app's own style, for picking a day: a month header
 * with arrows, weekday letters, then the days. The chosen day is a filled
 * orange circle, today has an orange ring, and days after `maxDate` are
 * faded and can't be picked. Tapping the month title switches to a grid of
 * years, so a trip from years ago is a couple of taps away.
 *
 * Dates are local days as YYYY-MM-DD, never through ISO/UTC (which would
 * shift them a day in the Americas).
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radius, space } from '../theme';
import { BodyText } from './Typography';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** How many years back the year grid goes. */
const YEARS_BACK = 40;

/** A local date as YYYY-MM-DD. */
export function toDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [y, m - 1, d];
}

export function Calendar({
  value,
  onChange,
  maxDate,
}: {
  /** The chosen day, YYYY-MM-DD. */
  value: string;
  onChange: (day: string) => void;
  /** The last day that can be picked, YYYY-MM-DD. */
  maxDate?: string;
}) {
  const [vy, vm] = parts(value);
  const [shown, setShown] = useState({ year: vy, month: vm });
  const [pickingYear, setPickingYear] = useState(false);
  const today = toDay(new Date());
  const [maxY, maxM] = maxDate ? parts(maxDate) : [Infinity, 11];

  const atLatest = shown.year > maxY || (shown.year === maxY && shown.month >= maxM);

  function move(by: number) {
    const d = new Date(shown.year, shown.month + by, 1);
    setShown({ year: d.getFullYear(), month: d.getMonth() });
  }

  // The month's days, padded at the start so the 1st lands on its weekday.
  const first = new Date(shown.year, shown.month, 1).getDay();
  const count = new Date(shown.year, shown.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const thisYear = new Date().getFullYear();
  const lastYear = Number.isFinite(maxY) ? Math.min(maxY, thisYear) : thisYear;
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => lastYear - i);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {!pickingYear ? (
          <Arrow direction="back" onPress={() => move(-1)} label="Previous month" />
        ) : (
          <View style={styles.arrowSpace} />
        )}
        <Pressable
          onPress={() => setPickingYear((p) => !p)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={pickingYear ? 'Back to the month' : 'Choose a year'}
          style={({ pressed }) => [styles.title, pressed && styles.titlePressed]}
        >
          <BodyText size={15} weight="semibold">
            {pickingYear ? 'Choose a year' : `${MONTHS[shown.month]} ${shown.year}`}
          </BodyText>
          <Svg width={12} height={12} viewBox="0 0 24 24">
            <Path
              d={pickingYear ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
              fill="none"
              stroke={colors.accentRamp[700]}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        {!pickingYear ? (
          <Arrow direction="forward" onPress={() => move(1)} label="Next month" disabled={atLatest} />
        ) : (
          <View style={styles.arrowSpace} />
        )}
      </View>

      {pickingYear ? (
        <View style={styles.years}>
          {years.map((year) => {
            const active = year === shown.year;
            return (
              <Pressable
                key={year}
                onPress={() => {
                  // Keep the month, but not past the latest pickable one.
                  const month = year === maxY ? Math.min(shown.month, maxM) : shown.month;
                  setShown({ year, month });
                  setPickingYear(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.year, active && styles.yearActive]}
              >
                <BodyText
                  size={13}
                  weight="semibold"
                  color={active ? colors.neutral[100] : colors.neutral[800]}
                >
                  {String(year)}
                </BodyText>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <>
          <View style={styles.week}>
            {WEEKDAYS.map((d, i) => (
              <BodyText key={i} size={11} weight="semibold" color={colors.neutral[500]} style={styles.weekday}>
                {d}
              </BodyText>
            ))}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={styles.week}>
              {cells.slice(row * 7, row * 7 + 7).map((date, i) => {
                if (date === null) return <View key={i} style={styles.cell} />;
                const day = toDay(new Date(shown.year, shown.month, date));
                const chosen = day === value;
                const isToday = day === today;
                const disabled = maxDate !== undefined && day > maxDate;
                return (
                  <View key={i} style={styles.cell}>
                    <Pressable
                      onPress={() => onChange(day)}
                      disabled={disabled}
                      accessibilityRole="button"
                      accessibilityLabel={`${MONTHS[shown.month]} ${date}, ${shown.year}`}
                      accessibilityState={{ selected: chosen, disabled }}
                      style={({ pressed }) => [
                        styles.day,
                        isToday && styles.today,
                        chosen && styles.chosen,
                        pressed && !chosen && styles.dayPressed,
                      ]}
                    >
                      <BodyText
                        size={13.5}
                        weight={chosen || isToday ? 'semibold' : 'regular'}
                        color={
                          chosen
                            ? colors.neutral[100]
                            : disabled
                              ? colors.neutral[400]
                              : colors.neutral[800]
                        }
                      >
                        {String(date)}
                      </BodyText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function Arrow({
  direction,
  onPress,
  label,
  disabled = false,
}: {
  direction: 'back' | 'forward';
  onPress: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.arrow, pressed && styles.dayPressed, disabled && styles.arrowOff]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path
          d={direction === 'back' ? 'M14.5 5L8 12l6.5 7' : 'M9.5 5L16 12l-6.5 7'}
          fill="none"
          stroke={colors.neutral[700]}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const DAY = 38;

const styles = StyleSheet.create({
  card: {
    gap: 4,
    marginTop: space[2],
    padding: space[3],
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[100],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[1],
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  titlePressed: {
    backgroundColor: colors.neutral[200],
  },
  arrow: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  arrowOff: {
    opacity: 0.3,
  },
  arrowSpace: {
    width: 34,
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  day: {
    width: DAY,
    height: DAY,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  dayPressed: {
    backgroundColor: colors.neutral[200],
  },
  today: {
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  chosen: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  years: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: space[1],
  },
  year: {
    width: '22%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
  },
  yearActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
