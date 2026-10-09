/**
 * A horizontal carousel of cards with momentum, for flicking through a
 * long deck quickly.
 *
 * Cards sit side by side with the neighbours peeking in at the edges. A
 * gentle swipe moves one card; a hard flick glides through several and
 * settles on whichever card it lands nearest. Cards off-centre shrink and
 * fade a little, so the one in focus stands out.
 *
 * The carousel reports the centred card once it comes to rest, so
 * whatever shows the selection (the Explore map) can follow, and scrolls
 * itself when `index` is changed from outside. It deliberately does not
 * report every card it passes mid-flick: the screen's updates lag behind
 * the glide, and reading a stale `index` as an outside change made the
 * carousel scroll itself backwards and fight the flick.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type FlatList,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** How much of the screen edge each side leaves for the neighbours to peek. */
const DEFAULT_SIDE = 28;
/** Room under each card for its shadow; the list is this much taller than a card. */
export const CAROUSEL_SHADOW = 14;
const GAP = 12;
/**
 * How long a flick keeps gliding. Android's "normal" is 0.985, which stops
 * after about one card; 0.993 carries a firm flick through several. iOS's own
 * "normal" (0.998) already glides that far.
 */
const DECELERATION = Platform.select<number | 'normal'>({ android: 0.993, default: 'normal' });

/** Jumps further than this many cards happen instantly rather than scrolling. */
const MAX_ANIMATED_JUMP = 3;

type CardCarouselProps<T> = {
  items: T[];
  /** Index of the centred card. */
  index: number;
  onIndexChange: (index: number) => void;
  keyOf: (item: T) => string;
  renderCard: (item: T, index: number) => ReactNode;
  /**
   * Anything `renderCard` reads besides the item. The list only redraws a
   * card when its data changes, so without this a card can keep a stale
   * tap handler.
   */
  extraData?: unknown;
  /** Side margin per card; smaller makes cards wider and neighbours peek less. */
  side?: number;
  style?: StyleProp<ViewStyle>;
};

export function CardCarousel<T>({
  items,
  index,
  onIndexChange,
  keyOf,
  renderCard,
  extraData,
  side = DEFAULT_SIDE,
  style,
}: CardCarouselProps<T>) {
  const { width } = useWindowDimensions();
  const cardWidth = width - side * 2;
  const interval = cardWidth + GAP;
  const count = items.length;

  const list = useRef<FlatList<T>>(null);
  const scrollX = useSharedValue(index * interval);
  /** The centred card as last reported, so outside changes can be told apart. */
  const reported = useSharedValue(index);
  const shownItems = useRef(items);
  /**
   * Where to jump once a new deck has rendered. Jumping straight away
   * would be clamped to the old deck's length, e.g. stopping at card 4
   * when going from a 4-card region back to all 63.
   */
  const pendingJump = useRef<number | null>(null);

  /** Reports the card nearest `offset` if it is not the one last reported. */
  function settleAt(offset: number) {
    'worklet';
    const centred = Math.min(Math.max(Math.round(offset / interval), 0), count - 1);
    if (centred !== reported.get()) {
      reported.set(centred);
      scheduleOnRN(onIndexChange, centred);
    }
  }

  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        scrollX.set(event.contentOffset.x);
      },
      // A release with no speed snaps without any momentum events, so
      // settle here; a flick settles when its glide ends instead.
      onEndDrag: (event) => {
        if (Math.abs(event.velocity?.x ?? 0) < 0.1) {
          settleAt(event.contentOffset.x);
        }
      },
      onMomentumEnd: (event) => {
        settleAt(event.contentOffset.x);
      },
    },
    [settleAt],
  );

  // Follow `index` when it changes from outside (a pin tap, a search, a
  // new deck), rather than from scrolling.
  useEffect(() => {
    const newDeck = shownItems.current !== items;
    if (!newDeck && reported.get() === index) return;
    const jump = newDeck || Math.abs(reported.get() - index) > MAX_ANIMATED_JUMP;
    shownItems.current = items;
    reported.set(index);
    // A new deck may not be its full length yet, so the jump is repeated
    // once it has rendered (a same-length deck renders no size change, so
    // the jump here is the one that lands).
    if (newDeck) pendingJump.current = index * interval;
    list.current?.scrollToOffset({ offset: index * interval, animated: !jump });
  }, [index, items, interval, reported]);

  return (
    <Animated.FlatList
      // Typed loosely by Reanimated; the ref is a plain FlatList.
      ref={list as never}
      data={items}
      extraData={extraData}
      keyExtractor={keyOf}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={interval}
      decelerationRate={DECELERATION}
      contentOffset={{ x: index * interval, y: 0 }}
      // Only three cards are ever in view (the centred one and the two
      // peeking in), so keep a few either side rather than the default ~21
      // screens' worth; every one of those re-renders when the centre moves.
      initialNumToRender={3}
      maxToRenderPerBatch={3}
      windowSize={5}
      getItemLayout={(_data, itemIndex) => ({
        length: interval,
        offset: side + itemIndex * interval,
        index: itemIndex,
      })}
      onContentSizeChange={() => {
        if (pendingJump.current === null) return;
        list.current?.scrollToOffset({ offset: pendingJump.current, animated: false });
        pendingJump.current = null;
      }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingHorizontal: side }}
      ItemSeparatorComponent={Separator}
      renderItem={({ item, index: itemIndex }) => (
        <CarouselCard index={itemIndex} interval={interval} scrollX={scrollX} width={cardWidth}>
          {renderCard(item, itemIndex)}
        </CarouselCard>
      )}
      style={style}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

/** One card, eased smaller and fainter the further it is from centre. */
function CarouselCard({
  index,
  interval,
  scrollX,
  width,
  children,
}: {
  index: number;
  interval: number;
  scrollX: SharedValue<number>;
  width: number;
  children: ReactNode;
}) {
  const animated = useAnimatedStyle(() => {
    const away = Math.min(Math.abs(scrollX.get() - index * interval) / interval, 1);
    return {
      opacity: 1 - away * 0.35,
      transform: [{ scale: 1 - away * 0.07 }],
    };
  });

  return <Animated.View style={[styles.card, { width }, animated]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  separator: {
    width: GAP,
  },
  card: {
    height: '100%',
    // Room under each card for its shadow.
    paddingBottom: CAROUSEL_SHADOW,
  },
});
