"""
Authentication middleware.

Validates Azure Entra ID (MSAL) Bearer tokens on all protected routes.
Uses JWKS endpoint of the configured tenant for token verification.
Public routes: /health, /docs, /openapi.json
"""
