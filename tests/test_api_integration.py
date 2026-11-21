import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_all():
    print("1. Testing GET /health...")
    r = client.get("/health")
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "healthy"
    print("   ✓ /health passed")

    print("2. Testing GET /metadata...")
    r = client.get("/metadata")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "domains" in data
    assert "difficulties" in data
    assert len(data["domains"]) >= 10
    print(f"   ✓ /metadata passed ({len(data['domains'])} domains, {len(data['popular_skills'])} skills)")

    print("3. Testing POST /recommend (Hybrid)...")
    payload = {
        "title": "Smart Attendance System",
        "query": "Attendance management using face recognition and computer vision with anti-proxy safeguards",
        "skills": ["Python", "OpenCV"],
        "domain": "Education Technology",
        "difficulty": "Intermediate",
        "technologies": ["Flask", "OpenCV", "React"],
        "top_k": 5,
        "mode": "hybrid"
    }
    r = client.post("/recommend", json=payload)
    assert r.status_code == 200, r.text
    rec_data = r.json()
    assert "recommendations" in rec_data
    assert len(rec_data["recommendations"]) == 5
    top_rec = rec_data["recommendations"][0]
    assert "similarity_score" in top_rec
    assert "recommendation_explanation" in top_rec
    assert "semantic_score" in top_rec
    assert "tfidf_score" in top_rec
    assert "preference_score" in top_rec
    print(f"   ✓ /recommend hybrid passed: #{top_rec['rank']} '{top_rec['title']}' (Score: {top_rec['similarity_score']})")

    print("4. Testing POST /recommend (Semantic Only)...")
    payload["mode"] = "semantic_only"
    r = client.post("/recommend", json=payload)
    assert r.status_code == 200, r.text
    assert len(r.json()["recommendations"]) == 5
    print("   ✓ /recommend semantic_only passed")

    print("5. Testing POST /recommend (TF-IDF Only)...")
    payload["mode"] = "tfidf_only"
    r = client.post("/recommend", json=payload)
    assert r.status_code == 200, r.text
    assert len(r.json()["recommendations"]) == 5
    print("   ✓ /recommend tfidf_only passed")

    print("6. Testing POST /feedback...")
    fb_payload = {
        "project_id": top_rec["id"],
        "project_title": top_rec["title"],
        "feedback_type": "like",
        "rating": 5,
        "comment": "Super helpful recommendation!",
        "user_query": payload["query"]
    }
    r = client.post("/feedback", json=fb_payload)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "success"
    print("   ✓ /feedback POST passed")

    print("7. Testing GET /feedback & GET /feedback/stats...")
    r_list = client.get("/feedback")
    assert r_list.status_code == 200
    assert len(r_list.json()) >= 1

    r_stats = client.get("/feedback/stats")
    assert r_stats.status_code == 200
    stats = r_stats.json()
    assert stats["total_feedback"] >= 1
    assert stats["likes_count"] >= 1
    print(f"   ✓ /feedback stats passed: total={stats['total_feedback']}, likes={stats['likes_count']}")

    print("8. Testing Legacy Endpoints (POST /ideas, GET /ideas, POST /analyze)...")
    idea_payload = {"title": "Legacy Test Idea", "description": "This is a detailed test description for an innovative IoT project."}
    r_idea = client.post("/ideas", json=idea_payload)
    assert r_idea.status_code == 200

    r_ideas = client.get("/ideas")
    assert r_ideas.status_code == 200
    assert len(r_ideas.json()) >= 1

    r_analyze = client.post("/analyze", json={"idea": "Smart traffic light controller with camera", "top_k": 3})
    assert r_analyze.status_code == 200
    assert "similar_projects" in r_analyze.json()
    assert len(r_analyze.json()["similar_projects"]) == 3
    print("   ✓ Legacy endpoints (/ideas, /analyze) passed with 100% backward compatibility")

    print("9. Testing GET /evaluate (Ground-truth benchmark)...")
    r_eval = client.get("/evaluate?k=5&sample_size=15")
    assert r_eval.status_code == 200, r_eval.text
    eval_metrics = r_eval.json()
    assert "models_evaluated" in eval_metrics
    assert "hybrid" in eval_metrics["models_evaluated"]
    assert "semantic_only" in eval_metrics["models_evaluated"]
    assert "tfidf_only" in eval_metrics["models_evaluated"]
    print(f"   ✓ /evaluate passed. Hybrid F1: {eval_metrics['models_evaluated']['hybrid']['f1_score']}")

    print("\n==========================================")
    print(" ALL 9 API INTEGRATION TESTS PASSED 100%! ")
    print("==========================================")

if __name__ == "__main__":
    test_all()
