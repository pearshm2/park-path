/**
 * One of the park's official NPS brochure maps, pinch-to-zoom. The image
 * is ~2400 px on its long side and laid out at that size, so zooming in
 * shows the map's real detail (see ZoomableView).
 *
 * The brochure isn't tied to coordinates the way the other views are, so
 * there's no "you are here" star on it. It has its own visitor centers.
 */

import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { BrochureMap } from '../../api/parkMaps';
import { colors } from '../../theme';
import { BodyText } from '../Typography';
import { ZoomableView } from './ZoomableView';

export function BrochureMapView({
  brochure,
  width,
  height,
}: {
  brochure: BrochureMap;
  width: number;
  height: number;
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');

  return (
    <View style={{ width, height }}>
      <ZoomableView
        // A different map starts again at its fitted size.
        key={brochure.uri}
        width={width}
        height={height}
        contentWidth={brochure.width}
        contentHeight={brochure.height}
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

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
