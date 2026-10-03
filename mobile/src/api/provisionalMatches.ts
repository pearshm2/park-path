/* ===========================================================================
 *  PLACEHOLDER — THIS IS NOT THE RECOMMENDATION ENGINE
 *  ---------------------------------------------------------------------------
 *  Dylan owns the real weighted-sum recommendation engine (week 4:
 *  "Build the weighted-sum recommendation engine; wire it to score live").
 *
 *  This file exists only so the For You feed has something plausible to
 *  render during the week 2/3 demo, before that engine exists. The
 *  weights below were picked to look reasonable on screen — they are NOT
 *  a proposal, a design, or a starting point for his work, and no one
 *  should treat them as having been thought about.
 *
 *  WHEN DYLAN'S ENGINE LANDS: delete this entire file and repoint
 *  src/app/(tabs)/explore.tsx at it. Nothing else imports this.
 * ===========================================================================
 */

import { listSites, type SiteScope } from './parks';
import type { Season, Site } from '../data/parks';
import type { QuizAnswers } from '../data/quizSpec';

export type ProvisionalMatch = {
  site: Site;
  /** 0–1. Display only — see the banner above. */
  score: number;
  /** Human-readable reason, shown under the park name. */
  reason: string;
};

/**
 * Scores the bundled sites against the quiz answers.
 *
 * Deliberately named "provisional" rather than "recommend" so it cannot
 * be mistaken for the real engine at a call site.
 */
export async function provisionalMatches(
  answers: QuizAnswers,
  scope: SiteScope = 'parks',
): Promise<ProvisionalMatch[]> {
  const sites = await listSites(scope);

  const scored = sites.map((site) => {
    const reasons: string[] = [];
    let score = 0;

    // Terrain weighted heaviest only because the quiz copy promises it
    // ("This carries the heaviest weight in your feed") — not because
    // this placeholder has an opinion about signal strength.
    if (answers.terrains.length > 0 && answers.terrains.includes(site.group as never)) {
      score += 0.45;
      reasons.push(`${site.feature.toLowerCase()} matches your terrain`);
    }

    if (answers.season && site.seasons.includes(answers.season as Season)) {
      score += 0.25;
      reasons.push(`good in ${answers.season}`);
    }

    if (answers.effort !== null) {
      const gap = Math.abs(site.effort - answers.effort);
      if (gap === 0) {
        score += 0.2;
        reasons.push('trail difficulty lines up');
      } else if (gap === 1) {
        score += 0.08;
      }
    }

    if (answers.days !== null) {
      if (site.days <= answers.days) {
        score += 0.1;
      } else {
        score -= 0.12;
        reasons.push(`usually wants ${site.days} days`);
      }
    }

    if (answers.needs && answers.needs !== 'none') {
      if (site.effort === 1) {
        score += 0.15;
        reasons.push('step-free options available');
      } else if (site.effort === 3) {
        score -= 0.15;
      }
    }

    return {
      site,
      score: Math.max(0, Math.min(1, score)),
      reason: reasons.length
        ? capitalise(reasons.slice(0, 2).join(', '))
        : 'A broad match on your answers',
    };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.site.vis - a.site.vis)
    .filter((entry) => entry.score > 0);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
