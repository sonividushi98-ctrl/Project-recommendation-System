import os
import uuid
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "projectiq.db"
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/projectiq")

_mongo_client = None
_mongo_db = None
_storage_type = "sqlite"  # 'mongodb' or 'sqlite'


def init_storage():
    """Initializes MongoDB if reachable, otherwise seamlessly falls back to SQLite."""
    global _mongo_client, _mongo_db, _storage_type

    # Try connecting to MongoDB with a short timeout
    try:
        from pymongo import MongoClient
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=1500)
        # Ping server to verify connection
        client.admin.command('ping')
        _mongo_client = client
        _mongo_db = client.get_default_database("projectiq")
        _storage_type = "mongodb"
        print("[ProjectIQ Storage] Connected to MongoDB successfully.")
        return
    except Exception as e:
        _storage_type = "sqlite"
        print(f"[ProjectIQ Storage] MongoDB unavailable ({e}). Using SQLite for conversation memory.")

    # Initialize SQLite tables
    conn = sqlite3.connect(DB_PATH)
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                preferences TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                recommendations TEXT,
                suggestions TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_bookmarks (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                project_title TEXT,
                project_domain TEXT,
                project_difficulty TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(conversation_id, project_id)
            )
        """)
    conn.close()

# Auto-initialize on module import
init_storage()



def get_storage_type() -> str:
    return _storage_type


# ==========================================
# Conversation CRUD
# ==========================================

def create_conversation(title: str = "New Conversation", initial_preferences: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    conv_id = f"conv_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow().isoformat()
    prefs = initial_preferences or {
        "domain": "Any Domain",
        "difficulty": "Any",
        "skills": [],
        "technologies": [],
        "mode": "hybrid",
        "top_k": 5,
        "weights": {"semantic": 0.45, "tfidf": 0.30, "preference": 0.25}
    }

    if _storage_type == "mongodb" and _mongo_db is not None:
        doc = {
            "_id": conv_id,
            "id": conv_id,
            "title": title,
            "preferences": prefs,
            "created_at": now,
            "updated_at": now,
        }
        _mongo_db.conversations.insert_one(doc)
        doc.pop("_id", None)
        return doc

    # SQLite
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO chat_conversations (id, title, preferences, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (conv_id, title, json.dumps(prefs), now, now),
        )
    return {"id": conv_id, "title": title, "preferences": prefs, "created_at": now, "updated_at": now}


def get_conversations(limit: int = 50) -> List[Dict[str, Any]]:
    if _storage_type == "mongodb" and _mongo_db is not None:
        cursor = _mongo_db.conversations.find().sort("updated_at", -1).limit(limit)
        results = []
        for doc in cursor:
            doc["id"] = doc.get("id") or str(doc.get("_id"))
            doc.pop("_id", None)
            results.append(doc)
        return results

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM chat_conversations ORDER BY updated_at DESC LIMIT ?", (limit,)
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            try:
                d["preferences"] = json.loads(d.get("preferences") or "{}")
            except Exception:
                d["preferences"] = {}
            results.append(d)
        return results


def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
    if _storage_type == "mongodb" and _mongo_db is not None:
        doc = _mongo_db.conversations.find_one({"id": conv_id})
        if doc:
            doc["id"] = doc.get("id") or str(doc.get("_id"))
            doc.pop("_id", None)
            return doc
        return None

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM chat_conversations WHERE id = ?", (conv_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        try:
            d["preferences"] = json.loads(d.get("preferences") or "{}")
        except Exception:
            d["preferences"] = {}
        return d


def update_conversation_title(conv_id: str, new_title: str):
    now = datetime.utcnow().isoformat()
    if _storage_type == "mongodb" and _mongo_db is not None:
        _mongo_db.conversations.update_one(
            {"id": conv_id},
            {"$set": {"title": new_title, "updated_at": now}}
        )
        return

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ?",
            (new_title, now, conv_id)
        )


def update_conversation_preferences(conv_id: str, preferences: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    if _storage_type == "mongodb" and _mongo_db is not None:
        _mongo_db.conversations.update_one(
            {"id": conv_id},
            {"$set": {"preferences": preferences, "updated_at": now}}
        )
        return

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE chat_conversations SET preferences = ?, updated_at = ? WHERE id = ?",
            (json.dumps(preferences), now, conv_id)
        )


def delete_conversation(conv_id: str):
    if _storage_type == "mongodb" and _mongo_db is not None:
        _mongo_db.conversations.delete_one({"id": conv_id})
        _mongo_db.messages.delete_many({"conversation_id": conv_id})
        _mongo_db.bookmarks.delete_many({"conversation_id": conv_id})
        return

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM chat_messages WHERE conversation_id = ?", (conv_id,))
        conn.execute("DELETE FROM chat_bookmarks WHERE conversation_id = ?", (conv_id,))
        conn.execute("DELETE FROM chat_conversations WHERE id = ?", (conv_id,))


# ==========================================
# Messages CRUD
# ==========================================

def add_message(
    conversation_id: str,
    role: str,
    content: str,
    recommendations: Optional[List[Dict[str, Any]]] = None,
    suggestions: Optional[List[str]] = None,
) -> Dict[str, Any]:
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow().isoformat()
    recommendations = recommendations or []
    suggestions = suggestions or []

    if _storage_type == "mongodb" and _mongo_db is not None:
        doc = {
            "_id": msg_id,
            "id": msg_id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "recommendations": recommendations,
            "suggestions": suggestions,
            "created_at": now,
        }
        _mongo_db.messages.insert_one(doc)
        _mongo_db.conversations.update_one({"id": conversation_id}, {"$set": {"updated_at": now}})
        doc.pop("_id", None)
        return doc

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO chat_messages (id, conversation_id, role, content, recommendations, suggestions, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                msg_id,
                conversation_id,
                role,
                content,
                json.dumps(recommendations),
                json.dumps(suggestions),
                now,
            ),
        )
        conn.execute(
            "UPDATE chat_conversations SET updated_at = ? WHERE id = ?",
            (now, conversation_id),
        )

    return {
        "id": msg_id,
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "recommendations": recommendations,
        "suggestions": suggestions,
        "created_at": now,
    }


def get_messages(conversation_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    if _storage_type == "mongodb" and _mongo_db is not None:
        cursor = _mongo_db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1).limit(limit)
        results = []
        for doc in cursor:
            doc["id"] = doc.get("id") or str(doc.get("_id"))
            doc.pop("_id", None)
            results.append(doc)
        return results

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?",
            (conversation_id, limit),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            try:
                d["recommendations"] = json.loads(d.get("recommendations") or "[]")
            except Exception:
                d["recommendations"] = []
            try:
                d["suggestions"] = json.loads(d.get("suggestions") or "[]")
            except Exception:
                d["suggestions"] = []
            results.append(d)
        return results


def get_latest_recommendations(conversation_id: str) -> List[Dict[str, Any]]:
    """Retrieves the most recent list of recommended projects in this conversation."""
    msgs = get_messages(conversation_id, limit=30)
    for m in reversed(msgs):
        if m.get("recommendations") and len(m["recommendations"]) > 0:
            return m["recommendations"]
    return []


# ==========================================
# Bookmarks CRUD
# ==========================================

def toggle_bookmark(
    conversation_id: str,
    project_id: str,
    project_title: str = "",
    project_domain: str = "",
    project_difficulty: str = "",
) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat()

    if _storage_type == "mongodb" and _mongo_db is not None:
        existing = _mongo_db.bookmarks.find_one({"conversation_id": conversation_id, "project_id": project_id})
        if existing:
            _mongo_db.bookmarks.delete_one({"_id": existing["_id"]})
            return {"bookmarked": False, "project_id": project_id}
        else:
            b_id = f"bm_{uuid.uuid4().hex[:10]}"
            _mongo_db.bookmarks.insert_one({
                "_id": b_id,
                "id": b_id,
                "conversation_id": conversation_id,
                "project_id": project_id,
                "project_title": project_title,
                "project_domain": project_domain,
                "project_difficulty": project_difficulty,
                "created_at": now,
            })
            return {"bookmarked": True, "project_id": project_id}

    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT id FROM chat_bookmarks WHERE conversation_id = ? AND project_id = ?",
            (conversation_id, project_id),
        ).fetchone()

        if row:
            conn.execute("DELETE FROM chat_bookmarks WHERE id = ?", (row[0],))
            return {"bookmarked": False, "project_id": project_id}
        else:
            b_id = f"bm_{uuid.uuid4().hex[:10]}"
            conn.execute(
                """
                INSERT INTO chat_bookmarks (id, conversation_id, project_id, project_title, project_domain, project_difficulty, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (b_id, conversation_id, project_id, project_title, project_domain, project_difficulty, now),
            )
            return {"bookmarked": True, "project_id": project_id}


def get_bookmarks(conversation_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if _storage_type == "mongodb" and _mongo_db is not None:
        query = {"conversation_id": conversation_id} if conversation_id else {}
        cursor = _mongo_db.bookmarks.find(query).sort("created_at", -1)
        results = []
        for doc in cursor:
            doc["id"] = doc.get("id") or str(doc.get("_id"))
            doc.pop("_id", None)
            results.append(doc)
        return results

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        if conversation_id:
            rows = conn.execute(
                "SELECT * FROM chat_bookmarks WHERE conversation_id = ? ORDER BY created_at DESC",
                (conversation_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM chat_bookmarks ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]
