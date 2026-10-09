/**
 * Park search: a round button for the Explore header, and the panel it
 * opens.
 *
 * The panel lays a slightly see-through sheet over the whole screen, with
 * a large input that wraps, so long names ("Black Canyon of the Gunnison")
 * stay readable while typed. It searches only the parks the map is
 * showing, and says how many that is before anything is typed.
 */

import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { Site } from '../data/parks';
import { colors, fonts, radius, scaleType, space, useTextScale } from '../theme';
import { BodyText } from './Typography';

/** How many matches the panel lists. */
const MAX_RESULTS = 8;

/** A magnifying glass, in the design system's icon stroke. */
const SEARCH_PATHS = ['M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13z', 'M15.5 15.5L20 20'];

function SearchIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {SEARCH_PATHS.map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

/** The header's search button, styled to sit beside the map scope pill. */
export function SearchButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Search parks"
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <SearchIcon size={16} color={colors.accentRamp[700]} />
    </Pressable>
  );
}

/** Name matches, names that start with the query first. */
function searchSites(sites: Site[], query: string): Site[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = sites.filter((site) => site.name.toLowerCase().includes(q));
  const starts = (site: Site) => (site.name.toLowerCase().startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b) || a.name.localeCompare(b.name));
}

export function SearchPanel({
  visible,
  sites,
  scopeLabel,
  onPick,
  onClose,
}: {
  visible: boolean;
  /** What can be searched: the parks the map is showing. */
  sites: Site[];
  /** Those parks in words, e.g. "62 national parks". */
  scopeLabel: string;
  onPick: (site: Site) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const scale = useTextScale();
  const [query, setQuery] = useState('');
  const [missed, setMissed] = useState(false);

  const matches = searchSites(sites, query);
  const typed = query.trim().length > 0;

  function close() {
    setQuery('');
    setMissed(false);
    onClose();
  }

  function pick(site: Site) {
    setQuery('');
    setMissed(false);
    onPick(site);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.overlay, { paddingTop: insets.top + space[3] }]}>
        <View style={styles.head}>
          <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
            {typed
              ? `${matches.length} of ${scopeLabel} match`
              : `Searching ${scopeLabel} on the map`}
          </BodyText>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button">
            <BodyText size={14} weight="semibold" color={colors.accentRamp[700]}>
              Cancel
            </BodyText>
          </Pressable>
        </View>

        <View style={styles.field}>
          <SearchIcon size={20} color={colors.neutral[600]} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setMissed(false);
            }}
            onSubmitEditing={() => {
              if (matches[0]) pick(matches[0]);
              else if (typed) setMissed(true);
            }}
            // Wraps instead of scrolling sideways, so a long name stays in view.
            multiline
            submitBehavior="blurAndSubmit"
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
            placeholder={`Search ${scopeLabel}`}
            placeholderTextColor={colors.neutral[500]}
            selectionColor={colors.accent}
            accessibilityLabel={`Search ${scopeLabel}`}
            style={[styles.input, scaleType(styles.input, scale)]}
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <BodyText size={20} weight="semibold" color={colors.neutral[600]}>
                ×
              </BodyText>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          style={styles.results}
          contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}
          keyboardShouldPersistTaps="handled"
        >
          {matches.slice(0, MAX_RESULTS).map((site) => (
            <Pressable
              key={site.id}
              onPress={() => pick(site)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}
            >
              <BodyText size={16} weight="semibold">
                {site.name}
              </BodyText>
              <BodyText size={12.5} color={colors.neutral[600]}>
                {`${site.kind} · ${site.state}`}
              </BodyText>
            </Pressable>
          ))}
          {missed || (typed && matches.length === 0) ? (
            <BodyText size={13.5} color={colors.neutral[700]} style={styles.miss}>
              {`Nothing in ${scopeLabel} is called "${query.trim()}". Try part of the name, or show more parks on the map.`}
            </BodyText>
          ) : null}
          {/* The empty space below the results closes the panel too. */}
          <Pressable style={styles.backdrop} onPress={close} accessible={false} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accentRamp[100],
  },
  buttonPressed: {
    opacity: 0.8,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: space[4],
    // The ground colour, mostly opaque: the map stays faintly visible behind.
    backgroundColor: 'rgba(249, 244, 237, 0.96)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 30,
    maxHeight: 110,
    padding: 0,
    fontFamily: fonts.bodyMedium,
    fontSize: 20,
    color: colors.text,
  },
  results: {
    flex: 1,
    marginTop: space[3],
  },
  result: {
    gap: 2,
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  resultPressed: {
    backgroundColor: colors.tintText07,
  },
  miss: {
    paddingVertical: space[3],
    paddingHorizontal: space[2],
  },
  backdrop: {
    minHeight: 400,
  },
});
