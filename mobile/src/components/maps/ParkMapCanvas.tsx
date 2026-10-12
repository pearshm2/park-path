/**
 * Whichever of a park's three maps is chosen, at a given size: the trail
 * map drawn in the app's style, the real map, or the official brochure.
 * Shared by the park map screen and its full-screen (sideways) view.
 */

import { View } from 'react-native';

import type { ParkMap } from '../../api/parkMaps';
import { BrochureMapView } from './BrochureMapView';
import { DrawnParkMap, type MapSelection } from './DrawnParkMap';
import { RealParkMap, type RealMapStyle } from './RealParkMap';

export type MapKind = 'drawn' | 'real' | 'brochure';

export function ParkMapCanvas({
  kind,
  map,
  width,
  height,
  tint,
  you,
  realStyle,
  brochureIndex,
  selection,
  onSelect,
}: {
  kind: MapKind;
  map: ParkMap;
  width: number;
  height: number;
  tint: string;
  you: [number, number] | null;
  realStyle: RealMapStyle;
  brochureIndex: number;
  selection: MapSelection;
  onSelect: (selection: MapSelection) => void;
}) {
  if (kind === 'brochure') {
    const brochure = map.brochures[brochureIndex] ?? map.brochures[0];
    return brochure ? <BrochureMapView brochure={brochure} width={width} height={height} /> : null;
  }
  if (kind === 'real') {
    return (
      <View style={{ width, height }}>
        <RealParkMap
          map={map}
          mapStyle={realStyle}
          you={you}
          selection={selection}
          onSelect={onSelect}
        />
      </View>
    );
  }
  return (
    <DrawnParkMap
      // A new size (the phone turning) starts again at the fitted zoom.
      key={`${width}x${height}`}
      map={map}
      width={width}
      height={height}
      tint={tint}
      you={you}
      selection={selection}
      onSelect={onSelect}
    />
  );
}
