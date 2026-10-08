/**
 * The Explore filter sheet.
 *
 * Follows the prototype's "Filter sites" sheet — a grabber, terrain
 * chips, a couple of coarse dials, then Clear and Apply — but uses
 * segmented choices instead of the prototype's sliders. A slider needs
 * @react-native-community/slider, and three buckets express the same
 * intent without adding a dependency or a native module.
 *
 * Edits are held locally and only lifted on Apply, so backing out of the
 * sheet leaves the feed as it was.
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EffortLevel, TerrainGroup } from '../data/parks';
import { colors, radius, shadow, space } from '../theme';
import { Button } from './Button';
import { TERRAIN_LABEL } from './TerrainIcon';
import { BodyText, Heading } from './Typography';

/** Upper bound on annual visits, in millions. null means no limit. */
export type Crowd = 'quiet' | 'moderate' | null;

export type FeedFilters = {
  /** Empty means every terrain. */
  terrains: TerrainGroup[];
  /** Hardest effort to include. null means any. */
  maxEffort: EffortLevel | null;
  crowd: Crowd;
};

export const NO_FILTERS: FeedFilters = { terrains: [], maxEffort: null, crowd: null };

export const CROWD_CEILING: Record<Exclude<Crowd, null>, number> = {
  quiet: 1.5,
  moderate: 4,
};

/** How many dials are actually narrowing the feed — shown on the button. */
export function activeFilterCount(f: FeedFilters): number {
  return (f.terrains.length > 0 ? 1 : 0) + (f.maxEffort !== null ? 1 : 0) + (f.crowd !== null ? 1 : 0);
}

const TERRAIN_ORDER: TerrainGroup[] = [
  'mountain',
  'canyon',
  'desert',
  'forest',
  'coast',
  'water',
  'dunes',
  'caves',
  'badlands',
];

type SheetProps = {
  value: FeedFilters;
  /**
   * How many parks a given selection would show. Takes the draft rather
   * than a fixed number so the Apply button counts what you are about to
   * do, not what is already applied.
   */
  countFor: (filters: FeedFilters) => number;
  onApply: (next: FeedFilters) => void;
  onClose: () => void;
};

export function FilterSheet({ visible, ...props }: SheetProps & { visible: boolean }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {/* Mounted fresh on each open, so the draft seeds from the applied
          filters through useState rather than an effect that re-seeds it. */}
      {visible ? <SheetBody {...props} /> : null}
    </Modal>
  );
}

function SheetBody({ value, countFor, onApply, onClose }: SheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<FeedFilters>(value);
  const draftCount = countFor(draft);

  function toggleTerrain(group: TerrainGroup) {
    setDraft((prev) => ({
      ...prev,
      terrains: prev.terrains.includes(group)
        ? prev.terrains.filter((t) => t !== group)
        : [...prev.terrains, group],
    }));
  }

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close filters" />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + space[6] }]}>
        <View style={styles.grabber} />

        <Heading size={22}>Filter parks</Heading>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <SectionLabel>Terrain</SectionLabel>
          <View style={styles.chipWrap}>
            {TERRAIN_ORDER.map((group) => (
              <Chip
                key={group}
                label={TERRAIN_LABEL[group]}
                selected={draft.terrains.includes(group)}
                onPress={() => toggleTerrain(group)}
              />
            ))}
          </View>

          <SectionLabel>How hard</SectionLabel>
          <View style={styles.chipWrap}>
            <Chip
              label="Any"
              selected={draft.maxEffort === null}
              onPress={() => setDraft((p) => ({ ...p, maxEffort: null }))}
            />
            <Chip
              label="Easy walks"
              selected={draft.maxEffort === 1}
              onPress={() => setDraft((p) => ({ ...p, maxEffort: 1 }))}
            />
            <Chip
              label="Up to half-day"
              selected={draft.maxEffort === 2}
              onPress={() => setDraft((p) => ({ ...p, maxEffort: 2 }))}
            />
          </View>

          <SectionLabel>How busy</SectionLabel>
          <View style={styles.chipWrap}>
            <Chip
              label="Any"
              selected={draft.crowd === null}
              onPress={() => setDraft((p) => ({ ...p, crowd: null }))}
            />
            <Chip
              label="Quiet"
              selected={draft.crowd === 'quiet'}
              onPress={() => setDraft((p) => ({ ...p, crowd: 'quiet' }))}
            />
            <Chip
              label="Not too busy"
              selected={draft.crowd === 'moderate'}
              onPress={() => setDraft((p) => ({ ...p, crowd: 'moderate' }))}
            />
          </View>

          <BodyText size={11.5} lineHeightRatio={1.45} color={colors.neutral[600]} style={styles.note}>
            Busyness is estimated from annual recreation visits, not live crowd data.
          </BodyText>
        </ScrollView>

        <View style={styles.actions}>
          <Button label="Clear" variant="secondary" onPress={() => setDraft(NO_FILTERS)} />
          <Button
            label={draftCount === 1 ? 'Show 1 park' : `Show ${draftCount} parks`}
            onPress={() => onApply(draft)}
            block
          />
        </View>
      </View>
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.sectionLabel}>
      {children.toUpperCase()}
    </BodyText>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipOn : styles.chipOff,
        pressed && styles.chipPressed,
      ]}
    >
      <BodyText size={12.5} weight="semibold" color={selected ? colors.bg : colors.neutral[800]}>
        {label}
      </BodyText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // neutral-900 at 50%, matching the prototype's dialog backdrop.
    backgroundColor: 'rgba(46, 43, 37, 0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    paddingTop: space[3],
    paddingHorizontal: space[4],
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.bg,
    gap: space[2],
    ...shadow.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[400],
    marginBottom: space[2],
  },
  scroll: {
    flexGrow: 0,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginTop: space[4],
    marginBottom: space[2],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  chipOff: {
    backgroundColor: colors.neutral[100],
    borderColor: 'transparent',
  },
  chipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipPressed: {
    opacity: 0.85,
  },
  note: {
    marginTop: space[4],
  },
  actions: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[3],
  },
});
