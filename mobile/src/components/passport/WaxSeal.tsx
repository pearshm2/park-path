/**
 * A park's stamp as a wax seal, after ornate gilded ones: deep red wax with
 * an even, scalloped edge, a thick rounded lip of wax around the pressed
 * face, a wreath of gold vines inside it, and in the middle, in gold, a
 * drawing of what the park is known for (ParkArt.tsx), its name and the
 * date.
 *
 * It's dry, matte wax, lit softly from the top left: a little lighter
 * there and darker to the bottom right, with no gloss; the gold is shaded
 * light to dark the same way and has a dark edge beneath it so it reads
 * against the wax; and the seal casts a soft shadow on the page.
 *
 * Drawn on a 100 x 100 grid, scaled to `size`.
 */

import { type ReactNode } from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import type { TerrainGroup } from '../../data/parks';
import { fonts } from '../../theme';
import { parkArtShapes } from './ParkArt';
import { arc, seeded } from './stampInk';

/** The wax, from where the light falls to where it doesn't. */
// Dry, matte sealing wax: a dull brick red, close in tone from light to
// dark, so it reads as soft rather than glossy.
const WAX = {
  shine: '#c98a7f',
  light: '#8f3a32',
  body: '#7a2c26',
  deep: '#64221e',
  shadow: '#3d1411',
};

/** Gold leaf, lit from the top left. */
// Matte gold leaf: muted, without a bright highlight.
const GOLD = {
  light: '#e3cc8e',
  mid: '#c49b52',
  dark: '#8f6a2f',
};

/** The pressed face, and the lip of wax around it. */
const FACE_R = 36;
const LIP_R = 41;
const LIP_WIDTH = 6;
/** The vine wreath's circle, just inside the face's edge. */
const VINE_R = 32.5;

type Props = {
  /** The park's code: picks the drawing and turns the wreath. */
  code: string;
  group: TerrainGroup | null;
  name: string;
  /** e.g. "JUN 2024" or "MAY 2, 2026" */
  date: string;
  size: number;
};

/** The name in lines of about a dozen letters, at most three. */
function nameLines(name: string): string[] {
  const words = name.toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + word).length <= 12) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  if (lines.length <= 3) return lines;
  return [...lines.slice(0, 2), lines.slice(2).join(' ')];
}

/** An even, scalloped outline: `scallops` soft bulges round a circle. */
function scalloped(cx: number, cy: number, r: number, depth: number, scallops: number): string {
  const steps = 160;
  const points: string[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    // |sin| gives rounded bulges with crisp dips between them.
    const rr = r - depth + depth * 2 * Math.abs(Math.sin((a * scallops) / 2));
    points.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

/** A leaf at angle `deg` on the wreath, pointing along it, on alternate sides. */
function leaf(deg: number, side: 1 | -1): string {
  const a = (deg * Math.PI) / 180;
  const bx = 50 + Math.cos(a) * VINE_R;
  const by = 50 + Math.sin(a) * VINE_R;
  // Points outward or inward a little, and along the vine.
  const tx = -Math.sin(a);
  const ty = Math.cos(a);
  const nx = Math.cos(a) * side;
  const ny = Math.sin(a) * side;
  const tipX = bx + tx * 4.4 + nx * 3.2;
  const tipY = by + ty * 4.4 + ny * 3.2;
  const c1x = bx + tx * 0.6 + nx * 3;
  const c1y = by + ty * 0.6 + ny * 3;
  const c2x = bx + tx * 3.6 + nx * 0.2;
  const c2y = by + ty * 3.6 + ny * 0.2;
  return (
    `M${bx.toFixed(2)} ${by.toFixed(2)}` +
    `Q${c1x.toFixed(2)} ${c1y.toFixed(2)} ${tipX.toFixed(2)} ${tipY.toFixed(2)}` +
    `Q${c2x.toFixed(2)} ${c2y.toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)}Z`
  );
}

/** Gold, with a dark edge below and to the right so it stands off the wax. */
function gilded(content: (paint: string) => ReactNode, gold: string): ReactNode {
  return (
    <>
      <G transform="translate(0.55 0.75)" opacity={0.85}>
        {content(WAX.shadow)}
      </G>
      {content(gold)}
    </>
  );
}

export function WaxSeal({ code, group, name, date, size }: Props) {
  const id = `wax-${code}`;
  const gold = `url(#${id}-gold)`;
  const outline = scalloped(50, 50, 46.5, 1.6, 14);

  // The wreath turns a little per park, so seals side by side differ.
  const turn = seeded(`${code}:wreath`)() * 20;
  const leaves: { deg: number; side: 1 | -1 }[] = [];
  for (let i = 0; i < 14; i++) leaves.push({ deg: turn + i * (360 / 14), side: i % 2 === 0 ? 1 : -1 });
  const berries = [0, 1, 2, 3, 4, 5].map((i) => turn + 10 + i * 60);

  const lines = nameLines(name);
  const longest = Math.max(...lines.map((l) => l.length));
  const nameSize = Math.min(7.4, 44 / (longest * 0.68));
  const lineHeight = nameSize * 1.08;
  const artSize = lines.length > 2 ? 20 : lines.length > 1 ? 23 : 26;
  const blockHeight = artSize + 2 + lines.length * lineHeight + 7.5;
  const top = 50 - blockHeight / 2;
  const nameTop = top + artSize + 2;
  const dateY = nameTop + lines.length * lineHeight + 5.6;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`${id}-wax`} cx="38" cy="32" r="68" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={WAX.light} />
          <Stop offset="0.5" stopColor={WAX.body} />
          <Stop offset="1" stopColor={WAX.deep} />
        </RadialGradient>
        <LinearGradient id={`${id}-lip`} x1="18" y1="14" x2="82" y2="86" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={WAX.light} />
          <Stop offset="0.45" stopColor={WAX.body} />
          <Stop offset="1" stopColor={WAX.shadow} />
        </LinearGradient>
        <LinearGradient id={`${id}-face`} x1="22" y1="20" x2="78" y2="80" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={WAX.deep} />
          <Stop offset="0.55" stopColor={WAX.body} />
          <Stop offset="1" stopColor={WAX.body} />
        </LinearGradient>
        <LinearGradient id={`${id}-gold`} x1="20" y1="18" x2="80" y2="84" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={GOLD.light} />
          <Stop offset="0.5" stopColor={GOLD.mid} />
          <Stop offset="1" stopColor={GOLD.dark} />
        </LinearGradient>
      </Defs>

      {/* The seal's soft shadow on the page. */}
      <G transform="translate(1.6 2.4)">
        <Path d={outline} fill="#000" opacity={0.1} transform="translate(0.8 0.8)" />
        <Path d={outline} fill="#000" opacity={0.12} />
      </G>

      {/* The wax, scalloped evenly round. */}
      <Path d={outline} fill={`url(#${id}-wax)`} stroke={WAX.deep} strokeWidth={0.8} />

      {/* The lip of wax around the face: matte, lit only softly. */}
      <Circle cx={50} cy={50} r={LIP_R} fill="none" stroke={`url(#${id}-lip)`} strokeWidth={LIP_WIDTH} />

      {/* The pressed face, its edge shaded where the lip overhangs. */}
      <Circle cx={50} cy={50} r={FACE_R} fill={`url(#${id}-face)`} />
      <Path d={arc(50, 50, FACE_R, 150, 300)} fill="none" stroke={WAX.shadow} strokeWidth={1.3} opacity={0.7} />

      {/* A gold rule round the face, and the vine wreath inside it. */}
      {gilded(
        (paint) => (
          <>
            <Circle cx={50} cy={50} r={FACE_R - 1.2} fill="none" stroke={paint} strokeWidth={0.9} />
            <Circle cx={50} cy={50} r={VINE_R} fill="none" stroke={paint} strokeWidth={0.75} />
            {leaves.map((l) => (
              <Path key={l.deg} d={leaf(l.deg, l.side)} fill={paint} />
            ))}
            {berries.map((deg) => (
              <Circle
                key={deg}
                cx={50 + Math.cos((deg * Math.PI) / 180) * (VINE_R - 2.4)}
                cy={50 + Math.sin((deg * Math.PI) / 180) * (VINE_R - 2.4)}
                r={1.1}
                fill={paint}
              />
            ))}
          </>
        ),
        gold,
      )}

      {/* The impression, in gold. */}
      {gilded(
        (paint) => (
          <>
            <G transform={`translate(${50 - artSize / 2} ${top}) scale(${artSize / 48})`}>
              {parkArtShapes({ code, group, color: paint, strokeWidth: 3.4 })}
            </G>
            {lines.map((line, i) => (
              <SvgText
                key={line}
                x={50}
                y={nameTop + (i + 0.82) * lineHeight}
                fill={paint}
                fontFamily={fonts.bodyBold}
                fontSize={nameSize}
                letterSpacing={0.4}
                textAnchor="middle"
              >
                {line}
              </SvgText>
            ))}
            <SvgText
              x={50}
              y={dateY}
              fill={paint}
              fontFamily={fonts.bodyBold}
              fontSize={5}
              letterSpacing={0.6}
              textAnchor="middle"
            >
              {date.toUpperCase()}
            </SvgText>
          </>
        ),
        gold,
      )}
    </Svg>
  );
}
