"""
Limits on failed sign-ins, so passwords can't be guessed at speed.

bcrypt already makes each guess slow on the server, but without a limit
an attacker can still try password after password against one account,
or one common password against many accounts. This counts *failed*
attempts in a sliding window and, past the limit, POST /auth/login
answers 429 Too Many Requests until the oldest failure ages out. A
successful sign-in clears that email's count, so someone who mistypes a
few times and then gets it right isn't penalised.

The counts live in this process's memory. That's enough for ParkPath's
single API instance on Render; they reset on a restart, and with several
instances each would count separately, so a shared store (Redis) would
replace this then. Login is the only route that uses it today.
"""

import threading
import time
from collections import deque
from collections.abc import Callable

from fastapi import Request

from app.config import settings


class FailureLimiter:
    """Counts failures per key (an email, an address) within a time window."""

    def __init__(
        self,
        limit: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str, now: float) -> deque[float] | None:
        """This key's failures still inside the window (older ones dropped)."""
        times = self._failures.get(key)
        if times is None:
            return None
        while times and times[0] <= now - self.window:
            times.popleft()
        if not times:
            del self._failures[key]
            return None
        return times

    def retry_after(self, key: str) -> int | None:
        """Seconds until this key may try again, or None if it may now."""
        with self._lock:
            now = self._clock()
            times = self._recent(key, now)
            if times is None or len(times) < self.limit:
                return None
            # Free again once the oldest failure that still counts ages out.
            return max(1, int(times[0] + self.window - now) + 1)

    def record_failure(self, key: str) -> None:
        with self._lock:
            now = self._clock()
            self._recent(key, now)
            self._failures.setdefault(key, deque()).append(now)
            # Keep memory bounded: now and then, forget keys gone quiet.
            if len(self._failures) > 10_000:
                for stale in list(self._failures):
                    self._recent(stale, now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def clear(self) -> None:
        """Forget everything (for tests)."""
        with self._lock:
            self._failures.clear()


login_failures_by_email = FailureLimiter(
    settings.login_max_failures_per_email, settings.login_failure_window_seconds
)
login_failures_by_ip = FailureLimiter(
    settings.login_max_failures_per_ip, settings.login_failure_window_seconds
)


def client_ip(request: Request) -> str:
    """
    The caller's address. On Render, requests arrive through its proxy,
    which adds the real address as the *last* entry of X-Forwarded-For
    (earlier entries come from the caller and can be made up). Locally
    there's no proxy, so it's the connection's own address.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        last = forwarded.split(",")[-1].strip()
        if last:
            return last
    return request.client.host if request.client else "unknown"
