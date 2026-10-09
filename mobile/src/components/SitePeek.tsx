/**
 * The quick-look sheet for one site, from the prototype's map "peek":
 * name and crowd tag, a Features / Facts switch, a list of label-value
 * rows, then Dismiss and Open site.
 *
 * Only rows we have real data for are shown. The prototype also lists
 * camping, lodging, timed entry, dark sky, accessibility and condition
 * chips; those are being hand-entered for the 62 parks (see the park data
 * sourcing plan), and each slots in here as a row once its column exists.
 * Until then the Features tab says so instead of guessing.
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Site } from '../data/parks';
import { colors, radius, shadow, space } from '../theme';
import { Button } from './Button';
import { crowdLabel } from './ParkCard';
import { Tag } from './Tag';
import { BodyText, Heading } from './Typography';

type Row = { label: string; value: string; color: string };
type TabKey = 'features' | 'facts';

/** The prototype's two value colours: a plus in green, everything else plain. */
const YES = colors.accent2Ramp[700];
const PLAIN = colors.neutral[700];

const EFFORT = ['Easy', 'Moderate', 'Strenuous'];

function visitsLabel(millions: number): string {
  return millions >= 1 ? `${millions.toFixed(1)}M visits` : `${Math.round(millions * 1000)}K visits`;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function featureRows(site: Site): Row[] {
  const rows: Row[] = [];
  if (site.permit !== null) {
    rows.push({
      label: 'Permit or lottery',
      value: site.permit ? 'Needed for some areas' : 'None needed',
      color: site.permit ? PLAIN : YES,
    });
  }
  if (site.days !== null) {
    rows.push({
      label: 'Typical stay',
      value: site.days === 1 ? 'A day trip' : `${site.days} days`,
      color: PLAIN,
    });
  }
  return rows;
}

/**
 * `referenceVisits` is Great Smoky Mountains' annual visits, the busiest
 * park, which the prototype uses to put crowding in proportion.
 */
function factRows(site: Site, referenceVisits?: number): Row[] {
  const rows: Row[] = [];
  if (site.vis !== null) {
    rows.push({ label: 'Annual visits', value: visitsLabel(site.vis), color: PLAIN });
    rows.push({
      label: 'Average per day',
      value: `${Math.round((site.vis * 1_000_000) / 365).toLocaleString()} people`,
      color: PLAIN,
    });
    if (referenceVisits) {
      const share = (site.vis / referenceVisits) * 100;
      const crowd = crowdLabel(site.vis);
      rows.push({
        label: 'Crowding',
        value: `${crowd} · ${share < 1 ? 'under 1' : Math.round(share)}% of Smokies traffic`,
        color: crowd === 'Quiet' ? YES : PLAIN,
      });
    }
  }
  if (site.seasons.length > 0) {
    rows.push({ label: 'Best months', value: site.seasons.map(capitalise).join(' / '), color: YES });
  }
  if (site.effort !== null) {
    rows.push({ label: 'Effort', value: EFFORT[site.effort - 1], color: PLAIN });
  }
  rows.push({ label: 'Designation', value: site.kind, color: PLAIN });
  return rows;
}

export function SitePeek({
  site,
  referenceVisits,
  onDismiss,
  onOpen,
}: {
  /** The site to show; null hides the sheet. */
  site: Site | null;
  referenceVisits?: number;
  onDismiss: () => void;
  onOpen: (site: Site) => void;
}) {
  return (
    <Modal visible={site !== null} transparent animationType="fade" onRequestClose={onDismiss}>
      {/* Keyed so each site opens on Features, not on the last site's tab. */}
      {site ? (
        <PeekCard
          key={site.id}
          site={site}
          referenceVisits={referenceVisits}
          onDismiss={onDismiss}
          onOpen={onOpen}
        />
      ) : null}
    </Modal>
  );
}

function PeekCard({
  site,
  referenceVisits,
  onDismiss,
  onOpen,
}: {
  site: Site;
  referenceVisits?: number;
  onDismiss: () => void;
  onOpen: (site: Site) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('features');
  const features = featureRows(site);
  const rows = tab === 'features' ? features : factRows(site, referenceVisits);
  const meta = [site.kind, site.state, site.vis !== null && visitsLabel(site.vis)]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={[styles.card, { marginBottom: insets.bottom + 14 }]}>
        <View style={styles.header}>
          <View style={styles.titles}>
            <Heading size={19}>{site.name}</Heading>
            <BodyText size={12} color={colors.neutral[600]} style={styles.meta}>
              {meta}
            </BodyText>
          </View>
          {site.vis !== null ? <Tag tone="accent2" label={crowdLabel(site.vis)} /> : null}
        </View>

        <View style={styles.switch} accessibilityRole="tablist">
          {(['features', 'facts'] as const).map((key) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.switchOption, active && styles.switchActive]}
              >
                <BodyText
                  size={12.5}
                  weight="semibold"
                  color={active ? colors.neutral[100] : colors.neutral[700]}
                >
                  {key === 'features' ? 'Features' : 'Facts'}
                </BodyText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView style={styles.rows} contentContainerStyle={styles.rowsContent}>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <BodyText size={12.5} weight="medium" color={colors.neutral[700]} style={styles.label}>
                {row.label}
              </BodyText>
              <BodyText size={12.5} weight="semibold" color={row.color} style={styles.value}>
                {row.value}
              </BodyText>
            </View>
          ))}
          {tab === 'features' ? (
            <BodyText size={11.5} lineHeightRatio={1.45} color={colors.textMuted}>
              Camping, lodging, access and conditions are on the way.
            </BodyText>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <Button label="Dismiss" variant="secondary" onPress={onDismiss} />
          <Button label="Open site" block onPress={() => onOpen(site)} style={styles.open} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 30, 29, 0.32)',
  },
  card: {
    marginHorizontal: 14,
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
  },
  titles: {
    flex: 1,
  },
  meta: {
    marginTop: 3,
  },
  switch: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    marginTop: space[3],
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
  rows: {
    maxHeight: 230,
    marginTop: space[3],
  },
  rowsContent: {
    gap: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[3],
    paddingBottom: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  label: {
    flex: 1,
  },
  value: {
    textAlign: 'right',
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[4],
  },
  open: {
    flex: 1,
  },
});
