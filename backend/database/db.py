import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "projectiq.db"


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_connection() as connection:
        # Existing ideas table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS ideas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Feedback table for recommendations (like, dislike, ratings 1-5, comments)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                project_title TEXT,
                feedback_type TEXT NOT NULL,
                rating INTEGER,
                comment TEXT,
                user_query TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        connection.commit()


def save_feedback(
    project_id: str,
    feedback_type: str,
    project_title: str = "",
    rating: Optional[int] = None,
    comment: str = "",
    user_query: str = "",
) -> int:
    """Inserts a new feedback entry into the database."""
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO feedback (project_id, project_title, feedback_type, rating, comment, user_query)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (project_id, project_title, feedback_type, rating, comment, user_query),
        )
        conn.commit()
        return cursor.lastrowid


def get_feedback_list(limit: int = 50) -> List[Dict[str, Any]]:
    """Returns recent feedback items."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM feedback ORDER BY id DESC LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_feedback_statistics() -> Dict[str, Any]:
    """Computes aggregate feedback statistics."""
    with get_connection() as conn:
        total = conn.execute("SELECT COUNT(*) as count FROM feedback").fetchone()["count"]
        likes = conn.execute("SELECT COUNT(*) as count FROM feedback WHERE feedback_type = 'like'").fetchone()["count"]
        dislikes = conn.execute("SELECT COUNT(*) as count FROM feedback WHERE feedback_type = 'dislike'").fetchone()["count"]
        ratings_avg = conn.execute("SELECT AVG(rating) as avg_rating FROM feedback WHERE rating IS NOT NULL").fetchone()["avg_rating"]

        # Per-project stats
        project_stats_rows = conn.execute("""
            SELECT 
                project_id,
                project_title,
                COUNT(CASE WHEN feedback_type = 'like' THEN 1 END) as likes,
                COUNT(CASE WHEN feedback_type = 'dislike' THEN 1 END) as dislikes,
                AVG(CASE WHEN rating IS NOT NULL THEN rating END) as avg_rating,
                COUNT(*) as total_feedback
            FROM feedback
            GROUP BY project_id
            ORDER BY total_feedback DESC
            LIMIT 20
        """).fetchall()

        project_stats = {
            r["project_id"]: {
                "project_title": r["project_title"],
                "likes": r["likes"],
                "dislikes": r["dislikes"],
                "avg_rating": round(r["avg_rating"], 1) if r["avg_rating"] is not None else None,
                "total_feedback": r["total_feedback"],
            }
            for r in project_stats_rows
        }

        return {
            "total_feedback": total,
            "likes_count": likes,
            "dislikes_count": dislikes,
            "average_rating": round(ratings_avg, 2) if ratings_avg is not None else None,
            "project_stats": project_stats,
        }
