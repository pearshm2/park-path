/**
 * Recommendations, from the engine: POST /recommendations.
 *
 * The engine scores every site against the quiz answers (distance,
 * terrain, season, crowds; see docs/recommendation-engine.md) and returns
 * them best first, by park_code only. This joins them back onto the sites
 * from GET /sites so the cards have names, photos and the rest.
 *
 * The endpoint works without an account. When a token is passed, the
 * engine also uses the person's logged trips: visited parks move down the
 * list, and terrains they rated highly get a small boost.
 */

import { request } from './client';
import type { components } from './schema';
import { listSites, type SiteScope } from './parks';
import type { Site } from '../data/parks';
import { engineRequest, isComplete, type QuizAnswers } from '../data/quizSpec';

/** One site in the engine's response. Generated from the API; see src/api/schema.ts. */
type RecommendationOut = components['schemas']['RecommendationOut'];

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
  token?: string | null,
): Promise<Recommendation[]> {
  // The engine rejects an unfinished quiz (422), and Explore is only
  // reached after finishing it, so there is nothing to ask for here.
  if (!isComplete(answers)) return [];

  const [ranked, sites] = await Promise.all([
    request<RecommendationOut[]>('/recommendations', {
      method: 'POST',
      body: engineRequest(answers),
      token,
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
