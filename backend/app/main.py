from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.api.adaptations import router as adaptations_router
from app.api.board_statuses import router as board_statuses_router
from app.api.brands import router as brands_router
from app.api.health import router as health_router
from app.api.media import router as media_router
from app.api.posts import router as posts_router
from app.api.social_networks import router as social_networks_router
from app.api.templates import router as templates_router
from app.api.topics import router as topics_router

app = FastAPI(title="Vibely API")
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(brands_router)
app.include_router(topics_router)
app.include_router(templates_router)
app.include_router(board_statuses_router)
app.include_router(social_networks_router)
app.include_router(posts_router)
app.include_router(adaptations_router)
app.include_router(media_router)
