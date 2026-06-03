from fastapi import APIRouter

from app.api.routes.incidents import router as incidents_router
from app.api.routes.agents import router as agents_router
from app.api.routes.timeline import router as timeline_router
from app.api.routes.recommendations import router as recommendations_router
from app.api.routes.stream import router as stream_router
from app.api.routes.system import router as system_router

router = APIRouter()

router.include_router(incidents_router)
router.include_router(agents_router)
router.include_router(timeline_router)
router.include_router(recommendations_router)
router.include_router(stream_router)
router.include_router(system_router)
