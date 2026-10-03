/**
 * Park data access.
 *
 * Reads the bundled fixtures in src/data/parks.ts because the API has no
 * /parks route yet — api/app/main.py mounts only the auth router. The
 * functions are async and shaped like network calls on purpose: when the
 * endpoint lands, their bodies change and nothing above them does.
 */

import { NAMED_PARKS, SITES, type Season, type Site } from '../data/parks';
import type { QuizAnswers } from '../data/quizSpec';

export type SiteScope = 'parks' | 'all';

/** All sites, or just the 63 named national parks. */
export async function listSites(scope: SiteScope = 'parks'): Promise<Site[]> {
  return scope === 'parks' ? NAMED_PARKS : SITES;
}

export type Recommendation = {
  site: Site;
  /** 0–1, for the strength bars in the feed. */
  score: number;
  /** Human-readable reason, shown under the park name. */
  reason: string;
};

/**
 * A deliberately simple stand-in for the real recommendation engine.
 *
 * Dylan's engine is the actual deliverable here; this exists so the feed
 * shows plausible, quiz-responsive results in the meantime. It weights
 * terrain heaviest, which is what the quiz tells the user it does
 * ("This carries the heaviest weight in your feed").
 */
export async function recommendSites(
  answers: QuizAnswers,
  scope: SiteScope = 'parks',
): Promise<Recommendation[]> {
  const sites = await listSites(scope);

  const scored = sites.map((site) => {
    const reasons: string[] = [];
    let score = 0;

    // Terrain — the heaviest signal, as the quiz promises.
    if (answers.terrains.length > 0 && answers.terrains.includes(site.group as never)) {
      score += 0.45;
      reasons.push(`${site.feature.toLowerCase()} matches your terrain`);
    }

    // Season fit.
    if (answers.season && site.seasons.includes(answers.season as Season)) {
      score += 0.25;
      reasons.push(`good in ${answers.season}`);
    }

    // Effort: exact match scores best, one step away still counts.
    if (answers.effort !== null) {
      const gap = Math.abs(site.effort - answers.effort);
      if (gap === 0) {
        score += 0.2;
        reasons.push('trail difficulty lines up');
      } else if (gap === 1) {
        score += 0.08;
      }
    }

    // Trip length: a park needing more days than available is a stretch.
    if (answers.days !== null) {
      if (site.days <= answers.days) {
        score += 0.1;
      } else {
        score -= 0.12;
        reasons.push(`usually wants ${site.days} days`);
      }
    }

    // Accessibility: when an adjustment is requested, easy parks rise.
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
