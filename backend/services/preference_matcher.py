import numpy as np
from typing import List, Dict, Any, Tuple
from services.preprocessor import normalize_token


DIFFICULTY_RANK = {
    "beginner": 1,
    "intermediate": 2,
    "advanced": 3,
}


def compute_difficulty_score(preferred_diff: str, project_diff: str) -> float:
    """Computes alignment score between user's preferred difficulty and project difficulty."""
    pref = (preferred_diff or "").strip().lower()
    proj = (project_diff or "").strip().lower()

    if not pref or pref == "any" or pref == "all":
        return 1.0

    if pref == proj:
        return 1.0

    # Adjacent levels get partial score (0.6), distant levels get 0.2
    rank_pref = DIFFICULTY_RANK.get(pref, 2)
    rank_proj = DIFFICULTY_RANK.get(proj, 2)
    diff = abs(rank_pref - rank_proj)

    if diff == 1:
        return 0.6
    return 0.2


def compute_domain_score(preferred_domain: str, project: Dict[str, Any]) -> float:
    """Computes domain match score."""
    pref = (preferred_domain or "").strip().lower()
    if not pref or pref == "any" or pref == "all":
        return 1.0

    proj_domain = project.get("domain", "").lower()
    proj_subject = project.get("subject_area", "").lower()

    if pref == proj_domain:
        return 1.0
    if pref in proj_domain or proj_domain in pref:
        return 0.85
    if pref in proj_subject or proj_subject in pref:
        return 0.70

    # Check keyword overlap in domain
    pref_words = set(pref.replace("&", " ").replace("/", " ").split())
    domain_words = set(proj_domain.replace("&", " ").replace("/", " ").split())
    overlap = pref_words.intersection(domain_words)
    if overlap:
        return min(0.6, len(overlap) / max(len(pref_words), 1))

    return 0.1


def compute_set_overlap_score(user_items: List[str], project_items: List[str]) -> Tuple[float, List[str]]:
    """
    Computes overlap score between user item list and project item list.
    Returns (score, list_of_matching_items).
    """
    if not user_items:
        return 0.5, []

    user_norm = {normalize_token(x).lower(): x for x in user_items if x and x.strip()}
    if not user_norm:
        return 0.5, []

    project_norm = {normalize_token(x).lower(): x for x in project_items if x and x.strip()}

    matched = []
    for k, original_user_val in user_norm.items():
        if k in project_norm:
            matched.append(original_user_val)
        else:
            # Substring match (e.g. "python" in "python programming")
            for pk in project_norm:
                if k in pk or pk in k:
                    matched.append(original_user_val)
                    break

    # Jaccard-like or recall score
    score = len(matched) / len(user_norm)
    return float(np.clip(score, 0.0, 1.0)), matched


def compute_preference_scores(
    projects: List[Dict[str, Any]],
    user_skills: List[str],
    user_interests: List[str],
    preferred_domain: str,
    preferred_difficulty: str,
    preferred_technologies: List[str],
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Computes structured preference alignment scores for all projects.
    Returns:
        (preference_scores_array, list_of_match_breakdowns)
    """
    n = len(projects)
    scores = np.zeros(n, dtype=np.float32)
    breakdowns = []

    has_skills = bool(user_skills)
    has_techs = bool(preferred_technologies)
    has_domain = bool(preferred_domain and preferred_domain.lower() not in ("any", "all"))
    has_diff = bool(preferred_difficulty and preferred_difficulty.lower() not in ("any", "all"))
    has_interests = bool(user_interests)

    # Determine dynamic component weights based on what user specified
    total_active = (
        (1.5 if has_skills else 0)
        + (1.2 if has_techs else 0)
        + (1.2 if has_domain else 0)
        + (0.8 if has_diff else 0)
        + (1.0 if has_interests else 0)
    )

    if total_active == 0:
        # User specified no structured preferences
        return np.ones(n, dtype=np.float32) * 0.5, [{"matching_skills": [], "matching_technologies": [], "domain_match": True, "difficulty_match": True} for _ in projects]

    for i, project in enumerate(projects):
        # 1. Skills match
        proj_skills = project.get("required_skills", []) + project.get("technologies", [])
        skill_score, matched_skills = compute_set_overlap_score(user_skills, proj_skills)

        # 2. Technologies match
        proj_techs = (
            project.get("technologies", [])
            + project.get("programming_languages", [])
            + project.get("frameworks_and_libraries", [])
            + project.get("database_technologies", [])
        )
        tech_score, matched_techs = compute_set_overlap_score(preferred_technologies, proj_techs)

        # 3. Domain match
        domain_score = compute_domain_score(preferred_domain, project)

        # 4. Difficulty match
        diff_score = compute_difficulty_score(preferred_difficulty, project.get("difficulty_level", ""))

        # 5. Interests match
        proj_interest_pool = (
            [project.get("domain", "")]
            + project.get("project_tags", [])
            + [project.get("subject_area", "")]
            + [project.get("key_features", "")]
            + [project.get("innovation_aspects", "")]
        )
        interest_score, matched_interests = compute_set_overlap_score(user_interests, proj_interest_pool)

        # Weighted combination
        weighted_sum = (
            (skill_score * 1.5 if has_skills else 0)
            + (tech_score * 1.2 if has_techs else 0)
            + (domain_score * 1.2 if has_domain else 0)
            + (diff_score * 0.8 if has_diff else 0)
            + (interest_score * 1.0 if has_interests else 0)
        )
        final_pref_score = float(weighted_sum / total_active)
        scores[i] = final_pref_score

        breakdowns.append({
            "skill_score": round(skill_score, 3),
            "tech_score": round(tech_score, 3),
            "domain_score": round(domain_score, 3),
            "difficulty_score": round(diff_score, 3),
            "interest_score": round(interest_score, 3),
            "matching_skills": matched_skills,
            "matching_technologies": matched_techs,
            "matching_interests": matched_interests,
            "domain_match": domain_score >= 0.7,
            "difficulty_match": diff_score >= 0.8,
        })

    return scores, breakdowns
