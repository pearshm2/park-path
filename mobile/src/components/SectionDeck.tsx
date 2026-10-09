/**
 * The Explore deck in sections: each section (Recommended For You, Filtered
 * For You, Parks to Explore) is a page you swipe left and right between,
 * and within a page the cards run downward, one at a time, with the top of
 * the next card peeking up from the bottom edge.
 *
 * Splitting the deck this way keeps a long run of parks from being one
 * endless sideways row: you can jump straight to a section, and scroll
 * through just that section's cards.
 *
 * The card in view is reported through `onActiveChange`. Each
 * section remembers how far down it was scrolled, so swiping back to it
 * returns to the same card.
 */

import { useRef, useState, type ReactNode } from 'react';
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

/** Side margin, matching the sideways carousel's cards. */
const SIDE = 28;
const GAP = 12;
/** How much of the next card shows below the current one. */
const PEEK = 22;
/** How much taller the sheet must be than for one card, to fit the peek. */
export const SECTION_PEEK = PEEK + GAP;

export type DeckSection<T> = { key: string; title: string; items: T[] };

type SectionDeckProps<T> = {
  sections: DeckSection<T>[];
  /** Id of the card to open on; undefined starts at the first card. */
  activeId?: string;
  keyOf: (item: T) => string;
  onActiveChange: (item: T) => void;
  /**
   * `active` is false for the card peeking up from below; `bringIntoView`
   * scrolls that card up into place.
   */
  renderCard: (item: T, active: boolean, bringIntoView: () => void) => ReactNode;
  /** The deck's height; cards fill it, less the peek. */
  height: number;
  style?: StyleProp<ViewStyle>;
};

export function SectionDeck<T>({
  sections,
  activeId,
  keyOf,
  onActiveChange,
  renderCard,
  height,
  style,
}: SectionDeckProps<T>) {
  const { width } = useWindowDimensions();
  const cardHeight = Math.max(height - SECTION_PEEK, 80);
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

  function setPosition(key: string, index: number) {
    setPositions((current) => (current[key] === index ? current : { ...current, [key]: index }));
  }

  function report(item: T | undefined) {
    if (item) onActiveChange(item);
  }

  /** Scrolls a card in a section into view, e.g. the one peeking up from below. */
  function bringIntoView(section: DeckSection<T>, index: number) {
    lists.current.get(section.key)?.scrollToOffset({ offset: index * interval, animated: true });
    setPosition(section.key, index);
    report(section.items[index]);
  }

  function onPageSettled(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    if (page === activePage.current) return;
    activePage.current = page;
    const section = sections[page];
    if (section) report(section.items[positions[section.key] ?? 0]);
  }

  function onCardSettled(section: DeckSection<T>, event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.min(
      Math.max(Math.round(event.nativeEvent.contentOffset.y / interval), 0),
      section.items.length - 1,
    );
    setPosition(section.key, index);
    report(section.items[index]);
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
      style={[{ height }, style]}
      renderItem={({ item: section }) => {
        const current = positions[section.key] ?? 0;
        return (
          <View style={{ width, height }}>
            <FlatList
              ref={(list) => {
                lists.current.set(section.key, list);
              }}
              data={section.items}
              keyExtractor={keyOf}
              showsVerticalScrollIndicator={false}
              snapToInterval={interval}
              decelerationRate="fast"
              // Room after the last card so it can scroll up into place.
              contentContainerStyle={{ paddingBottom: PEEK + GAP }}
              initialScrollIndex={current}
              getItemLayout={(_data, index) => ({
                length: interval,
                offset: interval * index,
                index,
              })}
              // Only a few cards are ever on screen.
              initialNumToRender={3}
              windowSize={5}
              onMomentumScrollEnd={(event) => onCardSettled(section, event)}
              // A short drag with no fling never fires momentum end on Android.
              onScrollEndDrag={(event) => {
                if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.05) {
                  onCardSettled(section, event);
                }
              }}
              renderItem={({ item, index }) => (
                <View style={[styles.slot, { height: cardHeight }]}>
                  {renderCard(item, index === current, () => bringIntoView(section, index))}
                </View>
              )}
              extraData={current}
            />
          </View>
        );
      }}
      extraData={positions}
    />
  );
}

const styles = StyleSheet.create({
  slot: {
    marginHorizontal: SIDE,
    marginBottom: GAP,
  },
});
