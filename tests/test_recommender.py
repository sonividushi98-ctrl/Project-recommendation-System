import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from database.db import initialize_database, save_feedback, get_feedback_statistics
from services.preprocessor import load_and_preprocess_dataset
from services.hybrid_recommender import recommend_projects
from services.evaluator import evaluate_recommendation_models

print("--- Testing Database & Preprocessor ---")
initialize_database()
projects, meta = load_and_preprocess_dataset()
print(f"Loaded {len(projects)} projects.")
print(f"Domains: {meta['domains'][:3]}... ({len(meta['domains'])} total)")

print("\n--- Testing Hybrid Recommender ---")
res = recommend_projects(
    query_text="Automated attendance system using computer vision with fraud detection",
    title="Smart Attendance System",
    user_skills=["Python", "OpenCV"],
    preferred_domain="Education Technology",
    preferred_difficulty="Intermediate",
    preferred_technologies=["Flask", "React", "OpenCV"],
    top_k=5,
    mode="hybrid",
)
print(f"Returned {len(res['recommendations'])} recommendations:")
for r in res["recommendations"]:
    print(f"  #{r['rank']}: {r['title']} | Score: {r['similarity_score']} (Sem: {r['semantic_score']}, TF: {r['tfidf_score']}, Pref: {r['preference_score']})")
    print(f"     Explanation: {r['recommendation_explanation']}")

print("\n--- Testing Feedback ---")
fid = save_feedback(
    project_id=res["recommendations"][0]["id"],
    project_title=res["recommendations"][0]["title"],
    feedback_type="like",
    rating=5,
    comment="Very relevant to my skills!",
    user_query="attendance system"
)
print(f"Saved feedback ID: {fid}")
stats = get_feedback_statistics()
print(f"Feedback stats: total={stats['total_feedback']}, likes={stats['likes_count']}, avg_rating={stats['average_rating']}")

print("\n--- Testing Evaluator (K=5, sample=10) ---")
eval_res = evaluate_recommendation_models(k=5, sample_size=10)
print(f"Evaluated on {eval_res['evaluated_queries_count']} queries:")
for m_name, m_stats in eval_res["models_evaluated"].items():
    print(f"  {m_stats['model_name']}: P@5={m_stats['precision_at_k']}, R@5={m_stats['recall_at_k']}, F1={m_stats['f1_score']}")

print("\nAll backend tests passed successfully!")
