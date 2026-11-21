"""
Semantic Search Service (preserves backward compatibility with legacy endpoints)
"""
from typing import List, Dict, Any
from services.hybrid_recommender import get_dataset
from services.embedding_engine import compute_semantic_similarity, get_model


def load_model():
    return get_model()


def load_projects():
    projects, _ = get_dataset()
    return projects


def search_similar_projects(query: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """
    Finds top_k similar projects using Sentence Transformer embeddings.
    Keeps full backward compatibility with existing ProjectIQ /analyze endpoint.
    """
    query = (query or "").strip()
    if len(query) < 10:
        raise ValueError("Please provide a project idea of at least 10 characters.")

    projects, _ = get_dataset()
    scores = compute_semantic_similarity(query, projects)

    count = min(max(1, top_k), len(projects))
    import numpy as np
    indices = np.argsort(scores)[::-1][:count]

    results = []
    for idx in indices:
        p = projects[int(idx)]
        results.append({
            "id": p["id"],
            "title": p["title"],
            "description": p["description"],
            "domain": p.get("domain", ""),
            "technologies": p.get("technologies", []),
            "difficulty_level": p.get("difficulty_level", ""),
            "project_type": p.get("project_type", ""),
            "similarity": round(float(scores[idx]), 4),
        })

    return results
