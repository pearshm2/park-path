/**
 * One of the park's official NPS brochure maps, pinch-to-zoom. The image
 * is ~2400 px on its long side and laid out at that size, so zooming in
 * shows the map's real detail (see ZoomableView).
 *
 * `highlight` zooms to one of the map's visitor center labels and rings it
 * with a gently pulsing outline, so it's easy to spot on a busy map.
 */

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { BrochureMap, MapLabel } from '../../api/parkMaps';
import { colors } from '../../theme';
import { BodyText } from '../Typography';
import { ZoomableView } from './ZoomableView';

/** Space around a label inside its highlight, in map pixels. */
const RING_PAD = 10;

export function BrochureMapView({
  brochure,
  width,
  height,
  highlight = null,
}: {
  brochure: BrochureMap;
  width: number;
  height: number;
  highlight?: MapLabel | null;
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');

  return (
    <View style={{ width, height }}>
      <ZoomableView
        // A different map, or a new frame size (the phone turning as full
        // screen opens), starts again fitted to the frame. The zoom's
        // starting scale is set when it mounts, so it must remount.
        key={`${brochure.uri}@${width}x${height}`}
        width={width}
        height={height}
        contentWidth={brochure.width}
        contentHeight={brochure.height}
        focus={highlight}
      >
        <Image
          source={{ uri: brochure.uri }}
          style={{ width: brochure.width, height: brochure.height }}
          contentFit="contain"
          cachePolicy="disk"
          accessibilityLabel={`${brochure.title}, the official National Park Service map`}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
        />
        {highlight ? <Ring key={highlight.name} label={highlight} /> : null}
      </ZoomableView>
      {state !== 'loaded' ? (
        <View style={styles.overlay} pointerEvents="none">
          {state === 'loading' ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <BodyText size={13} color={colors.neutral[700]}>
              Couldn&apos;t load the map. Check your connection.
            </BodyText>
          )}
        </View>
      ) : null}
    </View>
  );
}

/** The pulsing outline round a highlighted label, in map pixels. */
function Ring({ label }: { label: MapLabel }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
    );
  }, [pulse]);
  const fade = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          left: label.x - RING_PAD,
          top: label.y - RING_PAD,
          width: label.width + RING_PAD * 2,
          height: label.height + RING_PAD * 2,
        },
        fade,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 6,
    borderRadius: 12,
    borderColor: colors.accent,
    backgroundColor: 'rgba(214, 127, 72, 0.18)',
  },
});
