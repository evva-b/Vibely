from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.adaptations import router as adaptations_router
from app.api.board_statuses import router as board_statuses_router
from app.api.brands import router as brands_router
from app.api.chats import router as chats_router
from app.api.health import router as health_router
from app.api.media import router as media_router
from app.api.posts import router as posts_router
from app.api.social_networks import router as social_networks_router
from app.api.templates import router as templates_router
from app.api.topics import router as topics_router
from app.core.config import get_settings

app = FastAPI(title="Vibely API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in get_settings().cors_origins.split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
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
app.include_router(ai_router)
app.include_router(chats_router)
