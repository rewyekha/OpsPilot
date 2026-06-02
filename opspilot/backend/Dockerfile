# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: base — shared system dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VERSION=1.8.3 \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false

RUN pip install "poetry==$POETRY_VERSION"

COPY pyproject.toml poetry.lock* ./
RUN poetry install --only main --no-root

COPY app/ ./app/
COPY fixtures/ ./fixtures/

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: development — includes dev dependencies, hot reload
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS development

RUN poetry install --no-root

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: production — minimal image, no dev tools
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS production

# Run as non-root user
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid appgroup --no-create-home appuser

USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
