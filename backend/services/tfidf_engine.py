import numpy as np
from typing import List, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

_vectorizer: Optional[TfidfVectorizer] = None
_tfidf_matrix = None
_fitted_project_ids = None


def fit_or_get_tfidf(projects: List[dict], force_refit: bool = False):
    """
    Fits or retrieves the cached TF-IDF vectorizer and project matrix.
    Uses unigrams and bigrams with sublinear TF scaling.
    """
    global _vectorizer, _tfidf_matrix, _fitted_project_ids

    current_ids = [p["id"] for p in projects]

    if (
        not force_refit
        and _vectorizer is not None
        and _tfidf_matrix is not None
        and _fitted_project_ids == current_ids
    ):
        return _vectorizer, _tfidf_matrix

    corpus = [p.get("combined_text") or p.get("description", "") for p in projects]
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        stop_words="english",
        sublinear_tf=True,
        max_features=10000,
        token_pattern=r"(?u)\b[a-zA-Z0-9_\-\.]{2,}\b"
    )
    matrix = vectorizer.fit_transform(corpus)

    _vectorizer = vectorizer
    _tfidf_matrix = matrix
    _fitted_project_ids = current_ids

    return _vectorizer, _tfidf_matrix


def compute_tfidf_similarity(query_text: str, projects: List[dict]) -> np.ndarray:
    """
    Computes TF-IDF cosine similarity between query text and all projects.
    Returns 1D numpy array in range [0, 1].
    """
    if not query_text or not query_text.strip():
        return np.zeros(len(projects), dtype=np.float32)

    vectorizer, matrix = fit_or_get_tfidf(projects)
    query_vec = vectorizer.transform([query_text.strip()])
    similarities = cosine_similarity(query_vec, matrix)[0]
    return np.clip(similarities, 0.0, 1.0)
