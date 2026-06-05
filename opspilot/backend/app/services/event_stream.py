"""
SSE event stream service.

In-process event bus that bridges agent execution callbacks to the HTTP SSE
endpoints consumed by the frontend.

Architecture:
  Agent emits event
      └► EventStreamService.emit(incident_id, event_dict)
              ├► appended to a RETAINED per-incident history (replay log)
              └► fanned out to every live subscriber queue
                      └► /api/incidents/{id}/stream SSE endpoint (subscribe-only)
                              └► Frontend SSE consumer

Why retention + fan-out (vs the old single-queue design):
  The stream endpoint no longer launches investigations — it only subscribes.
  An investigation therefore runs exactly once (triggered explicitly), while any
  number of viewers may connect, reconnect, or refresh. Each subscriber first
  REPLAYS the full history, then tails live events, so a viewer that connects
  after the run completes still sees the whole investigation — without ever
  re-executing the agents.
"""
from __future__ import annotations

import asyncio
from typing import AsyncGenerator

# Retained event log per incident (enables replay for late/reconnecting subscribers)
_HISTORY: dict[str, list[dict]] = {}
# Live tail queues per incident (fan-out to concurrent subscribers)
_SUBSCRIBERS: dict[str, set[asyncio.Queue]] = {}
# Whether the investigation for an incident has finished (sentinel reached)
_DONE: dict[str, bool] = {}
_SENTINEL = None  # placed on a subscriber queue to signal end-of-stream


class EventStreamService:
    """In-process pub/sub for SSE events, with replay."""

    def open(self, incident_id: str) -> None:
        """Initialise retention/subscriber slots for an incident. Idempotent."""
        _HISTORY.setdefault(incident_id, [])
        _SUBSCRIBERS.setdefault(incident_id, set())

    def reset(self, incident_id: str) -> None:
        """Clear the retained history for a fresh (forced) re-investigation."""
        _HISTORY[incident_id] = []
        _DONE[incident_id] = False

    async def emit(self, incident_id: str, event: dict) -> None:
        """Publish one event frame: retain it and fan it out to live subscribers."""
        self.open(incident_id)
        _HISTORY[incident_id].append(event)
        for queue in list(_SUBSCRIBERS[incident_id]):
            await queue.put(event)

    async def close(self, incident_id: str) -> None:
        """Mark the investigation complete and signal end-of-stream to subscribers."""
        _DONE[incident_id] = True
        for queue in list(_SUBSCRIBERS.get(incident_id, ())):
            await queue.put(_SENTINEL)

    async def subscribe(
        self, incident_id: str, timeout: float = 120.0
    ) -> AsyncGenerator[dict, None]:
        """
        Async generator that yields events for *incident_id*.

        Replays the retained history first, then — if the investigation is still
        running — tails live events until the stream closes or *timeout* seconds
        pass without a new event. NEVER launches an investigation.
        """
        self.open(incident_id)
        queue: asyncio.Queue = asyncio.Queue()
        # Atomic snapshot+register (no await between these lines, so no emit can
        # interleave): `backlog` holds everything so far; `queue` receives every
        # future event. No gaps, no duplicates.
        backlog = list(_HISTORY[incident_id])
        done = _DONE.get(incident_id, False)
        _SUBSCRIBERS[incident_id].add(queue)
        try:
            for event in backlog:
                yield event
            if done:
                return  # completed run already fully replayed; client will close
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=timeout)
                except TimeoutError:
                    return
                if item is _SENTINEL:
                    return
                yield item
        finally:
            _SUBSCRIBERS[incident_id].discard(queue)


# Module-level singleton
_event_stream = EventStreamService()


def get_event_stream() -> EventStreamService:
    return _event_stream
