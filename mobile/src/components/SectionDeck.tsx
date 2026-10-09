/**
 * The Explore deck in sections: each section (Recommended For You, Filtered
 * For You, Parks to Explore) is a page you swipe left and right between,
 * and within a page the cards run downward, one at a time.
 *
 * Swiping up flips through a section like a stack: the card in view tilts
 * back, shrinks and fades as if falling behind, while the next one rises
 * over it to full size. At rest the next card waits just below, a little
 * smaller, with a gap so no card's edge is cut off by another.
 *
 * The card in view is reported through `onActiveChange`. Each section
 * remembers how far down it was scrolled, so swiping back to it returns to
 * the same card.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Side margin: sections are whole pages, so cards can run nearly full width. */
const SIDE = 16;
/** Space between a card and the one waiting below it. */
const GAP = 10;
/** How much of the next card shows below the current one. */
const PEEK = 18;
/** Extra card height in this view, over the sideways carousel's. */
const TALLER = 44;
/** How much taller the sheet must be than for the carousel. */
export const SECTION_PEEK = PEEK + GAP + TALLER;

/** The card waiting below is drawn this much smaller, as if further back. */
const WAITING_SCALE = 0.93;
/** How far a card tilts back, and how small it gets, as it flips away. */
const FLIP_DEGREES = 32;
const FLIP_SCALE = 0.86;

export type DeckSection<T> = { key: string; title: string; items: T[] };

type SectionDeckProps<T> = {
  sections: DeckSection<T>[];
  /** Id of the card to open on; undefined starts at the first card. */
  activeId?: string;
  keyOf: (item: T) => string;
  onActiveChange: (item: T) => void;
  /**
   * `active` is false for the card waiting below; `bringIntoView` scrolls
   * that card up into place.
   */
  renderCard: (item: T, active: boolean, bringIntoView: () => void) => ReactNode;
  /** The deck's height; the card fills it, less the gap and the peek. */
  height: number;
  /** Room below the deck (behind the tab bar) that the next card runs into. */
  extraBelow?: number;
  style?: StyleProp<ViewStyle>;
};

export function SectionDeck<T>({
  sections,
  activeId,
  keyOf,
  onActiveChange,
  renderCard,
  height,
  extraBelow = 0,
  style,
}: SectionDeckProps<T>) {
  const pageHeight = height + extraBelow;
  const { width } = useWindowDimensions();
  const cardHeight = Math.max(height - PEEK - GAP, 80);
  const interval = cardHeight + GAP;

  const pager = useRef<FlatList<DeckSection<T>>>(null);
  const lists = useRef(new Map<string, FlatList<T> | null>());

  /** Where `id` is: its section and its index in that section. */
  function locate(id: string | undefined) {
    for (let page = 0; page < sections.length; page++) {
      const index = sections[page].items.findIndex((item) => keyOf(item) === id);
      if (index >= 0) return { page, index };
    }
    return { page: 0, index: 0 };
  }

  // Where the deck opens: read once, on mount.
  const [start] = useState(() => locate(activeId));
  /** How far down each section is scrolled, by card index. */
  const [positions, setPositions] = useState<Record<string, number>>(() => ({
    [sections[start.page]?.key ?? '']: start.index,
  }));
  const activePage = useRef(start.page);

  function settle(section: DeckSection<T>, index: number) {
    setPositions((current) =>
      current[section.key] === index ? current : { ...current, [section.key]: index },
    );
    const item = section.items[index];
    if (item) onActiveChange(item);
  }

  function onPageSettled(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    if (page === activePage.current) return;
    activePage.current = page;
    const section = sections[page];
    const item = section?.items[positions[section.key] ?? 0];
    if (item) onActiveChange(item);
  }

  return (
    <FlatList
      ref={pager}
      data={sections}
      keyExtractor={(section) => section.key}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={start.page}
      getItemLayout={(_data, page) => ({ length: width, offset: width * page, index: page })}
      onMomentumScrollEnd={onPageSettled}
      style={[{ height: pageHeight }, style]}
      renderItem={({ item: section }) => (
        <SectionPage
          section={section}
          current={positions[section.key] ?? 0}
          width={width}
          height={pageHeight}
          cardHeight={cardHeight}
          interval={interval}
          keyOf={keyOf}
          renderCard={renderCard}
          registerList={(list) => lists.current.set(section.key, list)}
          onSettled={(index) => settle(section, index)}
          onBringIntoView={(index) => {
            lists.current.get(section.key)?.scrollToOffset({
              offset: index * interval,
              animated: true,
            });
            settle(section, index);
          }}
        />
      )}
      extraData={positions}
    />
  );
}

/** One section's cards, running downward, flipping away as they scroll up. */
function SectionPage<T>({
  section,
  current,
  width,
  height,
  cardHeight,
  interval,
  keyOf,
  renderCard,
  registerList,
  onSettled,
  onBringIntoView,
}: {
  section: DeckSection<T>;
  current: number;
  width: number;
  height: number;
  cardHeight: number;
  interval: number;
  keyOf: (item: T) => string;
  renderCard: SectionDeckProps<T>['renderCard'];
  registerList: (list: FlatList<T> | null) => void;
  onSettled: (index: number) => void;
  onBringIntoView: (index: number) => void;
}) {
  const scrollY = useSharedValue(current * interval);
  const last = section.items.length - 1;
  const list = useRef<FlatList<T> | null>(null);

  // If the card size changes while open (text size, a taller sheet), the
  // old scroll offset no longer lands on a card: snap back onto this one.
  useEffect(() => {
    list.current?.scrollToOffset({ offset: current * interval, animated: false });
    scrollY.set(current * interval);
    // Only a new size should trigger this, not scrolling to another card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
    },
    onMomentumEnd: (event) => {
      const index = Math.min(Math.max(Math.round(event.contentOffset.y / interval), 0), last);
      scheduleOnRN(onSettled, index);
    },
    // A short drag with no fling never fires momentum end on Android.
    onEndDrag: (event) => {
      if (Math.abs(event.velocity?.y ?? 0) < 0.05) {
        const index = Math.min(Math.max(Math.round(event.contentOffset.y / interval), 0), last);
        scheduleOnRN(onSettled, index);
      }
    },
  });

  return (
    <View style={{ width, height }}>
      <Animated.FlatList
        ref={(ref) => {
          list.current = ref;
          registerList(ref);
        }}
        data={section.items}
        keyExtractor={keyOf}
        showsVerticalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Room after the last card so it can scroll up into place.
        contentContainerStyle={{ paddingBottom: height - interval }}
        initialScrollIndex={current}
        getItemLayout={(_data, index) => ({ length: interval, offset: interval * index, index })}
        // Only a few cards are ever on screen.
        initialNumToRender={3}
        windowSize={5}
        renderItem={({ item, index }) => (
          <StackCard scrollY={scrollY} index={index} interval={interval} height={cardHeight}>
            {renderCard(item, index === current, () => onBringIntoView(index))}
          </StackCard>
        )}
        extraData={current}
      />
    </View>
  );
}

/**
 * One card, transformed by how far its section has scrolled past it:
 * `progress` is 0 when it's the card in view, -1 when it's waiting below,
 * and 1 once it has flipped away above.
 */
function StackCard({
  scrollY,
  index,
  interval,
  height,
  children,
}: {
  scrollY: SharedValue<number>;
  index: number;
  interval: number;
  height: number;
  children: ReactNode;
}) {
  const motion = useAnimatedStyle(() => {
    const progress = scrollY.get() / interval - index;

    if (progress <= 0) {
      // Waiting below, then rising into place at full size.
      return {
        opacity: interpolate(progress, [-1, 0], [0.85, 1], Extrapolation.CLAMP),
        transform: [
          { scale: interpolate(progress, [-1, 0], [WAITING_SCALE, 1], Extrapolation.CLAMP) },
        ],
      };
    }

    // Flipping away: held nearly in place while it tilts back, shrinks and
    // fades, so the next card slides up over it.
    return {
      opacity: interpolate(progress, [0, 0.75, 1], [1, 0.5, 0], Extrapolation.CLAMP),
      transform: [
        { perspective: 900 },
        { translateY: Math.min(progress, 1) * interval * 0.92 },
        { rotateX: `${interpolate(progress, [0, 1], [0, FLIP_DEGREES], Extrapolation.CLAMP)}deg` },
        { scale: interpolate(progress, [0, 1], [1, FLIP_SCALE], Extrapolation.CLAMP) },
      ],
    };
  });

  return <Animated.View style={[styles.slot, { height }, motion]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  slot: {
    marginHorizontal: SIDE,
    marginBottom: GAP,
  },
});
