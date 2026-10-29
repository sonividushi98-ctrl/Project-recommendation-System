#!/usr/bin/env python3
"""
validate_dataset.py — structural & referential-integrity checks for the ProjectIQ
synthetic dataset bundle.

Usage:
    python3 validate_dataset.py [directory]

If no directory is given, the script looks for the five CSVs in the current directory.
Exits with code 0 if all checks pass, 1 otherwise. Prints a report either way.
"""
import sys
import os
import pandas as pd

ERRORS = []
WARNINGS = []


def err(msg):
    ERRORS.append(msg)


def warn(msg):
    WARNINGS.append(msg)


def load_csv(path, name):
    if not os.path.exists(path):
        err(f"[{name}] File not found: {path}")
        return None
    try:
        df = pd.read_csv(path, dtype=str, keep_default_na=False)
    except Exception as e:
        err(f"[{name}] Failed to parse as CSV: {e}")
        return None
    return df


REQUIRED_COLUMNS = {
    "projectiq_synthetic_projects.csv": [
        "project_id", "project_title", "project_abstract", "problem_statement", "proposed_solution",
        "primary_domain", "secondary_domains", "subject_area", "academic_year", "project_type",
        "difficulty_level", "estimated_development_time_months", "recommended_team_size",
        "required_skills", "technologies", "programming_languages", "frameworks_and_libraries",
        "database_technologies", "ai_ml_methods", "key_features", "system_architecture",
        "dataset_or_data_source", "existing_approach", "limitations", "future_scope",
        "innovation_aspects", "target_users", "expected_outcomes", "project_tags",
        "full_project_description",
    ],
    "projectiq_family_mapping.csv": [
        "project_id", "family_id", "family_name", "relationship_to_family", "conceptual_overlap_level",
    ],
    "projectiq_student_ideas.csv": [
        "idea_id", "idea_title", "idea_description", "primary_domain", "subject_area", "student_skills",
        "student_interests", "team_size", "available_development_time_months", "preferred_difficulty",
        "expected_features", "known_constraints", "intended_users", "expected_project_outcome",
    ],
    "projectiq_similarity_ground_truth.csv": [
        "pair_id", "idea_id", "project_id", "conceptual_similarity_label", "overlap_level",
        "shared_concepts", "shared_technologies", "key_differences", "explanation",
    ],
    "projectiq_innovation_evaluation.csv": [
        "evaluation_id", "idea_id", "related_project_ids", "existing_capabilities", "overlapping_concepts",
        "missing_or_underexplored_capabilities", "proposed_new_direction", "innovation_rationale",
        "potential_implementation_features", "feasibility_level", "estimated_development_time_months",
        "expected_new_contribution", "novelty_assessment",
    ],
}

MIN_ROWS = {
    "projectiq_synthetic_projects.csv": 300,
    "projectiq_family_mapping.csv": 300,
    "projectiq_student_ideas.csv": 100,
    "projectiq_similarity_ground_truth.csv": 1000,
    "projectiq_innovation_evaluation.csv": 200,
}

ID_COLUMNS = {
    "projectiq_synthetic_projects.csv": "project_id",
    "projectiq_student_ideas.csv": "idea_id",
    "projectiq_similarity_ground_truth.csv": "pair_id",
    "projectiq_innovation_evaluation.csv": "evaluation_id",
}


def check_columns_and_rows(name, df):
    if df is None:
        return
    missing = [c for c in REQUIRED_COLUMNS[name] if c not in df.columns]
    if missing:
        err(f"[{name}] Missing required columns: {missing}")
    extra = [c for c in df.columns if c not in REQUIRED_COLUMNS[name]]
    if extra:
        warn(f"[{name}] Unexpected extra columns: {extra}")
    min_rows = MIN_ROWS[name]
    if len(df) < min_rows:
        err(f"[{name}] Expected at least {min_rows} rows, found {len(df)}")
    else:
        print(f"[{name}] OK: {len(df)} rows (>= {min_rows} required)")


def check_unique_ids(name, df):
    if df is None or name not in ID_COLUMNS:
        return
    col = ID_COLUMNS[name]
    if col not in df.columns:
        return
    dup = df[col].duplicated().sum()
    if dup:
        err(f"[{name}] {dup} duplicate values in '{col}'")
    empty = (df[col].astype(str).str.strip() == "").sum()
    if empty:
        err(f"[{name}] {empty} empty values in '{col}'")


def check_missing_values(name, df):
    if df is None:
        return
    empty_mask = (df.astype(str).apply(lambda s: s.str.strip()) == "")
    total_empty = int(empty_mask.sum().sum())
    if total_empty:
        cols_with_empty = empty_mask.sum()
        cols_with_empty = cols_with_empty[cols_with_empty > 0]
        err(f"[{name}] {total_empty} empty-string cells across columns: {dict(cols_with_empty)}")
    nulls = int(df.isnull().sum().sum())
    if nulls:
        err(f"[{name}] {nulls} NaN/null cells")


def check_labels(df_pairs):
    if df_pairs is None:
        return
    bad_labels = df_pairs[~df_pairs["conceptual_similarity_label"].isin(["0", "1"])]
    if len(bad_labels):
        err(f"[pairs] {len(bad_labels)} rows with invalid conceptual_similarity_label (must be 0 or 1)")
    bad_overlap = df_pairs[~df_pairs["overlap_level"].isin(["High", "Medium", "Low"])]
    if len(bad_overlap):
        err(f"[pairs] {len(bad_overlap)} rows with invalid overlap_level (must be High/Medium/Low)")
    # sanity: High overlap should mostly be label 1, Low mostly label 0
    high_label0 = len(df_pairs[(df_pairs["overlap_level"] == "High") & (df_pairs["conceptual_similarity_label"] == "0")])
    low_label1 = len(df_pairs[(df_pairs["overlap_level"] == "Low") & (df_pairs["conceptual_similarity_label"] == "1")])
    if high_label0:
        warn(f"[pairs] {high_label0} High-overlap rows labeled 0 (unusual, but not necessarily invalid)")
    if low_label1 > 0.15 * len(df_pairs):
        warn(f"[pairs] {low_label1} Low-overlap rows labeled 1 — check this is intentional (weak-match positives)")


def check_family_mapping(df_family):
    if df_family is None:
        return
    bad_overlap = df_family[~df_family["conceptual_overlap_level"].isin(["High", "Medium", "Low"])]
    if len(bad_overlap):
        err(f"[family_mapping] {len(bad_overlap)} rows with invalid conceptual_overlap_level")
    n_families = df_family["family_id"].nunique()
    print(f"[family_mapping] {n_families} unique families across {len(df_family)} projects")


def check_foreign_keys(df_projects, df_family, df_ideas, df_pairs, df_innov):
    if df_projects is None:
        return
    valid_pids = set(df_projects["project_id"])
    valid_iids = set(df_ideas["idea_id"]) if df_ideas is not None else set()

    if df_family is not None:
        bad = (~df_family["project_id"].isin(valid_pids)).sum()
        if bad:
            err(f"[family_mapping] {bad} rows reference an unknown project_id")

    if df_pairs is not None:
        bad_p = (~df_pairs["project_id"].isin(valid_pids)).sum()
        bad_i = (~df_pairs["idea_id"].isin(valid_iids)).sum()
        if bad_p:
            err(f"[similarity_ground_truth] {bad_p} rows reference an unknown project_id")
        if bad_i:
            err(f"[similarity_ground_truth] {bad_i} rows reference an unknown idea_id")
        dup_pairs = df_pairs.duplicated(subset=["idea_id", "project_id"]).sum()
        if dup_pairs:
            warn(f"[similarity_ground_truth] {dup_pairs} duplicate (idea_id, project_id) pairs")

    if df_innov is not None:
        bad_i = (~df_innov["idea_id"].isin(valid_iids)).sum()
        if bad_i:
            err(f"[innovation_evaluation] {bad_i} rows reference an unknown idea_id")
        bad_rel = 0
        for ids in df_innov["related_project_ids"]:
            for pid in str(ids).split(";"):
                pid = pid.strip()
                if pid and pid != "Not Applicable" and pid not in valid_pids:
                    bad_rel += 1
        if bad_rel:
            err(f"[innovation_evaluation] {bad_rel} related_project_ids values reference unknown project_ids")


def check_numeric_ranges(df_projects, df_ideas):
    if df_projects is not None:
        months = pd.to_numeric(df_projects["estimated_development_time_months"], errors="coerce")
        if months.isnull().any() or (months < 1).any() or (months > 6).any():
            err("[projects] estimated_development_time_months out of [1,6] range or non-numeric")
        team = pd.to_numeric(df_projects["recommended_team_size"], errors="coerce")
        if team.isnull().any() or (team < 1).any() or (team > 5).any():
            err("[projects] recommended_team_size out of [1,5] range or non-numeric")
        year = pd.to_numeric(df_projects["academic_year"], errors="coerce")
        if year.isnull().any() or (year < 2022).any() or (year > 2026).any():
            err("[projects] academic_year out of [2022,2026] range or non-numeric")
        bad_diff = df_projects[~df_projects["difficulty_level"].isin(["Beginner", "Intermediate", "Advanced"])]
        if len(bad_diff):
            err(f"[projects] {len(bad_diff)} rows with invalid difficulty_level")
    if df_ideas is not None:
        team = pd.to_numeric(df_ideas["team_size"], errors="coerce")
        if team.isnull().any() or (team < 1).any() or (team > 5).any():
            err("[ideas] team_size out of [1,5] range or non-numeric")


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else "."
    paths = {name: os.path.join(directory, name) for name in REQUIRED_COLUMNS}

    df_projects = load_csv(paths["projectiq_synthetic_projects.csv"], "projects")
    df_family = load_csv(paths["projectiq_family_mapping.csv"], "family_mapping")
    df_ideas = load_csv(paths["projectiq_student_ideas.csv"], "ideas")
    df_pairs = load_csv(paths["projectiq_similarity_ground_truth.csv"], "pairs")
    df_innov = load_csv(paths["projectiq_innovation_evaluation.csv"], "innovation")

    for name, df in [
        ("projectiq_synthetic_projects.csv", df_projects),
        ("projectiq_family_mapping.csv", df_family),
        ("projectiq_student_ideas.csv", df_ideas),
        ("projectiq_similarity_ground_truth.csv", df_pairs),
        ("projectiq_innovation_evaluation.csv", df_innov),
    ]:
        check_columns_and_rows(name, df)
        check_unique_ids(name, df)
        check_missing_values(name, df)

    check_labels(df_pairs)
    check_family_mapping(df_family)
    check_foreign_keys(df_projects, df_family, df_ideas, df_pairs, df_innov)
    check_numeric_ranges(df_projects, df_ideas)

    print("\n" + "=" * 60)
    print(f"VALIDATION REPORT: {len(ERRORS)} error(s), {len(WARNINGS)} warning(s)")
    print("=" * 60)
    if WARNINGS:
        print("\nWarnings:")
        for w in WARNINGS:
            print(" -", w)
    if ERRORS:
        print("\nErrors:")
        for e in ERRORS:
            print(" -", e)
        print("\nRESULT: FAIL")
        sys.exit(1)
    else:
        print("\nRESULT: PASS — all checks succeeded.")
        sys.exit(0)


if __name__ == "__main__":
    main()
