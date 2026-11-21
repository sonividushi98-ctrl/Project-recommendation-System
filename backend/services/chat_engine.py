import os
import re
import json
from typing import List, Dict, Any, Optional, Tuple
from dotenv import load_dotenv

from services.hybrid_recommender import recommend_projects, get_dataset
from database.chat_store import (
    get_conversation,
    update_conversation_title,
    update_conversation_preferences,
    add_message,
    get_messages,
    get_latest_recommendations,
)

# Load environment
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

FALLBACK_MODELS = [
    DEFAULT_MODEL,
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
]

_gemini_client = None


def get_gemini_client():
    """Initializes and returns the Google GenAI client."""
    global _gemini_client
    if _gemini_client is None:
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not configured in backend/.env")
        from google import genai
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    return _gemini_client


def call_gemini_with_fallback(prompt: str, system_instruction: str = "") -> str:
    """Calls Gemini API with automatic model fallback and graceful error handling."""
    client = get_gemini_client()
    last_error = None

    # De-duplicate model fallback list while maintaining order
    tried = set()
    models_to_try = []
    for m in FALLBACK_MODELS:
        if m and m not in tried:
            models_to_try.append(m)
            tried.add(m)

    for model_name in models_to_try:
        try:
            config = {}
            if system_instruction:
                config["system_instruction"] = system_instruction

            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config if config else None,
            )
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            err_str = str(e)
            print(f"[Gemini Error with {model_name}]: {err_str[:120]}")
            last_error = e
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                continue  # try next fallback model
            if "503" in err_str or "UNAVAILABLE" in err_str:
                continue
            if "404" in err_str:
                continue

    # If all models failed or quota exceeded
    raise RuntimeError(
        f"Gemini API temporarily unavailable or quota limit reached. ({last_error})"
    )


# ==========================================
# Intent Classification & Reference Resolution
# ==========================================

ORDINAL_MAP = {
    "first": 0, "1st": 0, "1": 0, "#1": 0, "one": 0,
    "second": 1, "2nd": 1, "2": 1, "#2": 1, "two": 1,
    "third": 2, "3rd": 2, "3": 2, "#3": 2, "three": 2,
    "fourth": 3, "4th": 3, "4": 3, "#4": 3, "four": 3,
    "fifth": 4, "5th": 4, "5": 4, "#5": 4, "five": 4,
    "sixth": 5, "6th": 5, "6": 5, "#6": 5,
    "seventh": 6, "7th": 6, "7": 6, "#7": 6,
    "eighth": 7, "8th": 7, "8": 7, "#8": 7,
    "ninth": 8, "9th": 8, "9": 8, "#9": 8,
    "tenth": 9, "10th": 9, "10": 9, "#10": 9,
}


def resolve_referenced_projects(user_message: str, previous_recommendations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Identifies which previous projects the user is referring to (e.g. 'the second project', 'P0002')."""
    if not previous_recommendations:
        return []

    lower = user_message.lower()
    matched = []

    # Check for direct ID mention (e.g. P0001, P0042)
    for p in previous_recommendations:
        pid = p.get("id", "").lower()
        if pid and re.search(rf"\b{re.escape(pid)}\b", lower):
            matched.append(p)

    # Check for ordinal mentions (e.g. 'second project', '#2', 'project 2')
    ordinal_matches = re.findall(
        r"\b(?:the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|#[1-9]|project\s+[1-9])\b",
        lower
    )
    for m in ordinal_matches:
        clean_m = m.replace("project", "").strip()
        if clean_m in ORDINAL_MAP:
            idx = ORDINAL_MAP[clean_m]
            if idx < len(previous_recommendations):
                proj = previous_recommendations[idx]
                if proj not in matched:
                    matched.append(proj)

    # Check for title keyword matches
    if not matched:
        for p in previous_recommendations:
            title_words = [w for w in p.get("title", "").lower().split() if len(w) > 3]
            overlap = [w for w in title_words if w in lower]
            if len(overlap) >= 2:
                matched.append(p)
                break

    return matched


def classify_user_intent(user_message: str, previous_recommendations: List[Dict[str, Any]], has_new_preferences: bool) -> str:
    """Classifies user intent into: 'recommendation_request', 'project_inquiry', 'comparison', 'general_question'."""
    lower = user_message.lower().strip()

    # If preferences were modified or explicitly asking for ideas/projects/recommendations
    rec_keywords = [
        "recommend", "suggest", "project idea", "give me", "show me", "projects for",
        "build", "want to create", "interested in", "look for", "find projects", "what can i build",
        "new recommendations", "filter", "different projects"
    ]
    if has_new_preferences or any(k in lower for k in rec_keywords):
        return "recommendation_request"

    # Comparison intent
    comp_keywords = ["compare", "difference between", "versus", "vs", "which is better", "which one"]
    if any(k in lower for k in comp_keywords) and len(previous_recommendations) >= 2:
        return "comparison"

    # Specific project inquiry
    inquiry_keywords = [
        "tell me more", "how does", "how to implement", "explain", "architecture of",
        "what dataset", "dataset for", "technologies in", "simpler version", "advanced version",
        "detail", "more info", "second project", "first project", "third project"
    ]
    if any(k in lower for k in inquiry_keywords) or resolve_referenced_projects(user_message, previous_recommendations):
        return "project_inquiry"

    # Default to recommendation request if it looks like a problem statement
    if len(lower.split()) >= 6:
        return "recommendation_request"

    return "general_question"


# ==========================================
# Main Chat Conversation Handler
# ==========================================

SYSTEM_PROMPT = """You are ProjectIQ, an expert academic AI Project Advisor and Research Mentor for university students.
Your mission is to guide students in discovering, designing, and implementing high-impact academic capstone projects.

CRITICAL RULES:
1. Always ground project recommendations and details in the ACTUAL projects retrieved from the ProjectIQ dataset.
2. DO NOT hallucinate fake project IDs, fabricated titles, or made-up statistics.
3. When projects are retrieved by the recommendation engine, explain WHY they match the student's requirements, skills, and domain.
4. For implementation questions, provide concrete, actionable guidance: architecture overview, recommended public datasets, key libraries, and step-by-step development phases.
5. Keep your tone encouraging, professional, and academically rigorous.
6. Provide clear, structured formatting with bullet points and bold headers where helpful.
"""


def process_chat_message(
    conversation_id: str,
    user_message: str,
    override_preferences: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Orchestrates the conversational chatbot:
    1. Loads conversation history and current preferences.
    2. Merges any newly passed preferences.
    3. Resolves intent and contextual project references.
    4. Calls ML Recommendation Engine when recommendations are required.
    5. Grounds Gemini response in actual retrieved project data (RAG).
    6. Stores messages and returns response with project cards and follow-up suggestions.
    """
    conv = get_conversation(conversation_id)
    if not conv:
        raise ValueError(f"Conversation {conversation_id} not found.")

    current_prefs = conv.get("preferences") or {}

    # Check if preferences were updated
    has_pref_changes = False
    if override_preferences:
        for k, v in override_preferences.items():
            if current_prefs.get(k) != v:
                has_pref_changes = True
                current_prefs[k] = v
        update_conversation_preferences(conversation_id, current_prefs)

    prev_recommendations = get_latest_recommendations(conversation_id)
    messages_history = get_messages(conversation_id, limit=8)

    intent = classify_user_intent(user_message, prev_recommendations, has_pref_changes)
    referenced_projects = resolve_referenced_projects(user_message, prev_recommendations)

    recommended_projects = []
    gemini_prompt = ""

    # 1. Recommendation Request Intent
    if intent == "recommendation_request":
        # Extract query parameters from user message and preferences
        user_skills = current_prefs.get("skills", [])
        user_domain = current_prefs.get("domain", "Any Domain")
        user_diff = current_prefs.get("difficulty", "Any")
        user_techs = current_prefs.get("technologies", [])
        top_k = current_prefs.get("top_k", 5)
        mode = current_prefs.get("mode", "hybrid")
        weights = current_prefs.get("weights", {"semantic": 0.45, "tfidf": 0.30, "preference": 0.25})

        # Run ML Recommendation Engine (Sentence Transformers + TF-IDF + Preferences)
        rec_result = recommend_projects(
            query_text=user_message,
            user_skills=user_skills,
            preferred_domain="Any" if user_domain == "Any Domain" else user_domain,
            preferred_difficulty=user_diff,
            preferred_technologies=user_techs,
            top_k=top_k,
            mode=mode,
            semantic_weight=weights.get("semantic", 0.45),
            tfidf_weight=weights.get("tfidf", 0.30),
            preference_weight=weights.get("preference", 0.25),
        )
        recommended_projects = rec_result.get("recommendations", [])

        # Grounding data for Gemini
        projects_summary = []
        for p in recommended_projects:
            projects_summary.append(
                f"- Project #{p['rank']} [{p['id']}]: '{p['title']}' | Domain: {p['domain']} | Difficulty: {p['difficulty_level']}\n"
                f"  Relevance Match: {int(p['similarity_score'] * 100)}% (Semantic: {int(p['semantic_score']*100)}%, Keywords: {int(p['tfidf_score']*100)}%, Preferences: {int(p['preference_score']*100)}%)\n"
                f"  Description: {p['description']}\n"
                f"  Key Technologies: {', '.join(p['technologies'])}\n"
                f"  Why Recommended: {p['recommendation_explanation']}"
            )

        gemini_prompt = f"""The student asked: "{user_message}"

Active Preferences:
- Domain: {user_domain}
- Difficulty: {user_diff}
- Skills: {', '.join(user_skills) if user_skills else 'None specified'}
- Technologies: {', '.join(user_techs) if user_techs else 'None specified'}
- Mode: {mode.upper()}

The ProjectIQ ML Recommendation Engine retrieved the following Top {len(recommended_projects)} actual projects from the dataset:
{chr(10).join(projects_summary)}

YOUR TASK:
1. Provide an insightful, engaging conversational response introducing these recommendations.
2. Highlight why the top recommendations directly align with what the student asked for and their selected preferences.
3. Mention key technical concepts or architectures they would work with.
4. Encourage them to ask about implementation details, dataset choices, or simpler/more advanced alternatives for any project.
"""

    # 2. Project Inquiry Intent
    elif intent == "project_inquiry":
        targets = referenced_projects if referenced_projects else (prev_recommendations[:1] if prev_recommendations else [])
        if targets:
            target = targets[0]
            gemini_prompt = f"""The student asked: "{user_message}"

They are inquiring about the following project previously recommended from our dataset:
Project ID: {target.get('id')}
Title: {target.get('title')}
Domain: {target.get('domain')}
Difficulty Level: {target.get('difficulty_level')}
Description: {target.get('description')}
Technologies: {', '.join(target.get('technologies', []))}
Required Skills: {', '.join(target.get('required_skills', []))}
Key Features: {target.get('key_features', 'N/A')}
Innovation Aspects: {target.get('innovation_aspects', 'N/A')}

YOUR TASK:
Answer the student's question thoroughly and ground your answer strictly in this project's details. Explain the architecture, potential datasets, implementation steps, and how they can build this project successfully.
"""
        else:
            gemini_prompt = f"""The student asked: "{user_message}"
They are asking about project details, but no previous projects were found in context. Answer their technical question helpfully and encourage them to describe what project they'd like to build."""

    # 3. Comparison Intent
    elif intent == "comparison":
        comps = referenced_projects if len(referenced_projects) >= 2 else prev_recommendations[:2]
        comps_text = []
        for i, p in enumerate(comps, 1):
            comps_text.append(
                f"Project {i} [{p['id']}]: '{p['title']}'\n"
                f"Domain: {p['domain']} | Difficulty: {p['difficulty_level']}\n"
                f"Technologies: {', '.join(p.get('technologies', []))}\n"
                f"Description: {p.get('description')}\n"
                f"Features: {p.get('key_features', '')}"
            )

        gemini_prompt = f"""The student asked: "{user_message}"

Compare the following projects from our dataset:
{chr(10).join(comps_text)}

YOUR TASK:
Provide a clear, side-by-side comparison covering:
1. Core problem & technical approach difference.
2. Difficulty & implementation complexity.
3. Required tech stack & learning curve.
4. Recommendation on which to choose depending on the student's background.
"""

    # 4. General / Technical Question
    else:
        context_snippets = []
        if prev_recommendations:
            context_snippets.append(f"Previously discussed projects: {', '.join(p['title'] for p in prev_recommendations[:3])}")

        gemini_prompt = f"""The student asked: "{user_message}"
Context:
{chr(10).join(context_snippets) if context_snippets else 'No prior projects.'}

YOUR TASK:
Provide an expert, motivating, and detailed response to the student's academic project query."""

    # Generate Response with Gemini (with fallback)
    try:
        assistant_reply = call_gemini_with_fallback(gemini_prompt, system_instruction=SYSTEM_PROMPT)
    except Exception as e:
        # Graceful fallback if API quota or offline
        if recommended_projects:
            assistant_reply = (
                f"Here are the top {len(recommended_projects)} projects retrieved by our ML Recommendation Engine "
                f"based on your criteria:\n\n"
                + "\n\n".join([f"**{p['rank']}. {p['title']}** ({p['domain']}, {p['difficulty_level']})\n{p['description']}" for p in recommended_projects])
                + f"\n\n*(Note: AI conversational explanation generated via local ML engine due to temporary external API limit: {e})*"
            )
        else:
            assistant_reply = f"I've received your request. (Notice: Gemini API is currently unavailable: {e}). How else can I assist with your project requirements?"

    # Generate context-aware follow-up suggestions
    suggestions = generate_follow_up_suggestions(intent, recommended_projects or prev_recommendations)

    # Update conversation title if first message
    if len(messages_history) <= 1:
        words = user_message.strip().split()
        title_snippet = " ".join(words[:5]) + ("..." if len(words) > 5 else "")
        update_conversation_title(conversation_id, title_snippet.capitalize() or "Project Exploration")

    # Save User and Assistant Messages
    add_message(conversation_id, "user", user_message)
    saved_assistant_msg = add_message(
        conversation_id=conversation_id,
        role="assistant",
        content=assistant_reply,
        recommendations=recommended_projects,
        suggestions=suggestions,
    )

    return {
        "conversation_id": conversation_id,
        "message": saved_assistant_msg,
        "recommendations": recommended_projects,
        "suggestions": suggestions,
        "preferences": current_prefs,
    }


def generate_follow_up_suggestions(intent: str, active_projects: List[Dict[str, Any]]) -> List[str]:
    """Generates intelligent, clickable follow-up suggestion pills."""
    if not active_projects:
        return [
            "Recommend AI projects for healthcare",
            "Show me beginner Computer Vision projects",
            "I want an IoT smart city capstone project",
            "What projects can I build with Python and OpenCV?",
        ]

    top_p = active_projects[0]
    p_title = top_p.get("title", "")
    short_title = p_title[:28] + ("..." if len(p_title) > 28 else "")

    suggestions = [
        f"Tell me more about #{top_p.get('rank', 1)}: {short_title}",
    ]

    if len(active_projects) >= 2:
        suggestions.append(f"Compare project #1 and #{active_projects[1].get('rank', 2)}")

    suggestions.append("What dataset and libraries should I use?")
    suggestions.append("Can you suggest a simpler beginner alternative?")

    return suggestions[:4]
