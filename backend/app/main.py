from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import datasets, eda, predictions, training

app = FastAPI(title="Self-Service Analytics & ML Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router)
app.include_router(eda.router)
app.include_router(training.router)
app.include_router(predictions.router)


@app.get("/health")
def health():
    return {"status": "ok"}
