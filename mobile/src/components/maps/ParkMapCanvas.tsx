/**
 * Whichever of a park's two maps is chosen, at a given size: the real map
 * with the trails on top, or the official brochure. Shared by the park map
 * screen and its full-screen (sideways) view.
 */

import { View } from 'react-native';

import type { ParkMap } from '../../api/parkMaps';
import { BrochureMapView } from './BrochureMapView';
import { RealParkMap, type RealMapStyle } from './RealParkMap';
import type { MapSelection } from './shared';

export type MapKind = 'real' | 'brochure';

export function ParkMapCanvas({
  kind,
  map,
  width,
  height,
  you,
  realStyle,
  brochureIndex,
  selection,
  onSelect,
  onMapReady,
}: {
  kind: MapKind;
  map: ParkMap;
  width: number;
  height: number;
  you: [number, number] | null;
  realStyle: RealMapStyle;
  brochureIndex: number;
  selection: MapSelection;
  onSelect: (selection: MapSelection) => void;
  onMapReady?: () => void;
}) {
  if (kind === 'brochure') {
    const brochure = map.brochures[brochureIndex] ?? map.brochures[0];
    return brochure ? <BrochureMapView brochure={brochure} width={width} height={height} /> : null;
  }
  return (
    <View style={{ width, height }}>
      <RealParkMap
        map={map}
        mapStyle={realStyle}
        you={you}
        selection={selection}
        onSelect={onSelect}
        onReady={onMapReady}
      />
    </View>
  );
}
