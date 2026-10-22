/**
 * A park's passport cancellation stamp, drawn like the real ones at park
 * visitor centres: a double ring in a single ink, the park's name curving
 * around the top, the date across the middle, the state along the bottom,
 * and the ink a little worn, speckled where the rubber didn't take.
 *
 * The speckles come from the park's id, so a park's stamp looks the same
 * every time.
 */

import Svg, { Circle, Defs, G, Mask, Path, Rect, Text as SvgText, TextPath } from 'react-native-svg';

import { fonts } from '../../theme';

type Props = {
  /** Seeds the worn ink, so each park's stamp stays the same. */
  id: string;
  name: string;
  /** e.g. "MAY 2" */
  day: string;
  /** e.g. "2026" */
  year: string;
  /** Along the bottom, e.g. "TN / NC". */
  footer: string;
  color: string;
  size?: number;
};

/** A small repeatable sequence of numbers from 0 to 1, from a string. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Roughly how wide a line of capitals is, at a size and spacing. */
function textWidth(text: string, fontSize: number, letterSpacing: number): number {
  return text.length * (fontSize * 0.74 + letterSpacing);
}

/** Shrinks long names to fit the top arc, leaving a margin at each end. */
function arcFontSize(text: string, arcLength: number, max: number, letterSpacing: number): number {
  const room = arcLength * 0.86;
  return Math.min(max, (room / Math.max(1, text.length) - letterSpacing) / 0.74);
}

/**
 * Where to start text along an arc so it sits centred on it. Android
 * ignores textAnchor on a text path, so the offset is worked out instead.
 */
function centredOffset(text: string, fontSize: number, letterSpacing: number, arcLength: number): number {
  return Math.max(0, (arcLength - textWidth(text, fontSize, letterSpacing)) / 2);
}

/** The top arc (radius 41) and bottom arc (radius 46) are half circles. */
const TOP_ARC = Math.PI * 41;
const BOTTOM_ARC = Math.PI * 46;
const TOP_SPACING = 0.6;
const BOTTOM_SPACING = 1;
const BOTTOM_SIZE = 8.5;

export function InkStamp({ id, name, day, year, footer, color, size = 128 }: Props) {
  const c = 64; // drawn on a 128 grid
  const random = seeded(id);
  // Worn ink: specks where the rubber didn't take, mostly towards the rim.
  const specks = Array.from({ length: 46 }, () => {
    const angle = random() * Math.PI * 2;
    const dist = 18 + Math.sqrt(random()) * 44;
    return { x: c + Math.cos(angle) * dist, y: c + Math.sin(angle) * dist, r: 0.5 + random() * 1.6 };
  });

  const top = name.toUpperCase();
  const topSize = arcFontSize(top, TOP_ARC, 11, TOP_SPACING);
  const bottom = footer.toUpperCase();
  const maskId = `ink-${id}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 128 128">
      <Defs>
        <Mask id={maskId} x="0" y="0" width="128" height="128" maskUnits="userSpaceOnUse">
          <Rect x="0" y="0" width="128" height="128" fill="#fff" />
          {specks.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#000" />
          ))}
        </Mask>
        {/* Text paths: across the top, left to right, and along the bottom. */}
        {/* The top text sits on a 41 radius, rising towards the inner ring;
            the bottom text on a 46 radius, hanging inwards from it. */}
        <Path id={`${maskId}-top`} d="M 23,64 A 41,41 0 0 1 105,64" />
        <Path id={`${maskId}-bottom`} d="M 18,64 A 46,46 0 0 0 110,64" />
      </Defs>

      <G mask={`url(#${maskId})`} opacity={0.92}>
        <Circle cx={c} cy={c} r={60} fill="none" stroke={color} strokeWidth={3.6} />
        <Circle cx={c} cy={c} r={53.5} fill="none" stroke={color} strokeWidth={1.2} />
        <Circle cx={c} cy={c} r={31} fill="none" stroke={color} strokeWidth={1} />

        <SvgText fill={color} fontFamily={fonts.bodyBold} fontSize={topSize} letterSpacing={TOP_SPACING}>
          <TextPath href={`#${maskId}-top`} startOffset={centredOffset(top, topSize, TOP_SPACING, TOP_ARC)}>
            {top}
          </TextPath>
        </SvgText>
        <SvgText fill={color} fontFamily={fonts.bodySemibold} fontSize={BOTTOM_SIZE} letterSpacing={BOTTOM_SPACING}>
          <TextPath
            href={`#${maskId}-bottom`}
            startOffset={centredOffset(bottom, BOTTOM_SIZE, BOTTOM_SPACING, BOTTOM_ARC)}
          >
            {bottom}
          </TextPath>
        </SvgText>

        {/* Stars either side, where the rings' text meets. */}
        <Path d={star(14, 64, 3.2)} fill={color} />
        <Path d={star(114, 64, 3.2)} fill={color} />

        <SvgText x={c} y={62} fill={color} fontFamily={fonts.heading} fontSize={13} textAnchor="middle">
          {day.toUpperCase()}
        </SvgText>
        <SvgText x={c} y={77} fill={color} fontFamily={fonts.bodyBold} fontSize={11} letterSpacing={1.5} textAnchor="middle">
          {year}
        </SvgText>
      </G>
    </Svg>
  );
}

/** A five-pointed star centred on (cx, cy). */
function star(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`;
  });
  return `M${points.join('L')}Z`;
}
