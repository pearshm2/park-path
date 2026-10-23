/**
 * Checks a username as it's typed, for sign-up and Edit profile: first
 * against the rules (the same as api/app/usernames.py, so most mistakes
 * show without a round trip), then, once typing pauses, with the API.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { checkUsername } from '../api/auth';

const PATTERN = /^[a-z0-9][a-z0-9._]{2,19}$/;

/** As the API stores it: trimmed, no leading @, lowercase. */
export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

/** What's wrong with a (normalized) username by the rules alone, or null. */
export function usernameRuleProblem(username: string): string | null {
  if (username.length < 3) return 'Usernames are at least 3 characters.';
  if (username.length > 20) return 'Usernames are at most 20 characters.';
  if (!PATTERN.test(username)) {
    return 'Use letters, numbers, dots and underscores, starting with a letter or number.';
  }
  return null;
}

export type UsernameStatus =
  | { state: 'empty' }
  /** Under 3 characters: not worth a message while still typing. */
  | { state: 'short' }
  | { state: 'checking' }
  | { state: 'available' }
  /** Already yours (Edit profile): nothing to check. */
  | { state: 'yours' }
  | { state: 'problem'; message: string };

export function useUsernameCheck(raw: string, current?: string): UsernameStatus {
  const username = normalizeUsername(raw);
  const ruleProblem = username ? usernameRuleProblem(username) : null;

  // Ask the API only once typing has paused.
  const [settled, setSettled] = useState(username);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(username), 400);
    return () => clearTimeout(timer);
  }, [username]);

  const ask = !!username && !ruleProblem && username !== current && settled === username;
  const check = useQuery({
    queryKey: ['username-available', settled],
    queryFn: () => checkUsername(settled),
    enabled: ask,
    staleTime: 10_000,
  });

  if (!username) return { state: 'empty' };
  // Too short can be fixed by typing more, so it waits for the save.
  if (username.length < 3) return { state: 'short' };
  if (ruleProblem) return { state: 'problem', message: ruleProblem };
  if (username === current) return { state: 'yours' };
  if (!ask || check.isPending) return { state: 'checking' };
  if (check.data && !check.data.available) {
    return { state: 'problem', message: `${check.data.reason ?? 'That username is taken'}.` };
  }
  if (check.data?.available) return { state: 'available' };
  // Couldn't reach the API: let the save itself say if it's taken.
  return { state: 'available' };
}
