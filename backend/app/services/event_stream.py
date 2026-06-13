"""
SSE event stream service.

Manages an in-process event bus that bridges agent execution callbacks
to the HTTP SSE endpoints consumed by the frontend.

Architecture:
  Agent emits event
      └► EventStreamService.emit(incident_id, event_dict)
              └► asyncio.Queue per incident_id
                      └► /api/incidents/{id}/stream SSE endpoint
                              └► Frontend SSE consumer

One queue per active investigation. Queues are closed (sentinel None enqueued)
when the investigation completes or errors.
"""
from __future__ import annotations

import asyncio
from typing import AsyncGenerator

_QUEUES: dict[str, asyncio.Queue[dict | None]] = {}
_SENTINEL = None  # placed on queue to signal stream end


class EventStreamService:
    """In-process pub/sub for SSE events."""

    def open(self, incident_id: str) -> None:
        """Create a queue for this investigation. Idempotent."""
        if incident_id not in _QUEUES:
            _QUEUES[incident_id] = asyncio.Queue()

    async def emit(self, incident_id: str, event: dict) -> None:
        """Publish one event frame. Creates queue if missing."""
        self.open(incident_id)
        await _QUEUES[incident_id].put(event)

    async def close(self, incident_id: str) -> None:
        """Signal end-of-stream; consumers will stop after draining."""
        if incident_id in _QUEUES:
            await _QUEUES[incident_id].put(_SENTINEL)

    async def subscribe(
        self, incident_id: str, timeout: float = 120.0
    ) -> AsyncGenerator[dict, None]:
        """
        Async generator that yields events for *incident_id*.

        Yields until the stream is closed (sentinel received) or *timeout* seconds
        elapse without a new event.
        """
        self.open(incident_id)
        queue = _QUEUES[incident_id]
        try:
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=timeout)
                except TimeoutError:
                    return
                if item is _SENTINEL:
                    return
                yield item
        finally:
            # Clean up queue when subscriber disconnects
            _QUEUES.pop(incident_id, None)


# Module-level singleton
_event_stream = EventStreamService()


def get_event_stream() -> EventStreamService:
    return _event_stream
