import numpy as np
from typing import List, Dict, Any, Optional
from services.preprocessor import load_and_preprocess_dataset
from services.embedding_engine import compute_semantic_similarity
from services.tfidf_engine import compute_tfidf_similarity
from services.preference_matcher import compute_preference_scores

_cached_projects: Optional[List[Dict[str, Any]]] = None
_cached_metadata: Optional[Dict[str, Any]] = None


def get_dataset():
    """Returns preprocessed projects and metadata, cached in memory."""
    global _cached_projects, _cached_metadata
    if _cached_projects is None or _cached_metadata is None:
        _cached_projects, _cached_metadata = load_and_preprocess_dataset()
    return _cached_projects, _cached_metadata


def generate_recommendation_explanation(
    project: Dict[str, Any],
    breakdown: Dict[str, Any],
    semantic_score: float,
    tfidf_score: float,
    user_query: str,
    user_skills: List[str],
    user_domain: str,
) -> str:
    """Generates an intuitive, personalized explanation for why this project was recommended."""
    reasons = []

    matching_skills = breakdown.get("matching_skills", [])
    if matching_skills:
        reasons.append(f"Directly leverages your skills in {', '.join(matching_skills[:3])}")

    matching_techs = breakdown.get("matching_technologies", [])
    if matching_techs and not matching_skills:
        reasons.append(f"Uses technologies you prefer ({', '.join(matching_techs[:3])})")

    if breakdown.get("domain_match") and user_domain and user_domain.lower() not in ("any", "all"):
        reasons.append(f"Fits your selected domain of {project.get('domain')}")

    if breakdown.get("difficulty_match"):
        reasons.append(f"Targets your preferred {project.get('difficulty_level')} difficulty level")

    if semantic_score >= 0.55:
        reasons.append("High semantic alignment with your project requirements")
    elif tfidf_score >= 0.35:
        reasons.append("Strong technical keyword overlap with your idea description")

    if not reasons:
        reasons.append(f"Strong overall match for {project.get('domain')} ({project.get('difficulty_level')} level)")

    return " • ".join(reasons) + "."


def recommend_projects(
    query_text: str = "",
    title: str = "",
    user_skills: Optional[List[str]] = None,
    user_interests: Optional[List[str]] = None,
    preferred_domain: str = "Any",
    preferred_difficulty: str = "Any",
    preferred_technologies: Optional[List[str]] = None,
    top_k: int = 5,
    mode: str = "hybrid",  # "hybrid", "semantic_only", "tfidf_only"
    semantic_weight: float = 0.45,
    tfidf_weight: float = 0.30,
    preference_weight: float = 0.25,
) -> Dict[str, Any]:
    """
    Executes the Hybrid Recommendation Engine combining:
    1. Sentence Transformers Semantic Embedding Cosine Similarity
    2. TF-IDF Cosine Similarity for Content-based filtering
    3. User Preference Alignment Matching (Skills, Domain, Difficulty, Tech)
    """
    projects, metadata = get_dataset()
    user_skills = user_skills or []
    user_interests = user_interests or []
    preferred_technologies = preferred_technologies or []

    # Build rich query representation
    query_components = []
    if title.strip():
        query_components.append(f"Project Title: {title.strip()}.")
    if query_text.strip():
        query_components.append(f"Idea: {query_text.strip()}.")
    if preferred_domain and preferred_domain.lower() not in ("any", "all"):
        query_components.append(f"Domain: {preferred_domain}.")
    if user_interests:
        query_components.append(f"Interests: {', '.join(user_interests)}.")
    if user_skills:
        query_components.append(f"Skills: {', '.join(user_skills)}.")
    if preferred_technologies:
        query_components.append(f"Technologies: {', '.join(preferred_technologies)}.")

    full_query = " ".join(query_components).strip()
    if not full_query:
        full_query = "General computer science engineering project"

    # 1. Semantic Embedding Similarity
    semantic_scores = compute_semantic_similarity(full_query, projects)

    # 2. TF-IDF Similarity
    tfidf_scores = compute_tfidf_similarity(full_query, projects)

    # 3. Preference Alignment Scores
    preference_scores, breakdowns = compute_preference_scores(
        projects=projects,
        user_skills=user_skills,
        user_interests=user_interests,
        preferred_domain=preferred_domain,
        preferred_difficulty=preferred_difficulty,
        preferred_technologies=preferred_technologies,
    )

    # Combine scores based on mode
    if mode == "semantic_only":
        final_scores = semantic_scores
    elif mode == "tfidf_only":
        final_scores = tfidf_scores
    else:
        # Normalize weights
        total_w = semantic_weight + tfidf_weight + preference_weight
        if total_w <= 0:
            total_w = 1.0
        w_sem = semantic_weight / total_w
        w_tfidf = tfidf_weight / total_w
        w_pref = preference_weight / total_w

        final_scores = (
            w_sem * semantic_scores
            + w_tfidf * tfidf_scores
            + w_pref * preference_scores
        )

    # Rank projects descending by score
    k = min(max(1, top_k), len(projects))
    ranked_indices = np.argsort(final_scores)[::-1][:k]

    recommendations = []
    for rank, idx in enumerate(ranked_indices, start=1):
        proj = projects[idx]
        breakdown = breakdowns[idx]
        sem_score = float(semantic_scores[idx])
        tf_score = float(tfidf_scores[idx])
        pref_score = float(preference_scores[idx])
        combined_score = float(final_scores[idx])

        explanation = generate_recommendation_explanation(
            project=proj,
            breakdown=breakdown,
            semantic_score=sem_score,
            tfidf_score=tf_score,
            user_query=full_query,
            user_skills=user_skills,
            user_domain=preferred_domain,
        )

        recommendations.append({
            "rank": rank,
            "id": proj["id"],
            "title": proj["title"],
            "description": proj["description"],
            "domain": proj["domain"],
            "difficulty_level": proj["difficulty_level"],
            "technologies": proj["technologies"],
            "required_skills": proj["required_skills"],
            "key_features": proj.get("key_features", ""),
            "innovation_aspects": proj.get("innovation_aspects", ""),
            "target_users": proj.get("target_users", ""),
            "similarity_score": round(combined_score, 4),
            "semantic_score": round(sem_score, 4),
            "tfidf_score": round(tf_score, 4),
            "preference_score": round(pref_score, 4),
            "match_breakdown": breakdown,
            "recommendation_explanation": explanation,
        })

    return {
        "mode": mode,
        "weights": {
            "semantic": semantic_weight,
            "tfidf": tfidf_weight,
            "preference": preference_weight,
        },
        "query_summary": {
            "title": title,
            "user_query": query_text,
            "domain": preferred_domain,
            "difficulty": preferred_difficulty,
            "skills": user_skills,
            "technologies": preferred_technologies,
        },
        "top_k": k,
        "recommendations": recommendations,
    }
