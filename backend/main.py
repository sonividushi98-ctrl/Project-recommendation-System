

from services.semantic_search import search_similar_projects
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database.db import get_connection, initialize_database

app = FastAPI(
    title="ProjectIQ API",
    description="An AI-powered platform for discovering new project ideas.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IdeaInput(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=5000)


@app.on_event("startup")
def startup():
    initialize_database()


@app.get("/")
def home():
    return {
        "project": "ProjectIQ",
        "message": "Welcome to ProjectIQ!",
        "status": "Backend is running successfully.",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/ideas")
def create_idea(idea: IdeaInput):
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO ideas (title, description) VALUES (?, ?)",
            (idea.title, idea.description),
        )
        idea_id = cursor.lastrowid

    return {
        "id": idea_id,
        "title": idea.title,
        "description": idea.description,
        "message": "Idea saved successfully",
    }


@app.get("/ideas")
def get_ideas():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM ideas ORDER BY id DESC"
        ).fetchall()

    return [dict(row) for row in rows]
class SearchInput(BaseModel):
    idea: str = Field(min_length=10, max_length=5000)
    top_k: int = Field(default=3, ge=1, le=5)


@app.post("/analyze")
def analyze_idea(request: SearchInput):
    try:
        similar_projects = search_similar_projects(
            request.idea,
            top_k=request.top_k
        )

        return {
            "submitted_idea": request.idea,
            "similar_projects": similar_projects,
            "message": (
                "Related existing projects found. "
                "Use these results to explore a different direction."
            )
        }

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        ) from error

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        ) from error