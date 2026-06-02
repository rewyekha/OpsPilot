"""
Memory tools — agent episodic and semantic memory via Azure AI Search.

Episodic memory: past incident records indexed with vector embeddings.
Semantic memory:  engineering runbooks indexed by service + symptom.

These tools give agents the ability to say:
  "Based on 3 similar past incidents (INC-2024-0391, INC-2024-0412, INC-2024-0589),
   the most likely resolution is..."

This elevates recommendations from generic to specific and evidence-backed.

Tool signatures:
  search_past_incidents(symptoms: str, service: str, limit: int) -> list[PastIncident]
  store_finding(incident_id: str, finding: dict) -> None
  retrieve_runbook(service: str, symptom: str) -> Runbook | None
  store_incident_resolution(incident: IncidentRecord) -> None
    (called after resolution to grow the episodic memory index)
"""
