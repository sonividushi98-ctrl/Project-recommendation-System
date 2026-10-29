#!/usr/bin/env python3
"""
sample_analysis.py — exploratory analysis of the ProjectIQ synthetic dataset.

Loads the five CSVs from the current directory (or a path passed as sys.argv[1]),
prints domain/difficulty distributions, technology frequency, and similarity-label
balance, and saves a few PNG charts alongside the CSVs.

Usage:
    python3 sample_analysis.py [directory]
"""
import sys
import os
from collections import Counter

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def load_all(directory):
    projects = pd.read_csv(os.path.join(directory, "projectiq_synthetic_projects.csv"))
    family = pd.read_csv(os.path.join(directory, "projectiq_family_mapping.csv"))
    ideas = pd.read_csv(os.path.join(directory, "projectiq_student_ideas.csv"))
    pairs = pd.read_csv(os.path.join(directory, "projectiq_similarity_ground_truth.csv"))
    innov = pd.read_csv(os.path.join(directory, "projectiq_innovation_evaluation.csv"))
    return projects, family, ideas, pairs, innov


def explode_semicolon(series):
    counter = Counter()
    for val in series.dropna():
        for item in str(val).split(";"):
            item = item.strip()
            if item and item.lower() != "not applicable":
                counter[item] += 1
    return counter


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else "."
    projects, family, ideas, pairs, innov = load_all(directory)

    print("=" * 70)
    print("DATASET OVERVIEW")
    print("=" * 70)
    print(f"Projects: {len(projects)}  |  Families: {family['family_id'].nunique()}  |  "
          f"Ideas: {len(ideas)}  |  Similarity pairs: {len(pairs)}  |  Innovation records: {len(innov)}")

    print("\n--- Domain distribution (primary_domain) ---")
    domain_counts = projects["primary_domain"].value_counts()
    print(domain_counts.to_string())

    print("\n--- Difficulty distribution ---")
    diff_counts = projects["difficulty_level"].value_counts()
    print(diff_counts.to_string())

    print("\n--- Project type distribution ---")
    print(projects["project_type"].value_counts().to_string())

    print("\n--- Academic year distribution ---")
    print(projects["academic_year"].value_counts().sort_index().to_string())

    print("\n--- Top 20 technologies (from 'technologies' column) ---")
    tech_counts = explode_semicolon(projects["technologies"])
    for tech, cnt in tech_counts.most_common(20):
        print(f"  {tech:<35} {cnt}")

    print("\n--- Top 15 programming languages ---")
    lang_counts = explode_semicolon(projects["programming_languages"])
    for lang, cnt in lang_counts.most_common(15):
        print(f"  {lang:<20} {cnt}")

    print("\n--- Similarity label balance ---")
    print(pairs["conceptual_similarity_label"].value_counts().to_string())
    print("\n--- Similarity overlap-level balance ---")
    print(pairs["overlap_level"].value_counts().to_string())
    print("\n--- Overlap level vs. label (cross-tab) ---")
    print(pd.crosstab(pairs["overlap_level"], pairs["conceptual_similarity_label"]).to_string())

    print("\n--- Innovation: proposed_new_direction frequency ---")
    print(innov["proposed_new_direction"].value_counts().to_string())

    print("\n--- Innovation: feasibility level distribution ---")
    print(innov["feasibility_level"].value_counts().to_string())

    print("\n--- Student idea preferred_difficulty distribution ---")
    print(ideas["preferred_difficulty"].value_counts().to_string())

    print("\n--- Abstract / full-description length stats (words) ---")
    abs_wc = projects["project_abstract"].str.split().str.len()
    full_wc = projects["full_project_description"].str.split().str.len()
    print(f"Abstract: min={abs_wc.min()} max={abs_wc.max()} mean={abs_wc.mean():.1f}")
    print(f"Full desc: min={full_wc.min()} max={full_wc.max()} mean={full_wc.mean():.1f}")

    # ---- charts ----
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    domain_counts.plot(kind="barh", ax=axes[0, 0], color="#4C72B0")
    axes[0, 0].set_title("Projects per Primary Domain")
    axes[0, 0].invert_yaxis()

    diff_counts.reindex(["Beginner", "Intermediate", "Advanced"]).plot(
        kind="bar", ax=axes[0, 1], color="#55A868")
    axes[0, 1].set_title("Difficulty Level Distribution")
    axes[0, 1].tick_params(axis="x", rotation=0)

    top_tech = pd.Series(dict(tech_counts.most_common(12)))
    top_tech.plot(kind="barh", ax=axes[1, 0], color="#C44E52")
    axes[1, 0].set_title("Top 12 Technologies")
    axes[1, 0].invert_yaxis()

    ct = pd.crosstab(pairs["overlap_level"], pairs["conceptual_similarity_label"])
    ct = ct.reindex(["High", "Medium", "Low"])
    ct.plot(kind="bar", stacked=True, ax=axes[1, 1], color=["#8172B2", "#CCB974"])
    axes[1, 1].set_title("Similarity Label by Overlap Level")
    axes[1, 1].tick_params(axis="x", rotation=0)
    axes[1, 1].legend(title="label", labels=["0 (not similar)", "1 (similar)"])

    plt.tight_layout()
    out_path = os.path.join(directory, "sample_analysis_charts.png")
    plt.savefig(out_path, dpi=130)
    print(f"\nSaved charts to {out_path}")


if __name__ == "__main__":
    main()
