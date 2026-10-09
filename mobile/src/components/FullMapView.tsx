/**
 * The Explore map on its own, full screen, opened from the map's expand
 * button. This is the one place the app turns sideways: everything else
 * is laid out for a tall phone, so the app is locked to portrait (see the
 * root layout) and only unlocked while this view is open.
 *
 * The map runs edge to edge; only the controls floating over it keep
 * clear of the notch and home bar. Sideways the map is limited by the
 * screen's height, so it sits clear of the notch at the sides anyway.
 *
 * Tapping a park shows its name with a View button, which closes this
 * view and opens that park's card in Explore.
 */

import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Site } from '../data/parks';
import { colors, radius, shadow, space } from '../theme';
import { Button } from './Button';
import { ParkMap } from './ParkMap';
import { BodyText, Heading } from './Typography';

type FullMapViewProps = {
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
};

export function FullMapView(props: FullMapViewProps) {
  const { visible, onClose } = props;

  // Let the phone turn sideways only while this view is open.
  useEffect(() => {
    if (!visible) return;
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      // iOS keeps a modal portrait unless it's told otherwise.
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
    >
      {/* Its own safe-area provider: the app's one, outside the modal, keeps
          the upright insets after the phone turns, which cut the map short. */}
      <SafeAreaProvider>
        <FullMapBody {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function FullMapBody({
  title,
  sites,
  rankById,
  matchIds,
  featureIcons,
  onClose,
  onView,
}: FullMapViewProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [selected, setSelected] = useState<Site | null>(null);

  return (
    // Gestures inside a modal need their own root on Android.
    <GestureHandlerRootView style={styles.screen}>
      <ParkMap
        sites={sites}
        rankById={rankById}
        matchIds={matchIds}
        featureIcons={featureIcons}
        selectedId={selected?.id ?? null}
        // A second tap on the same park clears it.
        onSelectSite={(site) => setSelected((current) => (current?.id === site.id ? null : site))}
        // Keeps the map's Reset button clear of the notch and status bar.
        controlInset={{ top: insets.top, right: insets.right }}
        style={styles.map}
      />

      {/* Top left, because the map's own Reset button takes the top right. */}
      <View
        pointerEvents="box-none"
        style={[styles.bar, { top: insets.top + space[2], left: insets.left + space[3] }]}
      >
        <Button
          label="Close"
          variant="secondary"
          onPress={() => {
            setSelected(null);
            onClose();
          }}
        />
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
        <View
          style={[
            styles.chipWrap,
            {
              bottom: insets.bottom + space[4],
              left: insets.left + space[4],
              right: insets.right + space[4],
            },
          ]}
        >
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
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  map: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
  // Bottom right and narrow, so a sideways phone keeps the tapped park in
  // view: that corner is open ocean on the map. Full width when upright.
  chipWrap: {
    position: 'absolute',
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
