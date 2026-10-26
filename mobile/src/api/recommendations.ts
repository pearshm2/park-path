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

import { useQuery } from '@tanstack/react-query';

import { request } from './client';
import type { components } from './schema';
import { listSites, type SiteScope } from './parks';
import type { Site } from '../data/parks';
import { engineRequest, isComplete, type QuizAnswers } from '../data/quizSpec';
import { useAuth } from '../auth/AuthContext';
import { useQuiz } from '../quiz/QuizContext';
import { useTrips } from '../trips/TripsContext';

/** One site in the engine's response. Generated from the API; see src/api/schema.ts. */
type RecommendationOut = components['schemas']['RecommendationOut'];

/** How well a site fits on each signal, 0–1, or null where there's no data. */
export type SignalScores = components['schemas']['SignalScores'];

export type Recommendation = {
  site: Site;
  /** 0–1. */
  score: number;
  /** Why it matched, ready to show, e.g. "About 150 miles away, Mountain terrain". */
  reason: string;
  /** The four signals behind the score. */
  signals: SignalScores;
  /** The engine's "something different" pick: a terrain new to you. Shown at #4. */
  different: boolean;
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
  return ranked.flatMap(({ park_code, score, reason, signals, different }) => {
    const site = siteById.get(park_code);
    if (!site || score === null || score <= 0) return [];
    return [
      { site, score, reason: reason ?? 'A partial match on your answers', signals, different },
    ];
  });
}

/**
 * Every site's match for the signed-in person, scored across all sites.
 * One query shared by Explore and the site page, so opening a park's page
 * reads it from the cache. Refetched when a trip is logged, since the
 * engine uses your trips.
 */
export function useRecommendations() {
  const { answers } = useQuiz();
  const { token } = useAuth();
  const { visitedIds } = useTrips();
  return useQuery({
    queryKey: ['recommendations', answers, 'all', token, visitedIds.size],
    queryFn: () => recommendations(answers, 'all', token),
  });
}
