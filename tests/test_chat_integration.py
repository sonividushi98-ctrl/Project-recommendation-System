import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_chat_workflow():
    print("1. Testing GET /chat/status...")
    r = client.get("/chat/status")
    assert r.status_code == 200, r.text
    print("   ✓ /chat/status:", r.json())

    print("2. Testing POST /chat/conversations...")
    r_conv = client.post("/chat/conversations", json={
        "title": "Healthcare AI Capstone",
        "preferences": {
            "domain": "Healthcare and Medical Technology",
            "difficulty": "Intermediate",
            "skills": ["Python", "OpenCV"],
            "technologies": ["TensorFlow", "React"],
            "mode": "hybrid",
            "top_k": 5
        }
    })
    assert r_conv.status_code == 200, r_conv.text
    conv = r_conv.json()
    conv_id = conv["id"]
    print(f"   ✓ Created conversation ID: {conv_id}")

    print("3. Testing GET /chat/conversations...")
    r_list = client.get("/chat/conversations")
    assert r_list.status_code == 200
    assert any(c["id"] == conv_id for c in r_list.json())
    print(f"   ✓ Listed {len(r_list.json())} conversations")

    print("4. Testing POST /chat/conversations/{id}/messages (Initial Recommendation Request)...")
    r_msg1 = client.post(f"/chat/conversations/{conv_id}/messages", json={
        "content": "I want to build an intelligent healthcare disease diagnosis tool using computer vision and CNNs.",
        "preferences": {
            "domain": "Healthcare and Medical Technology",
            "difficulty": "Intermediate",
            "skills": ["Python", "OpenCV", "Deep Learning"],
            "technologies": ["TensorFlow", "FastAPI"],
            "mode": "hybrid",
            "top_k": 5
        }
    })
    assert r_msg1.status_code == 200, r_msg1.text
    res1 = r_msg1.json()
    assert "message" in res1
    assert "recommendations" in res1
    assert len(res1["recommendations"]) >= 3
    print(f"   ✓ Received Gemini reply with {len(res1['recommendations'])} grounded project recommendations!")
    print(f"     First project: {res1['recommendations'][0]['title']}")
    print(f"     Gemini snippet: {res1['message']['content'][:140]}...")

    print("5. Testing Follow-up Inquiry on Specific Project ('Tell me more about the first project')...")
    r_msg2 = client.post(f"/chat/conversations/{conv_id}/messages", json={
        "content": "Tell me more about the first project. How should I architect and implement it?"
    })
    assert r_msg2.status_code == 200, r_msg2.text
    res2 = r_msg2.json()
    print(f"   ✓ Follow-up project inquiry reply: {res2['message']['content'][:140]}...")

    print("6. Testing Comparison Intent ('Compare the first and second project')...")
    r_msg3 = client.post(f"/chat/conversations/{conv_id}/messages", json={
        "content": "Can you compare the first and second projects in terms of difficulty and tech stack?"
    })
    assert r_msg3.status_code == 200, r_msg3.text
    res3 = r_msg3.json()
    print(f"   ✓ Comparison reply: {res3['message']['content'][:140]}...")

    print("7. Testing Bookmark Functionality...")
    top_p = res1["recommendations"][0]
    r_bm = client.post("/chat/bookmarks", json={
        "conversation_id": conv_id,
        "project_id": top_p["id"],
        "project_title": top_p["title"],
        "project_domain": top_p["domain"],
        "project_difficulty": top_p["difficulty_level"],
    })
    assert r_bm.status_code == 200, r_bm.text
    assert r_bm.json()["bookmarked"] is True
    print(f"   ✓ Bookmarked project {top_p['id']}")

    r_bms = client.get(f"/chat/bookmarks?conversation_id={conv_id}")
    assert r_bms.status_code == 200
    assert len(r_bms.json()) >= 1
    print(f"   ✓ Retrieved bookmarks: {len(r_bms.json())} item(s)")

    print("8. Testing Preferences Update...")
    r_pref = client.put(f"/chat/conversations/{conv_id}/preferences", json={
        "preferences": {"domain": "Cybersecurity", "difficulty": "Advanced"}
    })
    assert r_pref.status_code == 200
    print("   ✓ Updated preferences successfully")

    print("\n==========================================")
    print(" ALL CHAT CONVERSATION TESTS PASSED 100%! ")
    print("==========================================")

if __name__ == "__main__":
    test_chat_workflow()
