"""Lightweight process-wide rate limiter for OpenAI requests."""
from __future__ import annotations

import os
import time
from collections import deque
from threading import Lock
from typing import Deque


class SimpleRateLimiter:
    def __init__(self, max_calls: int, window_seconds: float) -> None:
        if max_calls <= 0:
            raise ValueError("max_calls must be positive")
        if window_seconds <= 0:
            raise ValueError("window_seconds must be positive")
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self._timestamps: Deque[float] = deque()
        self._lock = Lock()

    def acquire(self) -> None:
        """Block until another request slot is available."""
        while True:
            wait_time = 0.0
            with self._lock:
                now = time.monotonic()
                while self._timestamps and now - self._timestamps[0] >= self.window_seconds:
                    self._timestamps.popleft()
                if len(self._timestamps) < self.max_calls:
                    self._timestamps.append(now)
                    return
                wait_time = self.window_seconds - (now - self._timestamps[0])
            time.sleep(max(wait_time, 0.05))


_shared_limiter: SimpleRateLimiter | None = None


def get_shared_openai_limiter() -> SimpleRateLimiter:
    global _shared_limiter
    if _shared_limiter is None:
        max_calls = int(os.getenv("OPENAI_RPM_LIMIT", "3"))
        window = float(os.getenv("OPENAI_RPM_WINDOW", "60"))
        _shared_limiter = SimpleRateLimiter(max_calls, window)
    return _shared_limiter
