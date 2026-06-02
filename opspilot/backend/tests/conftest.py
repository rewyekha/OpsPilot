"""
Pytest configuration and shared fixtures.

Fixtures provided:
  - mock_settings: Settings with USE_MOCK_TOOLS=true and placeholder Azure values
  - mock_incident: a pre-built CreateIncidentRequest for the checkout failure scenario
  - mock_ops_pilot_state: a pre-built OpsPilotState for unit testing agent nodes
  - async_client: an AsyncClient wrapping the FastAPI app for integration tests
"""
