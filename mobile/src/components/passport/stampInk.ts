/**
 * Shared shapes for the wax seals (WaxSeal.tsx): a repeatable random
 * sequence, uneven circles, and arcs. The random ones are seeded by the
 * park's code, so a park's seal comes out the same every time.
 */

/** A small repeatable sequence of numbers from 0 to 1, from a string. */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * A circle whose edge wanders a little in and out, as a rubber stamp's
 * ring prints or wax spreads: two slow waves at random phases, plus a
 * fine jitter.
 * `wobble` is how far it wanders, in the same units as `r`.
 */
export function wobblyCircle(cx: number, cy: number, r: number, wobble: number, seed: string): string {
  const random = seeded(seed);
  const p1 = random() * Math.PI * 2;
  const p2 = random() * Math.PI * 2;
  const steps = 96;
  const points: string[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr =
      r +
      wobble * (0.55 * Math.sin(3 * a + p1) + 0.3 * Math.sin(7 * a + p2) + 0.3 * (random() - 0.5));
    points.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

/**
 * Poured wax's outline: a circle with a few soft lobes where the wax ran
 * further, smooth all the way round (no jitter).
 */
export function lobedCircle(cx: number, cy: number, r: number, lobes: number, seed: string): string {
  const random = seeded(seed);
  const p1 = random() * Math.PI * 2;
  const p2 = random() * Math.PI * 2;
  const p3 = random() * Math.PI * 2;
  const steps = 120;
  const points: string[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr =
      r + lobes * (0.5 * Math.sin(5 * a + p1) + 0.3 * Math.sin(7 * a + p2) + 0.35 * Math.sin(3 * a + p3));
    points.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

/** An arc of a circle, from one angle to another (degrees, 0 = right, clockwise). */
export function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + Math.cos(rad(from)) * r;
  const y1 = cy + Math.sin(rad(from)) * r;
  const x2 = cx + Math.cos(rad(to)) * r;
  const y2 = cy + Math.sin(rad(to)) * r;
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
