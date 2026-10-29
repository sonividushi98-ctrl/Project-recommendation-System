
import csv
from pathlib import Path

from sentence_transformers import SentenceTransformer, util

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = (
    PROJECT_ROOT / "data" / "raw" / "projectiq_synthetic_projects.csv"
)

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_model = None
_projects = None
_project_embeddings = None


def load_model():
    global _model

    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)

    return _model


def split_values(value):
    """Convert semicolon-separated CSV values into a list."""
    if not value:
        return []

    return [
        item.strip()
        for item in value.split(";")
        if item.strip()
    ]


def load_projects():
    global _projects

    if _projects is None:
        if not DATASET_PATH.exists():
            raise FileNotFoundError(
                f"Project dataset not found: {DATASET_PATH}"
            )

        with open(
            DATASET_PATH,
            "r",
            encoding="utf-8-sig",
            newline=""
        ) as file:
            reader = csv.DictReader(file)
            projects = []

            for row in reader:
                title = (
                    row.get("project_title")
                    or row.get("project_id")
                    or "Untitled project"
                )

                description = (
                    row.get("full_project_description")
                    or row.get("project_abstract")
                    or row.get("problem_statement")
                    or ""
                )

                project = {
                    "id": row.get("project_id", ""),
                    "title": title.strip(),
                    "description": description.strip(),
                    "domain": row.get("primary_domain", ""),
                    "technologies": split_values(
                        row.get("technologies", "")
                    ),
                    "difficulty_level": row.get(
                        "difficulty_level", ""
                    ),
                    "project_type": row.get("project_type", ""),
                    "subject_area": row.get("subject_area", ""),
                    "key_features": row.get("key_features", ""),
                    "innovation_aspects": row.get(
                        "innovation_aspects", ""
                    ),
                    "project_tags": split_values(
                        row.get("project_tags", "")
                    ),
                }

                if project["title"] and project["description"]:
                    projects.append(project)

        if not projects:
            raise ValueError(
                "No usable projects found in the CSV dataset."
            )

        _projects = projects

    return _projects


def project_text(project):
    technologies = ", ".join(project["technologies"])

    return (
        f"Title: {project['title']}. "
        f"Description: {project['description']}. "
        f"Domain: {project['domain']}. "
        f"Subject area: {project['subject_area']}. "
        f"Technologies: {technologies}. "
        f"Features: {project['key_features']}. "
        f"Innovation: {project['innovation_aspects']}. "
        f"Tags: {', '.join(project['project_tags'])}."
    )


def get_project_embeddings():
    global _project_embeddings

    if _project_embeddings is None:
        model = load_model()
        projects = load_projects()

        texts = [project_text(project) for project in projects]

        _project_embeddings = model.encode(
            texts,
            convert_to_tensor=True,
            normalize_embeddings=True,
            show_progress_bar=True,
        )

    return _project_embeddings


def search_similar_projects(query, top_k=3):
    query = query.strip()

    if len(query) < 10:
        raise ValueError(
            "Please provide a project idea of at least 10 characters."
        )

    projects = load_projects()
    model = load_model()
    embeddings = get_project_embeddings()

    query_embedding = model.encode(
        query,
        convert_to_tensor=True,
        normalize_embeddings=True,
    )

    scores = util.cos_sim(query_embedding, embeddings)[0]

    count = min(max(1, top_k), len(projects))
    indices = scores.argsort(descending=True)[:count]

    results = []

    for index in indices:
        project = projects[int(index)]

        results.append({
            "id": project["id"],
            "title": project["title"],
            "description": project["description"],
            "domain": project["domain"],
            "technologies": project["technologies"],
            "difficulty_level": project["difficulty_level"],
            "project_type": project["project_type"],
            "similarity": round(float(scores[index]), 4),
        })

    return results
