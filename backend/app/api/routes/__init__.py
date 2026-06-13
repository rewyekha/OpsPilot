from fastapi import APIRouter

from app.api.routes.incidents import router as incidents_router
from app.api.routes.recommendations import router as recommendations_router
from app.api.routes.stream import router as stream_router
from app.api.routes.investigations import router as investigations_router
from app.api.routes.insights import router as insights_router
from app.api.routes.system import router as system_router
from app.api.routes.services import router as services_router
from app.api.routes.provider_test import router as provider_test_router
from app.api.routes.demo import router as demo_router

router = APIRouter()

router.include_router(incidents_router)
router.include_router(recommendations_router)
router.include_router(stream_router)
router.include_router(investigations_router)
router.include_router(insights_router)
router.include_router(system_router)
router.include_router(services_router)
router.include_router(provider_test_router)
router.include_router(demo_router)
