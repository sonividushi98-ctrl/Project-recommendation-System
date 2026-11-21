import numpy as np
from pathlib import Path
from typing import List, Optional
import os

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = PROJECT_ROOT / "data" / "processed"
EMBEDDINGS_CACHE_PATH = CACHE_DIR / "project_embeddings.npy"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_model = None
_project_embeddings = None
_embedded_project_ids = None


def get_model():
    """Lazy load SentenceTransformer model singleton."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def build_or_load_project_embeddings(projects: List[dict], force_recompute: bool = False) -> np.ndarray:
    """
    Computes or loads cached semantic embeddings for all projects.
    Uses sentence-transformers/all-MiniLM-L6-v2.
    """
    global _project_embeddings, _embedded_project_ids

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    current_ids = [p["id"] for p in projects]

    # Check if in-memory cache is valid
    if (
        not force_recompute
        and _project_embeddings is not None
        and _embedded_project_ids == current_ids
    ):
        return _project_embeddings

    # Check if disk cache is valid
    if (
        not force_recompute
        and EMBEDDINGS_CACHE_PATH.exists()
    ):
        try:
            cached = np.load(EMBEDDINGS_CACHE_PATH)
            if cached.shape[0] == len(projects) and cached.shape[1] == 384:
                _project_embeddings = cached
                _embedded_project_ids = current_ids
                return _project_embeddings
        except Exception:
            pass  # Fall back to recomputing if corrupt

    # Compute embeddings
    model = get_model()
    texts = [p.get("combined_text") or p.get("description", "") for p in projects]
    embeddings = model.encode(
        texts,
        batch_size=32,
        show_progress_bar=False,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    # Save to disk cache
    try:
        np.save(EMBEDDINGS_CACHE_PATH, embeddings)
    except Exception as e:
        print(f"Warning: could not save embeddings cache: {e}")

    _project_embeddings = embeddings
    _embedded_project_ids = current_ids
    return _project_embeddings


def compute_semantic_similarity(query_text: str, projects: List[dict]) -> np.ndarray:
    """
    Encodes the query text and computes cosine similarity with all project embeddings.
    Returns 1D numpy array of cosine similarities in range [0, 1].
    """
    if not query_text or not query_text.strip():
        return np.zeros(len(projects), dtype=np.float32)

    model = get_model()
    project_embeddings = build_or_load_project_embeddings(projects)

    query_embedding = model.encode(
        query_text.strip(),
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    # Cosine similarity for normalized vectors is just dot product
    similarities = np.dot(project_embeddings, query_embedding)
    # Clip to [0, 1] range
    similarities = np.clip(similarities, 0.0, 1.0)
    return similarities
