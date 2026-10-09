/**
 * The Explore map on its own, full screen, opened from the map's expand
 * button. This is the one place the app turns sideways: everything else
 * is laid out for a tall phone, so the app is locked to portrait (see the
 * root layout) and only unlocked while this view is open.
 *
 * Tapping a park shows its name at the bottom with a View button, which
 * closes this view and opens that park's card in Explore.
 */

import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Site } from '../data/parks';
import { colors, radius, shadow, space } from '../theme';
import { Button } from './Button';
import { ParkMap } from './ParkMap';
import { BodyText, Heading } from './Typography';

export function FullMapView({
  visible,
  title,
  sites,
  rankById,
  matchIds,
  featureIcons,
  onClose,
  onView,
}: {
  visible: boolean;
  /** What the map is showing, e.g. "62 national parks". */
  title: string;
  sites: Site[];
  rankById?: ReadonlyMap<string, number>;
  matchIds?: ReadonlySet<string>;
  featureIcons?: boolean;
  onClose: () => void;
  /** Opens a park's card back in Explore. */
  onView: (site: Site) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [selected, setSelected] = useState<Site | null>(null);

  // Let the phone turn sideways only while this view is open.
  useEffect(() => {
    if (!visible) return;
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [visible]);

  function close() {
    setSelected(null);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={close}
      // iOS keeps a modal portrait unless it's told otherwise.
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
    >
      {/* Gestures inside a modal need their own root on Android. */}
      <GestureHandlerRootView
        style={[
          styles.screen,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <ParkMap
          sites={sites}
          rankById={rankById}
          matchIds={matchIds}
          featureIcons={featureIcons}
          selectedId={selected?.id ?? null}
          // A second tap on the same park clears it.
          onSelectSite={(site) => setSelected((current) => (current?.id === site.id ? null : site))}
          style={styles.map}
        />

        {/* Floats over the map rather than sitting above it: a sideways
            phone has no height to spare. Top left, because the map's own
            Reset button takes the top right. */}
        <View
          pointerEvents="box-none"
          style={[styles.bar, { top: insets.top + space[2], left: insets.left + space[3] }]}
        >
          <Button label="Close" variant="secondary" onPress={close} />
          <View style={styles.titles}>
            <Heading size={18} numberOfLines={1}>
              {title}
            </Heading>
            {height > width ? (
              <BodyText size={12} color={colors.neutral[600]}>
                Turn your phone sideways for a wider map
              </BodyText>
            ) : null}
          </View>
        </View>

        {selected ? (
          <View style={[styles.chipWrap, { bottom: insets.bottom + space[6] }]}>
            <View style={styles.chip}>
              <View style={styles.chipText}>
                <BodyText size={15} weight="semibold" numberOfLines={1}>
                  {selected.name}
                </BodyText>
                <BodyText size={12} color={colors.neutral[600]} numberOfLines={1}>
                  {`${selected.kind} · ${selected.state}`}
                </BodyText>
              </View>
              <Button
                label="View"
                onPress={() => {
                  setSelected(null);
                  onView(selected);
                }}
              />
            </View>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    maxWidth: '75%',
  },
  titles: {
    flexShrink: 1,
    paddingVertical: 6,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    // Readable over the map without hiding it.
    backgroundColor: 'rgba(249, 244, 237, 0.9)',
  },
  map: {
    flex: 1,
  },
  // Bottom right and narrow, so a sideways phone keeps the tapped park in
  // view: that corner is open ocean on the map. Full width when upright.
  chipWrap: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    alignItems: 'flex-end',
  },
  chip: {
    width: '100%',
    maxWidth: 360,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    paddingLeft: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.lg,
  },
  chipText: {
    flex: 1,
  },
});
