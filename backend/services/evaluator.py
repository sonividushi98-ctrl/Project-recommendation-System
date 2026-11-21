import csv
from pathlib import Path
from typing import Dict, Any, List, Set
import numpy as np

from services.preprocessor import split_and_normalize_list, clean_text
from services.hybrid_recommender import get_dataset, recommend_projects

PROJECT_ROOT = Path(__file__).resolve().parents[2]
GROUND_TRUTH_PATH = PROJECT_ROOT / "data" / "raw" / "projectiq_similarity_ground_truth.csv"
STUDENT_IDEAS_PATH = PROJECT_ROOT / "data" / "raw" / "projectiq_student_ideas.csv"

_evaluation_cache: Dict[int, Dict[str, Any]] = {}


def load_ground_truth() -> Dict[str, Set[str]]:
    """
    Loads labeled ground truth mapping: idea_id -> set of relevant project_ids.
    Only pairs with conceptual_similarity_label == 1 are considered relevant.
    """
    if not GROUND_TRUTH_PATH.exists():
        raise FileNotFoundError(f"Ground truth dataset not found: {GROUND_TRUTH_PATH}")

    ground_truth: Dict[str, Set[str]] = {}
    with open(GROUND_TRUTH_PATH, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            idea_id = row.get("idea_id", "").strip()
            project_id = row.get("project_id", "").strip()
            label = row.get("conceptual_similarity_label", "0").strip()

            if label == "1" and idea_id and project_id:
                ground_truth.setdefault(idea_id, set()).add(project_id)

    return ground_truth


def load_evaluation_ideas() -> List[Dict[str, Any]]:
    """Loads student idea evaluation queries with text, skills, domain, and difficulty."""
    if not STUDENT_IDEAS_PATH.exists():
        raise FileNotFoundError(f"Student ideas dataset not found: {STUDENT_IDEAS_PATH}")

    ideas = []
    with open(STUDENT_IDEAS_PATH, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            idea_id = row.get("idea_id", "").strip()
            if not idea_id:
                continue

            ideas.append({
                "idea_id": idea_id,
                "title": clean_text(row.get("idea_title", "")),
                "description": clean_text(row.get("idea_description", "")),
                "domain": clean_text(row.get("primary_domain", "")),
                "skills": split_and_normalize_list(row.get("student_skills", "")),
                "interests": split_and_normalize_list(row.get("student_interests", "")),
                "difficulty": clean_text(row.get("preferred_difficulty", "Any")),
            })

    return ideas


def calculate_metrics_at_k(
    retrieved_ids: List[str],
    relevant_ids: Set[str],
    k: int
) -> Dict[str, float]:
    """Calculates Precision@K, Recall@K, and F1@K for a single query."""
    top_k_retrieved = retrieved_ids[:k]
    hits = sum(1 for pid in top_k_retrieved if pid in relevant_ids)

    precision = hits / k if k > 0 else 0.0
    recall = hits / len(relevant_ids) if len(relevant_ids) > 0 else 0.0

    if (precision + recall) > 0:
        f1 = (2 * precision * recall) / (precision + recall)
    else:
        f1 = 0.0

    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "hits": hits,
    }


def evaluate_recommendation_models(k: int = 5, sample_size: int = 50) -> Dict[str, Any]:
    """
    Evaluates TF-IDF, Semantic Embeddings (Sentence Transformers), and Hybrid recommenders
    against the labeled ground truth dataset.

    Returns authentic metrics:
    - Precision@K
    - Recall@K
    - F1-Score@K
    - Model comparison summary
    """
    cache_key = (k, sample_size)
    if cache_key in _evaluation_cache:
        return _evaluation_cache[cache_key]

    ground_truth = load_ground_truth()
    all_ideas = load_evaluation_ideas()

    # Filter ideas that have ground-truth relevant items
    eval_queries = [idea for idea in all_ideas if idea["idea_id"] in ground_truth]

    if sample_size and sample_size < len(eval_queries):
        eval_queries = eval_queries[:sample_size]

    modes = ["tfidf_only", "semantic_only", "hybrid"]
    results = {mode: {"precision": [], "recall": [], "f1": [], "hits": 0} for mode in modes}

    total_eval_queries = len(eval_queries)

    for item in eval_queries:
        idea_id = item["idea_id"]
        relevant = ground_truth[idea_id]

        for mode in modes:
            rec_res = recommend_projects(
                query_text=item["description"],
                title=item["title"],
                user_skills=item["skills"],
                user_interests=item["interests"],
                preferred_domain=item["domain"],
                preferred_difficulty=item["difficulty"],
                top_k=k,
                mode=mode,
            )
            retrieved = [p["id"] for p in rec_res["recommendations"]]
            m = calculate_metrics_at_k(retrieved, relevant, k)

            results[mode]["precision"].append(m["precision"])
            results[mode]["recall"].append(m["recall"])
            results[mode]["f1"].append(m["f1"])
            results[mode]["hits"] += m["hits"]

    # Compute macro-averages
    summary = {}
    for mode in modes:
        p_avg = float(np.mean(results[mode]["precision"])) if results[mode]["precision"] else 0.0
        r_avg = float(np.mean(results[mode]["recall"])) if results[mode]["recall"] else 0.0
        f1_avg = float(np.mean(results[mode]["f1"])) if results[mode]["f1"] else 0.0

        label_map = {
            "tfidf_only": "TF-IDF (Content-Based)",
            "semantic_only": "Sentence Transformers (Semantic)",
            "hybrid": "Hybrid Engine (TF-IDF + Semantic + Preferences)",
        }

        summary[mode] = {
            "model_name": label_map.get(mode, mode),
            "precision_at_k": round(p_avg, 4),
            "recall_at_k": round(r_avg, 4),
            "f1_score": round(f1_avg, 4),
            "total_hits": results[mode]["hits"],
        }

    evaluation_report = {
        "k": k,
        "evaluated_queries_count": total_eval_queries,
        "ground_truth_pairs_count": sum(len(ground_truth[idea["idea_id"]]) for idea in eval_queries),
        "dataset_source": "projectiq_similarity_ground_truth.csv",
        "models_evaluated": summary,
        "methodology": {
            "evaluation_metric": f"Macro-averaged Precision@{k}, Recall@{k}, and F1@{k}",
            "note": "Metrics are computed directly from the synthetic project ground-truth relevance annotations without simulated or hardcoded values."
        }
    }

    _evaluation_cache[cache_key] = evaluation_report
    return evaluation_report
