/**
 * Recommendations, from the engine: POST /recommendations.
 *
 * The engine scores every site against the quiz answers (distance,
 * terrain, season, crowds; see docs/recommendation-engine.md) and returns
 * them best first, by park_code only. This joins them back onto the sites
 * from GET /sites so the cards have names, photos and the rest.
 *
 * The endpoint is public and saves nothing, so no token is sent.
 */

import { request } from './client';
import { listSites, type SiteScope } from './parks';
import type { Site } from '../data/parks';
import { engineRequest, isComplete, type QuizAnswers } from '../data/quizSpec';

/** One site in the engine's response. */
type RecommendationOut = {
  park_code: string;
  /** 0–1; null for sites with no curated data to score on. */
  score: number | null;
  reason: string | null;
  signals: Record<'distance' | 'terrain' | 'season' | 'crowds', number | null>;
};

export type Recommendation = {
  site: Site;
  /** 0–1. */
  score: number;
  /** Why it matched, ready to show, e.g. "About 150 miles away, Mountain terrain". */
  reason: string;
};

/**
 * The scored sites in `scope`, best first. Sites the engine can't score
 * yet (no curated data) and ones that match on nothing are left out.
 */
export async function recommendations(
  answers: QuizAnswers,
  scope: SiteScope = 'parks',
): Promise<Recommendation[]> {
  // The engine rejects an unfinished quiz (422), and Explore is only
  // reached after finishing it, so there is nothing to ask for here.
  if (!isComplete(answers)) return [];

  const [ranked, sites] = await Promise.all([
    request<RecommendationOut[]>('/recommendations', {
      method: 'POST',
      body: engineRequest(answers),
    }),
    listSites(scope),
  ]);

  const siteById = new Map(sites.map((site) => [site.id, site]));
  return ranked.flatMap(({ park_code, score, reason }) => {
    const site = siteById.get(park_code);
    if (!site || score === null || score <= 0) return [];
    return [{ site, score, reason: reason ?? 'A partial match on your answers' }];
  });
}
