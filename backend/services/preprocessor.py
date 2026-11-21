import re
import csv
from pathlib import Path
from typing import List, Dict, Any, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_RAW_PATH = PROJECT_ROOT / "data" / "raw" / "projectiq_synthetic_projects.csv"
DATA_ROOT_PATH = PROJECT_ROOT / "data.csv"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

# Known technology and skill aliases for normalization
TECH_ALIASES = {
    "react.js": "react",
    "reactjs": "react",
    "node.js": "nodejs",
    "vue.js": "vue",
    "scikit learn": "scikit-learn",
    "sklearn": "scikit-learn",
    "tf": "tensorflow",
    "py": "python",
    "js": "javascript",
    "ts": "typescript",
    "postgres": "postgresql",
    "mongo": "mongodb",
    "k8s": "kubernetes",
    "cv": "computer vision",
    "nlp": "natural language processing",
    "ml": "machine learning",
    "dl": "deep learning",
}


def clean_text(text: str) -> str:
    """Clean and normalize a text string."""
    if not text or not isinstance(text, str):
        return ""
    text = text.strip()
    # Normalize excessive whitespace
    text = re.sub(r"\s+", " ", text)
    return text


def split_and_normalize_list(value: Any, delimiter: str = ";") -> List[str]:
    """Split delimited values and normalize individual items."""
    if not value:
        return []
    if isinstance(value, list):
        items = value
    elif isinstance(value, str):
        items = [x.strip() for x in re.split(r"[;,|]", value) if x.strip()]
    else:
        return []

    cleaned = []
    seen = set()
    for item in items:
        norm = normalize_token(item)
        if norm and norm.lower() not in seen:
            seen.add(norm.lower())
            cleaned.append(norm)
    return cleaned


def normalize_token(token: str) -> str:
    """Normalize a single skill/technology token."""
    token = token.strip()
    lower = token.lower()
    return TECH_ALIASES.get(lower, token)


def get_dataset_path() -> Path:
    """Resolve the dataset file path checking root data.csv and data/raw."""
    if DATA_ROOT_PATH.exists() and DATA_ROOT_PATH.stat().st_size > 500:
        return DATA_ROOT_PATH
    if DATA_RAW_PATH.exists():
        return DATA_RAW_PATH
    if DATA_ROOT_PATH.exists():
        return DATA_ROOT_PATH
    raise FileNotFoundError("Could not find project dataset at data.csv or data/raw/projectiq_synthetic_projects.csv")


def load_and_preprocess_dataset() -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Loads, cleans, validates, deduplicates, and normalizes the project dataset.
    Returns:
        (preprocessed_projects, metadata_catalog)
    """
    dataset_path = get_dataset_path()
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    projects: List[Dict[str, Any]] = []
    seen_ids = set()

    all_domains = set()
    all_skills = set()
    all_technologies = set()
    all_difficulties = {"Beginner", "Intermediate", "Advanced"}

    with open(dataset_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            project_id = clean_text(row.get("project_id", "")).strip()
            if not project_id or project_id in seen_ids:
                continue

            title = clean_text(row.get("project_title", "") or f"Project {project_id}")
            abstract = clean_text(row.get("project_abstract", ""))
            problem = clean_text(row.get("problem_statement", ""))
            solution = clean_text(row.get("proposed_solution", ""))
            full_desc = clean_text(row.get("full_project_description", ""))

            # Primary description fallback
            description = full_desc or abstract or problem or solution or "No description provided."

            domain = clean_text(row.get("primary_domain", "General"))
            if domain:
                all_domains.add(domain)

            difficulty = clean_text(row.get("difficulty_level", "Intermediate")).capitalize()
            if difficulty not in all_difficulties:
                difficulty = "Intermediate"

            # Parse list fields
            techs = split_and_normalize_list(row.get("technologies", ""))
            req_skills = split_and_normalize_list(row.get("required_skills", ""))
            prog_langs = split_and_normalize_list(row.get("programming_languages", ""))
            frameworks = split_and_normalize_list(row.get("frameworks_and_libraries", ""))
            db_techs = split_and_normalize_list(row.get("database_technologies", ""))
            ai_methods = split_and_normalize_list(row.get("ai_ml_methods", ""))
            tags = split_and_normalize_list(row.get("project_tags", ""))

            for t in techs + prog_langs + frameworks + db_techs:
                if t:
                    all_technologies.add(t)
            for s in req_skills:
                if s:
                    all_skills.add(s)

            key_features = clean_text(row.get("key_features", ""))
            innovation = clean_text(row.get("innovation_aspects", ""))
            subject_area = clean_text(row.get("subject_area", ""))
            project_type = clean_text(row.get("project_type", "Standard"))
            target_users = clean_text(row.get("target_users", ""))
            expected_outcomes = clean_text(row.get("expected_outcomes", ""))

            # Rich unified textual representation for NLP / TF-IDF / Semantic Embeddings
            combined_parts = [
                f"Title: {title}.",
                f"Domain: {domain}.",
                f"Subject: {subject_area}.",
                f"Difficulty: {difficulty}.",
                f"Problem: {problem}.",
                f"Solution: {solution}.",
                f"Description: {description}.",
                f"Key Features: {key_features}.",
                f"Innovation: {innovation}.",
                f"Technologies: {', '.join(techs)}.",
                f"Skills: {', '.join(req_skills)}.",
                f"AI Methods: {', '.join(ai_methods)}.",
                f"Tags: {', '.join(tags)}.",
                f"Target Users: {target_users}.",
            ]
            combined_text = " ".join([p for p in combined_parts if p.strip()])

            project_record = {
                "id": project_id,
                "project_id": project_id,
                "title": title,
                "description": description,
                "domain": domain,
                "difficulty_level": difficulty,
                "subject_area": subject_area,
                "project_type": project_type,
                "technologies": techs,
                "required_skills": req_skills,
                "programming_languages": prog_langs,
                "frameworks_and_libraries": frameworks,
                "database_technologies": db_techs,
                "ai_ml_methods": ai_methods,
                "key_features": key_features,
                "innovation_aspects": innovation,
                "target_users": target_users,
                "expected_outcomes": expected_outcomes,
                "project_tags": tags,
                "combined_text": combined_text,
            }

            projects.append(project_record)
            seen_ids.add(project_id)

    metadata_catalog = {
        "total_projects": len(projects),
        "domains": sorted(list(all_domains)),
        "difficulties": ["Beginner", "Intermediate", "Advanced"],
        "popular_skills": sorted(list(all_skills))[:50],
        "popular_technologies": sorted(list(all_technologies))[:50],
    }

    return projects, metadata_catalog
