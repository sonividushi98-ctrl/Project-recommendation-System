import os
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Path as FPath
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database.db import (
    get_connection,
    initialize_database,
    save_feedback,
    get_feedback_list,
    get_feedback_statistics,
)
from database.chat_store import (
    init_storage,
    get_storage_type,
    create_conversation,
    get_conversations,
    get_conversation,
    delete_conversation,
    get_messages,
    update_conversation_preferences,
    toggle_bookmark,
    get_bookmarks,
)
from services.semantic_search import search_similar_projects
from services.hybrid_recommender import recommend_projects, get_dataset
from services.tfidf_engine import fit_or_get_tfidf
from services.embedding_engine import build_or_load_project_embeddings
from services.evaluator import evaluate_recommendation_models
from services.chat_engine import process_chat_message

app = FastAPI(
    title="ProjectIQ API",
    description="An AI/ML-Powered Conversational Platform for Academic Project Recommendation and Semantic Intelligence.",
    version="2.0.0",
)

# CORS configuration supporting standard Vite & React dev ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Pydantic Request Models
# ==========================================

class IdeaInput(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=5000)


class SearchInput(BaseModel):
    idea: str = Field(min_length=10, max_length=5000)
    top_k: int = Field(default=3, ge=1, le=10)


class RecommendationRequest(BaseModel):
    title: str = Field(default="", max_length=200)
    query: str = Field(default="", max_length=5000)
    skills: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    domain: str = Field(default="Any")
    difficulty: str = Field(default="Any")
    technologies: List[str] = Field(default_factory=list)
    top_k: int = Field(default=5, ge=1, le=20)
    mode: str = Field(default="hybrid")  # hybrid, semantic_only, tfidf_only
    semantic_weight: float = Field(default=0.45, ge=0.0, le=1.0)
    tfidf_weight: float = Field(default=0.30, ge=0.0, le=1.0)
    preference_weight: float = Field(default=0.25, ge=0.0, le=1.0)


class FeedbackInput(BaseModel):
    project_id: str = Field(min_length=1, max_length=50)
    feedback_type: str = Field(pattern="^(like|dislike|rating)$")
    project_title: Optional[str] = ""
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    comment: Optional[str] = Field(default="", max_length=1000)
    user_query: Optional[str] = Field(default="", max_length=5000)


# Conversational Chatbot Models
class NewConversationRequest(BaseModel):
    title: Optional[str] = "New Conversation"
    preferences: Optional[Dict[str, Any]] = None


class ChatMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    preferences: Optional[Dict[str, Any]] = None


class BookmarkRequest(BaseModel):
    conversation_id: str
    project_id: str
    project_title: Optional[str] = ""
    project_domain: Optional[str] = ""
    project_difficulty: Optional[str] = ""


class PreferencesUpdateRequest(BaseModel):
    preferences: Dict[str, Any]


# ==========================================
# Startup Lifecycle
# ==========================================

@app.on_event("startup")
def startup():
    """Initializes SQLite database, conversation store, and preloads AI/ML models and embeddings."""
    initialize_database()
    init_storage()
    try:
        projects, _ = get_dataset()
        fit_or_get_tfidf(projects)
        build_or_load_project_embeddings(projects)
        print(f"[ProjectIQ] Preloaded {len(projects)} projects with TF-IDF & Sentence Transformer embeddings.")
    except Exception as e:
        print(f"[ProjectIQ] Warning during startup preload: {e}")


# ==========================================
# Existing Endpoints (Preserved 100%)
# ==========================================

@app.get("/")
def home():
    return {
        "project": "ProjectIQ",
        "message": "Welcome to ProjectIQ AI/ML Conversational Recommendation Platform!",
        "status": "Backend is running successfully.",
        "storage": get_storage_type(),
        "models": {
            "conversational_ai": "Google Gemini API (Flash)",
            "sentence_transformer": "all-MiniLM-L6-v2 (Semantic Cosine Similarity)",
            "tfidf": "TfidfVectorizer unigram+bigram (Content-Based Cosine Similarity)",
            "preference_engine": "Multi-attribute weighted metadata alignment",
            "hybrid": "Weighted linear rank aggregation",
        }
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "storage": get_storage_type()}


@app.post("/ideas")
def create_idea(idea: IdeaInput):
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO ideas (title, description) VALUES (?, ?)",
            (idea.title, idea.description),
        )
        connection.commit()
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


@app.post("/analyze")
def analyze_idea(request: SearchInput):
    """Legacy semantic search endpoint preserved for backward compatibility."""
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


@app.get("/metadata")
def get_metadata():
    """Returns dataset metadata, domain list, skills, and technologies for frontend filtering."""
    try:
        _, metadata = get_dataset()
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load metadata: {e}")


@app.post("/recommend")
def get_recommendations(req: RecommendationRequest):
    """
    Core AI/ML Hybrid Recommendation Engine.
    Combines:
    1. Sentence Transformers Semantic Embedding (all-MiniLM-L6-v2)
    2. TF-IDF Cosine Similarity
    3. User Preference Matching (Skills, Domain, Difficulty, Tech)
    """
    try:
        has_text = bool(req.query.strip() or req.title.strip())
        has_prefs = bool(req.skills or req.technologies or (req.domain and req.domain != "Any"))

        if not has_text and not has_prefs:
            raise HTTPException(
                status_code=400,
                detail="Please provide at least a project description, title, or skills/domain preferences."
            )

        result = recommend_projects(
            query_text=req.query,
            title=req.title,
            user_skills=req.skills,
            user_interests=req.interests,
            preferred_domain=req.domain,
            preferred_difficulty=req.difficulty,
            preferred_technologies=req.technologies,
            top_k=req.top_k,
            mode=req.mode,
            semantic_weight=req.semantic_weight,
            tfidf_weight=req.tfidf_weight,
            preference_weight=req.preference_weight,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation error: {e}")


@app.post("/feedback")
def submit_feedback(feedback: FeedbackInput):
    """Stores user like, dislike, or 1-5 rating feedback on recommended projects."""
    try:
        feedback_id = save_feedback(
            project_id=feedback.project_id,
            project_title=feedback.project_title or "",
            feedback_type=feedback.feedback_type,
            rating=feedback.rating,
            comment=feedback.comment or "",
            user_query=feedback.user_query or "",
        )
        return {
            "id": feedback_id,
            "status": "success",
            "message": f"Feedback ({feedback.feedback_type}) recorded successfully.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record feedback: {e}")


@app.get("/feedback")
def list_feedback(limit: int = Query(default=30, ge=1, le=100)):
    """Retrieves recent user feedback entries."""
    try:
        return get_feedback_list(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch feedback: {e}")


@app.get("/feedback/stats")
def feedback_stats():
    """Retrieves aggregate feedback metrics (likes, dislikes, average ratings)."""
    try:
        return get_feedback_statistics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute feedback stats: {e}")


@app.get("/evaluate")
def evaluate_models(
    k: int = Query(default=5, ge=1, le=10),
    sample_size: int = Query(default=50, ge=10, le=100)
):
    """Evaluates TF-IDF, Semantic Embeddings, and Hybrid approaches against the ground truth dataset."""
    try:
        metrics = evaluate_recommendation_models(k=k, sample_size=sample_size)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {e}")


# ==========================================
# Conversational Chatbot API Endpoints
# ==========================================

@app.get("/chat/status")
def chat_status():
    """Returns conversation storage backend and Gemini model info."""
    return {
        "status": "active",
        "storage_backend": get_storage_type(),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
    }


@app.post("/chat/conversations")
def api_create_conversation(req: NewConversationRequest):
    """Creates a new chat conversation with initial preferences."""
    try:
        conv = create_conversation(
            title=req.title or "New Conversation",
            initial_preferences=req.preferences
        )
        return conv
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create conversation: {e}")


@app.get("/chat/conversations")
def api_list_conversations(limit: int = Query(default=50, ge=1, le=100)):
    """Lists all stored chat conversations."""
    try:
        return get_conversations(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list conversations: {e}")


@app.get("/chat/conversations/{conv_id}")
def api_get_conversation(conv_id: str = FPath(...)):
    """Gets details for a specific conversation."""
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@app.delete("/chat/conversations/{conv_id}")
def api_delete_conversation(conv_id: str = FPath(...)):
    """Deletes a conversation and all its messages."""
    try:
        delete_conversation(conv_id)
        return {"status": "success", "message": f"Conversation {conv_id} deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete conversation: {e}")


@app.get("/chat/conversations/{conv_id}/messages")
def api_get_messages(conv_id: str = FPath(...), limit: int = Query(default=100, ge=1, le=200)):
    """Retrieves all message history for a conversation."""
    try:
        return get_messages(conv_id, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load messages: {e}")


@app.post("/chat/conversations/{conv_id}/messages")
def api_send_message(conv_id: str = FPath(...), req: ChatMessageRequest = ...):
    """
    Sends a message in a conversation.
    Invokes Gemini with Grounded RAG + ML Recommendation Engine.
    """
    try:
        conv = get_conversation(conv_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        result = process_chat_message(
            conversation_id=conv_id,
            user_message=req.content,
            override_preferences=req.preferences,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {e}")


@app.put("/chat/conversations/{conv_id}/preferences")
def api_update_preferences(conv_id: str = FPath(...), req: PreferencesUpdateRequest = ...):
    """Updates stored preferences for a conversation."""
    try:
        conv = get_conversation(conv_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        update_conversation_preferences(conv_id, req.preferences)
        return {"status": "success", "preferences": req.preferences}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update preferences: {e}")


@app.post("/chat/bookmarks")
def api_toggle_bookmark(req: BookmarkRequest):
    """Bookmarks or un-bookmarks a recommended project."""
    try:
        res = toggle_bookmark(
            conversation_id=req.conversation_id,
            project_id=req.project_id,
            project_title=req.project_title or "",
            project_domain=req.project_domain or "",
            project_difficulty=req.project_difficulty or "",
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle bookmark: {e}")


@app.get("/chat/bookmarks")
def api_get_bookmarks(conversation_id: Optional[str] = Query(default=None)):
    """Retrieves all bookmarked projects."""
    try:
        return get_bookmarks(conversation_id=conversation_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load bookmarks: {e}")
