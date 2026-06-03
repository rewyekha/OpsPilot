"""OpsPilot Backend — FastAPI application entry point.

Start with:
    uvicorn app.main:app --reload

Registers:
  - API routers: incidents, agents, timeline, recommendations, stream
  - CORS middleware (origins from settings)
  - Structured JSON logging via structlog
  - Health check endpoint at GET /health
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.observability.logging import configure_logging
from app.api.routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    log = structlog.get_logger("opspilot")
    log.info(
        "startup",
        host=settings.api_host,
        port=settings.api_port,
        cors_origins=settings.api_cors_origins,
    )
    yield
    log.info("shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(
        title="OpsPilot API",
        description=(
            "Multi-Agent Autonomous SRE Command Center for Enterprise Cloud Operations. "
            "Powered by LangGraph, Azure AI Foundry, and GPT-4o."
        ),
        version="0.2.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix="/api")

    @application.get("/health", tags=["health"], summary="Health check")
    async def health_check() -> dict[str, str]:
        return {"status": "healthy", "service": "opspilot-api", "version": "0.2.0"}

    return application


app = create_app()
