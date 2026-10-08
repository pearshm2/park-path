/**
 * A swipeable deck of cards, shuffled through one at a time.
 *
 * The current card sits on top with the next two peeking out behind it.
 * Swiping left sends the top card off and brings up the next; swiping
 * right goes back one. The deck loops, and a card that leaves the top
 * slides back in under the others, so it reads as shuffling rather than
 * scrolling a list.
 *
 * Built on Reanimated and Gesture Handler so the drag and the fling run
 * on the UI thread. Only the top card takes a horizontal drag, and only
 * once the finger has clearly moved sideways — a vertical drag is left
 * to whatever holds the deck (the Explore sheet uses it to open/close).
 * Taps are a gesture too, raced against the drag, so a swipe never also
 * counts as a tap on the card it moved.
 */

import { useEffect, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** How many cards are drawn: the top one and two behind it. */
const STACK = 3;
/** How far each card behind is nudged right and down, and how much smaller. */
const PEEK_X = 10;
const PEEK_Y = 8;
const SHRINK = 0.05;

/** A drag past this distance, or a flick past this speed, swaps the card. */
const SWIPE_DISTANCE = 90;
const SWIPE_VELOCITY = 700;

type CardDeckProps<T> = {
  items: T[];
  /** Index of the card on top. */
  index: number;
  onIndexChange: (index: number) => void;
  keyOf: (item: T) => string;
  renderCard: (item: T, index: number) => ReactNode;
  /** A tap on the top card. */
  onCardPress?: (item: T, index: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function CardDeck<T>({
  items,
  index,
  onIndexChange,
  keyOf,
  renderCard,
  onCardPress,
  style,
}: CardDeckProps<T>) {
  const count = items.length;
  if (count === 0) return null;

  // Positions in the deck, top first; fewer when there are fewer cards.
  const shown = Array.from(
    { length: Math.min(count, STACK) },
    (_, depth) => (index + depth) % count,
  );

  return (
    <View style={[styles.deck, style]}>
      {/* Drawn back to front, so the top card is last and on top. */}
      {shown
        .map((itemIndex, depth) => ({ itemIndex, depth }))
        .reverse()
        .map(({ itemIndex, depth }) => (
          <DeckCard
            key={keyOf(items[itemIndex])}
            depth={depth}
            canSwipe={count > 1}
            onSwiped={(direction) => onIndexChange((index - direction + count) % count)}
            onPress={onCardPress ? () => onCardPress(items[itemIndex], itemIndex) : undefined}
          >
            {renderCard(items[itemIndex], itemIndex)}
          </DeckCard>
        ))}
    </View>
  );
}

function DeckCard({
  depth,
  canSwipe,
  onSwiped,
  onPress,
  children,
}: {
  /** 0 for the top card, 1 and 2 for the ones behind it. */
  depth: number;
  canSwipe: boolean;
  /** -1 when swiped left (next card), 1 when swiped right (previous). */
  onSwiped: (direction: -1 | 1) => void;
  onPress?: () => void;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const dragX = useSharedValue(0);
  // Animated depth, so a card eases into its new place. It starts one
  // step further back, so a card arriving in the deck rises into view.
  const place = useSharedValue(depth + 1);

  useEffect(() => {
    place.set(withTiming(depth, { duration: 220 }));
    // A card that has left the top slides back in under the deck.
    if (depth !== 0) dragX.set(withTiming(0, { duration: 260 }));
  }, [depth, place, dragX]);

  const pan = Gesture.Pan()
    .enabled(depth === 0 && canSwipe)
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      dragX.set(event.translationX);
    })
    .onEnd((event) => {
      const swiped =
        Math.abs(event.translationX) > SWIPE_DISTANCE || Math.abs(event.velocityX) > SWIPE_VELOCITY;
      if (!swiped) {
        dragX.set(withSpring(0, { damping: 18, stiffness: 180 }));
        return;
      }
      const direction = (event.translationX || event.velocityX) < 0 ? -1 : 1;
      dragX.set(
        withTiming(direction * width * 1.2, { duration: 200 }, (finished) => {
          if (finished) scheduleOnRN(onSwiped, direction);
        }),
      );
    });

  const tap = Gesture.Tap()
    .enabled(depth === 0 && onPress !== undefined)
    .maxDistance(10)
    .onEnd((_event, success) => {
      if (success && onPress) scheduleOnRN(onPress);
    });

  const animated = useAnimatedStyle(() => {
    const p = place.get();
    const x = dragX.get();
    return {
      // The third card fades in from nothing as the deck moves up.
      opacity: interpolate(p, [STACK - 1, STACK], [1, 0], 'clamp'),
      transform: [
        { translateX: x + p * PEEK_X },
        { translateY: p * PEEK_Y },
        { scale: 1 - p * SHRINK },
        { rotate: `${x / 22}deg` },
      ],
    };
  });

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View
        style={[styles.card, animated]}
        accessible={depth === 0}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityHint="Swipe left or right for other cards"
        onAccessibilityTap={onPress}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  deck: {
    // Room on the right and bottom for the cards peeking out behind.
    paddingRight: PEEK_X * (STACK - 1),
    paddingBottom: PEEK_Y * (STACK - 1),
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: PEEK_X * (STACK - 1),
    bottom: PEEK_Y * (STACK - 1),
  },
});
