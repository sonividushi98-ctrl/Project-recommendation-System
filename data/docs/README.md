# ProjectIQ Synthetic Dataset

Synthetic data for developing and testing **ProjectIQ: AI-Powered Academic Project Intelligence and
Recommendation System** — a third-year B.Tech CSE capstone project. The dataset supports semantic
search, RAG, similar-project detection, innovation-gap identification, and project recommendation.

> **This dataset is entirely synthetic.** Every project, student idea, similarity label and innovation
> evaluation in these files was generated programmatically for prototyping and testing purposes. Nothing
> here describes a real student, a real submission, or a real institutional record. Any resemblance to an
> actual project or person is coincidental.

## A note on scale (read this first)

The project brief that produced this dataset asked, in different sections, for both "~50 families x ~10
projects = 500 projects" **and** a hard target of **300 total projects**. Those two numbers are
mutually exclusive. This generation run resolved the conflict in favor of the figure repeated as the
authoritative total elsewhere in the brief (the dataset-size section and the deliverables section both
say 300), and built:

- **30 project families x 10 archetype variations each = 300 projects**

If you actually need 500 projects, the generator (`generator.py` / `families.py` in the build scripts,
not included in this delivery bundle but available on request) can be extended with 20 more families
using the same pattern.

## Files in this bundle

| File | Rows | Purpose |
|---|---|---|
| `projectiq_synthetic_projects.csv` | 300 | Core project records (30 columns) |
| `projectiq_family_mapping.csv` | 300 | Which family each project belongs to, and its relationship to that family |
| `projectiq_student_ideas.csv` | 100 | Synthetic student-submitted project ideas, deliberately varying in quality/completeness |
| `projectiq_similarity_ground_truth.csv` | 1,210 | Labeled idea<->project pairs for similarity-search evaluation |
| `projectiq_innovation_evaluation.csv` | 220 | Innovation-direction suggestions per idea, grounded in what already exists in the archive |
| `validate_dataset.py` | - | Structural + referential-integrity validation script |
| `sample_analysis.py` | - | Exploratory analysis: domain/difficulty distributions, tech frequency, label balance |

## How the dataset was built

### 1. Project families (the key design idea)

Rather than generating 300 independent, unrelated projects, the generator defines **30 "problem
families"** spanning all 13 requested domains (classroom attendance, medical image diagnosis, phishing
detection, smart parking, resume screening, etc.). Each family is instantiated **10 times** using a
fixed set of **archetype variations**:

1. **Baseline / Core System** — the family's original concept
2. **Alternative Technical Approach** — same problem, different method (e.g. QR-code vs. face recognition)
3. **Security & Anti-Abuse Variant** — adds fraud/tamper resistance
4. **Privacy-Preserving Variant** — on-device inference, data minimization
5. **Predictive / Forecasting Extension** — adds early-warning analytics
6. **Offline / Low-Connectivity Variant** — works without reliable internet
7. **Multi-Source / Multi-Modal Extension** — fuses an additional data stream
8. **Analytics & Anomaly-Detection Variant** — adds a monitoring dashboard
9. **Accessibility-Focused Variant** — re-targets the problem for users with disabilities
10. **Resource / Efficiency Optimization Variant** — adjacent resource-optimization problem

This mirrors the attendance-system example in the brief, applied consistently across all 30 families so
that every family contains a genuine mix of high-overlap, medium-overlap and low-overlap relationships —
not 10 reworded titles of the same idea.

### 2. Student ideas

100 synthetic ideas were generated with deliberately uneven quality, mirroring real student submissions:

- **near_duplicate** — closely restates one specific existing project
- **vague** — a one-line, underspecified idea
- **problem_only** — describes a problem but proposes no solution
- **solution_no_novelty** — proposes a solution but doesn't explain what's new
- **promising_novel** — proposes a genuinely new angle not covered by any of the 10 archetypes
  (gamification, blockchain audit trails, federated benchmarking, AR/VR, voice interfaces, etc.)
- **moderately_detailed** — a reasonably complete, typical submission
- **combo** — blends two unrelated families' problems/techniques
- **generic_vague** — a few-words idea not tied to any specific family, used to stress-test
  underspecified-input handling

### 3. Similarity ground truth

Pairs were generated using the known family/archetype structure (not title matching), so labels reflect
actual conceptual relationships:

- Same-family pairs cover the full range of overlap (High/Medium/Low), because a project 8 archetypes
  away from the idea's own focus is **not** assumed to be highly similar just because it's in the same family.
- **Difficult negatives**: cross-family pairs that share a technology/keyword (e.g., both use Python +
  Flask + PostgreSQL) but solve fundamentally different problems.
- **Difficult positives**: same underlying problem solved with different technology (the
  "Alternative Technical Approach" archetype vs. the idea it's compared against).
- `conceptual_similarity_label` is 1 (meaningfully similar) or 0 (not); `overlap_level` is
  High/Medium/Low. Medium-overlap labels are the ones that require real judgment and are the most
  useful rows for threshold-tuning an embedding-similarity system.

### 4. Innovation evaluation

For each idea, 2–3 records propose a genuinely new direction (not just a feature tweak), chosen from a
pool that includes the 8 non-baseline archetypes above **plus** explainability, fairness, human-in-the-loop,
interoperability, gamification and sustainability — so recommendations sometimes go beyond what any
existing project in the archive already does. `novelty_assessment` is explicitly scoped to "no existing
project in this synthetic archive does X" — it never claims global or patentable originality.

## Known limitations

- Text is template-generated with controlled variability, not independently hand-written per row; at
  this scale some phrasing patterns repeat across unrelated families. Semantic *content* (problem,
  tech stack, user base) is intentionally varied and internally consistent per family.
- `academic_year`, `estimated_development_time_months`, `recommended_team_size` are randomly assigned
  within realistic ranges per difficulty level and carry no deeper meaning.
- `ai_ml_methods` says "Not Applicable" for a handful of baseline projects that are genuinely
  non-ML systems (e.g., a distributed file-storage baseline) — this is intentional, not a missing value.
- The similarity and innovation labels are **synthetic, template-driven annotations**, not validated
  human/expert judgments. They are suitable for building and sanity-testing a pipeline, not for
  publishing accuracy claims about real-world performance.
- Public-dataset references in `dataset_or_data_source` (e.g., APTOS, PlantVillage, NSL-KDD) name real
  public datasets as *structural inspiration* for what a production version might use; the actual rows
  in this file are synthetic, not drawn from those datasets.

## Intended use

Loading, embedding, indexing (e.g., into pgvector), semantic search, RAG prototyping, similarity-model
threshold tuning, and innovation-recommendation logic — all against a FastAPI/PostgreSQL backend, per
the target architecture. Not intended as a source of factual claims about any real technology, dataset,
or institution.
