# ProjectIQ - AI Conversational Academic Project Recommendation Platform

ProjectIQ is an AI-powered conversational chatbot and academic project intelligence system. It combines the **Google Gemini API** (using the official `google-genai` SDK) with a **Hybrid Machine Learning Recommendation Engine** (Sentence Transformers `all-MiniLM-L6-v2`, TF-IDF cosine similarity, and multi-attribute preference matching) to guide students through exploring, recommending, designing, and comparing capstone projects.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       Modern Chatbot Frontend         |
                      |   (React 19 + Vite, ChatGPT-style)    |
                      +-------------------+-------------------+
                                          | REST / JSON
                                          v
                      +---------------------------------------+
                      |           FastAPI Backend             |
                      +-------------------+-------------------+
                                          |
          +-------------------------------+-------------------------------+
          |                               |                               |
          v                               v                               v
+-------------------+           +-------------------+           +-------------------+
|  Google Gemini    |           |   Hybrid ML Engine|           | Conversation Store|
|  API Integration  |           | (SentenceTransf.  |           | (MongoDB + SQLite |
| (gemini-3.5-flash)|           |  + TF-IDF + Prefs)|           |  Failover Memory) |
+-------------------+           +-------------------+           +-------------------+
          |                               |                               |
          +---------------> Grounded RAG <+-------------------------------+
```

---

## Key Features

1. **Google Gemini API Integration**:
   - Official `google-genai` SDK integration.
   - Configurable free-tier model: `GEMINI_MODEL=gemini-3.5-flash-lite` (with automatic fallback to `gemini-3.8-flash` and `gemini-3.5-flash`).
   - Secure API key storage via `backend/.env` as `GEMINI_API_KEY` (git-ignored, never sent to frontend).
   - Graceful quota, rate limit (429), and 503 handling with local ML fallback.

2. **Modern Chatbot Interface**:
   - ChatGPT-style responsive layout with conversation history sidebar.
   - **New Chat** button to start fresh exploration sessions.
   - Conversation management: switch between past chats, rename, or delete.
   - Embedded interactive **Project Cards** within assistant replies.
   - Interactive project bookmarking (⭐ / 🔖) and Bookmarked Projects drawer.
   - Interactive project feedback (Like, Dislike, 1–5 Star rating).
   - Dynamic follow-up suggestion pills (e.g., *"Tell me more about #1"*, *"Compare project 1 and 2"*).

3. **Expandable Project Preferences Section**:
   - Located right above the message composer.
   - **Preferred Domain**: Dropdown with 13 academic domains + *Any Domain*.
   - **Difficulty Level**: *Any*, *Beginner*, *Intermediate*, *Advanced*.
   - **Skills Multi-Select**: Tag chips + suggestions (*Python, Java, C, C++, HTML, CSS, JavaScript, React, SQL, MongoDB, Machine Learning, Deep Learning, Data Analysis, Web Development, App Development, UI/UX Design, Problem Solving, Data Structures & Algorithms, Git & GitHub, API Integration*).
   - **Preferred Technologies**: Tag chips + suggestions (*React.js, Node.js, Express.js, Django, Flask, FastAPI, MongoDB, MySQL, Firebase, PostgreSQL, TensorFlow, PyTorch, Scikit-learn, HTML/CSS, Bootstrap, Tailwind CSS, Streamlit, Flutter, GitHub, Google Colab*).
   - **Recommendation Mode**: *Hybrid (Recommended)*, *Semantic Only*, *TF-IDF Only*.
   - **Quantity**: *Top 5* or *Top 10*.
   - **Hybrid Weight Tuning**: Real-time sliders for Semantic, TF-IDF, and Preference weights.
   - Active preferences displayed as removable chips above the message box.
   - Preferences persist per conversation and can be modified at any time.

4. **Grounded RAG with Actual ML Dataset**:
   - Gemini **never hallucinates fake projects**.
   - The ML recommendation engine searches the curated 300-project dataset using **Sentence Transformers (`all-MiniLM-L6-v2`)** and **TF-IDF**.
   - Retrieved records (abstract, features, tech stack, dataset source, limitations) are passed into Gemini for contextual explanation, architecture breakdown, and comparison.

5. **Conversation Memory**:
   - Dual-backend storage architecture:
     - Primary: **MongoDB** (`MONGO_URI=mongodb://localhost:27017/projectiq`).
     - Automatic Failover: **SQLite** (`projectiq.db`), guaranteeing 100% availability without external service dependencies.
   - Resolves contextual references (*"Tell me more about the second project"* or *"compare project #1 and #2"*).

6. **Empirical Model Evaluation**:
   - Real, non-simulated Precision@K, Recall@K, and F1-score evaluation against 1,210 labeled ground-truth pairs (`projectiq_similarity_ground_truth.csv`).
   - Viewable via the **Model Benchmark** modal in the chatbot navbar.

---

## Environment Configuration

In `backend/.env`:
```ini
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
MONGO_URI=mongodb://localhost:27017/projectiq
```

---

## API Endpoints

### Conversational Chatbot
- `POST /chat/conversations` — Create a new conversation session.
- `GET /chat/conversations` — List conversation history.
- `GET /chat/conversations/{id}` — Get conversation details and preferences.
- `DELETE /chat/conversations/{id}` — Delete a conversation and its messages.
- `GET /chat/conversations/{id}/messages` — Fetch message history.
- `POST /chat/conversations/{id}/messages` — Send message; triggers Gemini + ML Recommendation Engine.
- `PUT /chat/conversations/{id}/preferences` — Update active preferences for a conversation.
- `POST /chat/bookmarks` — Toggle project bookmark.
- `GET /chat/bookmarks` — List bookmarked projects.
- `GET /chat/status` — Get active storage engine and Gemini model.

### ML Recommendations & Analytics
- `POST /recommend` — Direct ML hybrid recommendation endpoint.
- `GET /metadata` — Domains, skills, and technologies catalog.
- `POST /feedback` — Submit Like, Dislike, or 1–5 Star rating.
- `GET /feedback/stats` — Aggregate feedback metrics.
- `GET /evaluate` — Precision@K, Recall@K, F1 ground-truth evaluation.
- `GET /health` — Service health check.

---

## How to Run the Project

### 1. Start the FastAPI Backend
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
- API is accessible at: `http://127.0.0.1:8000`
- Swagger Docs: `http://127.0.0.1:8000/docs`

### 2. Start the Frontend Development Server
In a separate terminal:
```powershell
cd frontend
npm run dev
```
- Open `http://localhost:5173` in your browser.

### 3. Run Automated Tests
```powershell
# Run full chatbot conversational integration test (Gemini, RAG, memory, bookmarks)
& ".\backend\.venv\Scripts\Activate.ps1"; python tests/test_chat_integration.py

# Run backend API regression test (all 9 core endpoints)
& ".\backend\.venv\Scripts\Activate.ps1"; python tests/test_api_integration.py
```
