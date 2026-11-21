import { useState, useEffect, useRef } from "react";
import "./App.css";
import {
  MessageSquare,
  Plus,
  Trash2,
  Bookmark,
  Sparkles,
  Send,
  Sliders,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Star,
  BarChart3,
  Target,
  Layers,
  Cpu,
  Wrench,
  X,
  CheckCircle2,
  ArrowRight,
  BookmarkCheck,
  Sidebar,
  Menu,
} from "lucide-react";

// Smart API base resolver matching host (localhost vs 127.0.0.1)
const API_HOST =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "http://127.0.0.1:8000";

async function fetchWithFallback(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_HOST}${endpoint}`, options);
    return res;
  } catch {
    const altHost =
      API_HOST.includes("localhost")
        ? "http://127.0.0.1:8000"
        : "http://localhost:8000";
    try {
      const resAlt = await fetch(`${altHost}${endpoint}`, options);
      return resAlt;
    } catch {
      try {
        const resProxy = await fetch(`/api${endpoint}`, options);
        return resProxy;
      } catch {
        throw new Error(
          "Cannot reach the backend server. Please verify that the Python backend is running on http://127.0.0.1:8000."
        );
      }
    }
  }
}

const DEFAULT_POPULAR_SKILLS = [
  "Python",
  "Java",
  "C",
  "C++",
  "HTML",
  "CSS",
  "JavaScript",
  "React",
  "SQL",
  "MongoDB",
  "Machine Learning",
  "Deep Learning",
  "Data Analysis",
  "Web Development",
  "App Development",
  "UI/UX Design",
  "Problem Solving",
  "Data Structures & Algorithms",
  "Git & GitHub",
  "API Integration",
];

const DEFAULT_POPULAR_TECHS = [
  "React.js",
  "Node.js",
  "Express.js",
  "Django",
  "Flask",
  "FastAPI",
  "MongoDB",
  "MySQL",
  "Firebase",
  "PostgreSQL",
  "TensorFlow",
  "PyTorch",
  "Scikit-learn",
  "HTML/CSS",
  "Bootstrap",
  "Tailwind CSS",
  "Streamlit",
  "Flutter",
  "GitHub",
  "Google Colab",
];

const DOMAINS_FALLBACK = [
  "Any Domain",
  "Artificial Intelligence and Machine Learning",
  "Cloud Computing and Distributed Systems",
  "Computer Vision and Image Processing",
  "Cybersecurity",
  "Data Science and Analytics",
  "E-commerce and Recommendation Systems",
  "Education Technology",
  "Healthcare and Medical Technology",
  "Natural Language Processing and Generative AI",
  "Robotics and Automation",
  "Smart Cities and Transportation",
  "Software Engineering and Developer Tools",
  "Web and Mobile Applications",
];

const DEFAULT_PREFERENCES = {
  domain: "Any Domain",
  difficulty: "Any",
  skills: [],
  technologies: [],
  mode: "hybrid",
  top_k: 5,
  weights: { semantic: 0.45, tfidf: 0.3, preference: 0.25 },
};

function App() {
  // Navigation & Sidebar
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Expandable Preferences
  const [showPreferences, setShowPreferences] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [skillInput, setSkillInput] = useState("");
  const [techInput, setTechInput] = useState("");

  // Metadata Catalog
  const [domains, setDomains] = useState(DOMAINS_FALLBACK);
  const [popularSkills, setPopularSkills] = useState(DEFAULT_POPULAR_SKILLS);
  const [popularTechs, setPopularTechs] = useState(DEFAULT_POPULAR_TECHS);

  // Feedback & Bookmarks
  const [feedbackState, setFeedbackState] = useState({});
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarksModal, setShowBookmarksModal] = useState(false);

  // Model Evaluation Modal
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalData, setEvalData] = useState(null);
  const [evalK, setEvalK] = useState(5);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Initial Load: Fetch metadata & list of conversations
  useEffect(() => {
    async function initApp() {
      // 1. Fetch metadata
      try {
        const metaRes = await fetchWithFallback("/metadata");
        if (metaRes.ok) {
          const data = await metaRes.json();
          if (data.domains && data.domains.length > 0) {
            setDomains(["Any Domain", ...data.domains]);
          }
        }
      } catch (e) {
        console.warn("Metadata load fallback:", e);
      }

      // 2. Fetch conversations
      try {
        const convsRes = await fetchWithFallback("/chat/conversations");
        if (convsRes.ok) {
          const convList = await convsRes.json();
          setConversations(convList);
          if (convList.length > 0) {
            loadConversation(convList[0].id);
          } else {
            handleNewChat();
          }
        }
      } catch (e) {
        console.error("Could not load conversations:", e);
        handleNewChat();
      }

      // 3. Fetch bookmarks
      fetchBookmarks();
    }

    initApp();
  }, []);

  // Fetch bookmarks
  async function fetchBookmarks() {
    try {
      const res = await fetchWithFallback("/chat/bookmarks");
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data);
      }
    } catch {
      // Non-critical
    }
  }

  // Create a New Chat
  async function handleNewChat() {
    try {
      setLoading(true);
      const res = await fetchWithFallback("/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Project Exploration",
          preferences: DEFAULT_PREFERENCES,
        }),
      });

      if (!res.ok) throw new Error("Failed to create conversation");
      const newConv = await res.json();

      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      setPreferences(newConv.preferences || DEFAULT_PREFERENCES);

      // Add welcoming introductory assistant message
      setMessages([
        {
          id: "welcome_msg",
          role: "assistant",
          content:
            "👋 **Hello! I'm ProjectIQ**, your AI Academic Project Advisor powered by Google Gemini.\n\nI can help you:\n- **Discover capstone project ideas** tailored to your technical skills and domain.\n- **Retrieve & rank real academic projects** from our curated dataset using Hybrid AI.\n- **Explain project architectures**, implementation steps, and recommended datasets.\n- **Compare different projects** or customize requirements.\n\nType your project requirements below, or open **Project Preferences** to filter by domain, difficulty, or skills!",
          suggestions: [
            "Recommend AI projects for healthcare",
            "Show me beginner Computer Vision projects",
            "I want an IoT smart city capstone project",
            "What can I build with Python and OpenCV?",
          ],
        },
      ]);
    } catch (err) {
      setStatusMessage(err.message || "Could not start new chat.");
    } finally {
      setLoading(false);
    }
  }

  // Load an existing conversation
  async function loadConversation(convId) {
    setActiveConvId(convId);
    setLoading(true);
    setStatusMessage("");

    try {
      // Load details & preferences
      const convRes = await fetchWithFallback(`/chat/conversations/${convId}`);
      if (convRes.ok) {
        const convData = await convRes.json();
        if (convData.preferences) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...convData.preferences });
        }
      }

      // Load message history
      const msgRes = await fetchWithFallback(`/chat/conversations/${convId}/messages`);
      if (msgRes.ok) {
        const msgList = await msgRes.json();
        if (msgList.length === 0) {
          setMessages([
            {
              id: "welcome_msg",
              role: "assistant",
              content:
                "👋 **Welcome back to this conversation!** Ask any question about your project, or type new criteria to get updated recommendations.",
              suggestions: [
                "Recommend AI projects for healthcare",
                "Show me beginner Computer Vision projects",
                "I want an IoT smart city capstone project",
              ],
            },
          ]);
        } else {
          setMessages(msgList);
        }
      }
    } catch (err) {
      setStatusMessage(err.message || "Failed to load conversation messages.");
    } finally {
      setLoading(false);
    }
  }

  // Delete a conversation
  async function handleDeleteConversation(convId, e) {
    e.stopPropagation();
    try {
      await fetchWithFallback(`/chat/conversations/${convId}`, { method: "DELETE" });
      const updated = conversations.filter((c) => c.id !== convId);
      setConversations(updated);

      if (activeConvId === convId) {
        if (updated.length > 0) {
          loadConversation(updated[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error("Delete conversation error:", err);
    }
  }

  // Send a Message
  async function handleSendMessage(messageText = null) {
    const textToSend = (messageText !== null ? messageText : inputValue).trim();
    if (!textToSend || loading) return;

    if (!activeConvId) {
      await handleNewChat();
    }

    const currentConvId = activeConvId;

    // Optimistically add user message
    const tempUserMsg = {
      id: `user_${Date.now()}`,
      role: "user",
      content: textToSend,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInputValue("");
    setLoading(true);
    setStatusMessage("");

    try {
      const response = await fetchWithFallback(
        `/chat/conversations/${currentConvId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: textToSend,
            preferences: preferences,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error generating response.");
      }

      // Add assistant response
      setMessages((prev) => [...prev, data.message]);

      // Update conversation title in list if updated
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConvId
            ? { ...c, updated_at: new Date().toISOString() }
            : c
        )
      );
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: `⚠️ **Error:** ${
            err.message || "Could not connect to the backend server. Please verify FastAPI is running on port 8000."
          }`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Preferences Tag Helpers
  const addPrefTag = (field, val) => {
    const trimmed = val.trim();
    if (trimmed && !preferences[field].includes(trimmed)) {
      const updated = { ...preferences, [field]: [...preferences[field], trimmed] };
      setPreferences(updated);
      savePreferencesToBackend(updated);
    }
  };

  const removePrefTag = (field, val) => {
    const updated = {
      ...preferences,
      [field]: preferences[field].filter((x) => x !== val),
    };
    setPreferences(updated);
    savePreferencesToBackend(updated);
  };

  const handleUpdatePreference = (field, val) => {
    const updated = { ...preferences, [field]: val };
    setPreferences(updated);
    savePreferencesToBackend(updated);
  };

  const handleResetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    savePreferencesToBackend(DEFAULT_PREFERENCES);
  };

  async function savePreferencesToBackend(prefs) {
    if (!activeConvId) return;
    try {
      await fetchWithFallback(`/chat/conversations/${activeConvId}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
    } catch {
      // Non-critical
    }
  }

  // Toggle Project Bookmark
  async function handleToggleBookmark(project) {
    if (!activeConvId) return;

    try {
      const res = await fetchWithFallback("/chat/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConvId,
          project_id: project.id,
          project_title: project.title,
          project_domain: project.domain,
          project_difficulty: project.difficulty_level,
        }),
      });

      if (res.ok) {
        fetchBookmarks();
      }
    } catch (err) {
      console.error("Bookmark toggle error:", err);
    }
  }

  // Feedback (Like / Dislike / Star Rating)
  async function handleFeedback(projectId, projectTitle, type, ratingVal = null) {
    const current = feedbackState[projectId] || {};
    const newLike = type === "like" ? !current.like : false;
    const newDislike = type === "dislike" ? !current.dislike : false;
    const newRating = ratingVal !== null ? ratingVal : current.rating;

    setFeedbackState((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        like: newLike,
        dislike: newDislike,
        rating: newRating,
        submitted: true,
      },
    }));

    try {
      await fetchWithFallback("/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          project_title: projectTitle,
          feedback_type: type,
          rating: newRating || undefined,
          user_query: "Chatbot recommendation feedback",
        }),
      });
    } catch (err) {
      console.error("Feedback submit error:", err);
    }
  }

  // Run Model Evaluation Benchmark
  async function runEvaluation(kVal = 5) {
    setEvalLoading(true);
    setEvalK(kVal);
    try {
      const res = await fetchWithFallback(`/evaluate?k=${kVal}&sample_size=30`);
      if (!res.ok) throw new Error("Evaluation failed.");
      const data = await res.json();
      setEvalData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setEvalLoading(false);
    }
  }

  // Check active preferences count
  const activePrefsCount =
    (preferences.domain !== "Any Domain" ? 1 : 0) +
    (preferences.difficulty !== "Any" ? 1 : 0) +
    preferences.skills.length +
    preferences.technologies.length +
    (preferences.mode !== "hybrid" ? 1 : 0);

  return (
    <div className="chat-layout">
      {/* Sidebar for Conversations */}
      <aside className={`chat-sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
        <div className="sidebar-header">
          <a className="sidebar-logo" href="/">
            ProjectIQ<span>.</span>
          </a>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(false)}
            title="Collapse Sidebar"
          >
            <Sidebar size={16} />
          </button>
        </div>

        <button className="new-chat-btn" onClick={handleNewChat}>
          <Plus size={16} /> New Chat
        </button>

        <div className="conversations-list">
          <span className="conv-section-title">CONVERSATIONS</span>
          {conversations.length === 0 ? (
            <p className="empty-conv-text">No previous conversations.</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`conv-item ${c.id === activeConvId ? "active" : ""}`}
                onClick={() => loadConversation(c.id)}
              >
                <MessageSquare size={14} className="conv-icon" />
                <span className="conv-title">{c.title || "Project Discussion"}</span>
                <button
                  className="conv-delete-btn"
                  onClick={(e) => handleDeleteConversation(c.id, e)}
                  title="Delete Chat"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Footer Actions */}
        <div className="sidebar-footer">
          <button
            className="footer-action-btn"
            onClick={() => setShowBookmarksModal(true)}
          >
            <Bookmark size={15} /> Bookmarked Projects ({bookmarks.length})
          </button>
          <button
            className="footer-action-btn"
            onClick={() => {
              setShowEvalModal(true);
              if (!evalData) runEvaluation(5);
            }}
          >
            <BarChart3 size={15} /> Model Benchmark
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        {/* Top Chat Bar */}
        <header className="chat-topbar">
          {!sidebarOpen && (
            <button
              className="open-sidebar-btn"
              onClick={() => setSidebarOpen(true)}
              title="Open Sidebar"
            >
              <Menu size={18} />
            </button>
          )}

          <div className="topbar-title-group">
            <span className="topbar-title">ProjectIQ AI Advisor</span>
            <span className="gemini-pill">
              <Sparkles size={11} /> Google Gemini + Hybrid ML
            </span>
          </div>

          <div className="topbar-actions">
            <button
              className="benchmark-pill-btn"
              onClick={() => {
                setShowEvalModal(true);
                if (!evalData) runEvaluation(5);
              }}
            >
              <BarChart3 size={14} /> Benchmark
            </button>
          </div>
        </header>

        {/* Messages Feed */}
        <div className="chat-messages-container">
          {messages.map((msg, index) => (
            <div
              key={msg.id || index}
              className={`message-row ${msg.role === "user" ? "user-row" : "assistant-row"}`}
            >
              <div className="message-avatar">
                {msg.role === "user" ? (
                  <div className="user-avatar-circle">You</div>
                ) : (
                  <div className="assistant-avatar-circle">
                    <Sparkles size={14} />
                  </div>
                )}
              </div>

              <div className="message-content-wrapper">
                <div className="message-bubble">
                  {/* Markdown-style formatted text */}
                  <div
                    className="message-markdown"
                    dangerouslySetInnerHTML={{
                      __html: formatMarkdown(msg.content),
                    }}
                  />

                  {/* Embedded Project Cards */}
                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="chat-recommendations-grid">
                      <div className="grid-header-label">
                        <Sparkles size={13} /> {msg.recommendations.length} Grounded Project Recommendations:
                      </div>

                      {msg.recommendations.map((proj) => {
                        const isBookmarked = bookmarks.some(
                          (b) => b.project_id === proj.id
                        );
                        const currentFb = feedbackState[proj.id] || {};
                        const matchPct = Math.round(proj.similarity_score * 100);

                        return (
                          <div className="chat-project-card" key={proj.id}>
                            <div className="proj-card-header">
                              <div className="proj-rank-id">
                                <span className="proj-rank">#{proj.rank}</span>
                                <span className="proj-id">[{proj.id}]</span>
                                <span
                                  className={`proj-diff diff-${proj.difficulty_level?.toLowerCase()}`}
                                >
                                  {proj.difficulty_level}
                                </span>
                              </div>
                              <button
                                className={`bookmark-icon-btn ${isBookmarked ? "bookmarked" : ""}`}
                                onClick={() => handleToggleBookmark(proj)}
                                title={isBookmarked ? "Remove Bookmark" : "Bookmark Project"}
                              >
                                {isBookmarked ? (
                                  <BookmarkCheck size={16} />
                                ) : (
                                  <Bookmark size={16} />
                                )}
                              </button>
                            </div>

                            <h4 className="proj-title">{proj.title}</h4>
                            <p className="proj-desc">{proj.description}</p>

                            {/* Why recommended explanation */}
                            <div className="proj-explanation">
                              <strong>💡 Why Recommended:</strong> {proj.recommendation_explanation}
                            </div>

                            {/* Technologies & Skills chips */}
                            <div className="proj-badges-row">
                              {proj.domain && (
                                <span className="domain-chip">{proj.domain}</span>
                              )}
                              {proj.technologies?.slice(0, 4).map((t) => (
                                <span key={t} className="tech-chip">
                                  {t}
                                </span>
                              ))}
                            </div>

                            {/* Score Breakdown Bar */}
                            <div className="proj-score-box">
                              <div className="score-top-line">
                                <span>Match Score:</span>
                                <strong>{matchPct}%</strong>
                              </div>
                              <div className="progress-bar">
                                <div
                                  className="progress-fill"
                                  style={{ width: `${Math.min(100, matchPct)}%` }}
                                />
                              </div>
                              <div className="score-sub-metrics">
                                <span>🧠 Sem: {(proj.semantic_score * 100).toFixed(0)}%</span>
                                <span>📄 TF-IDF: {(proj.tfidf_score * 100).toFixed(0)}%</span>
                                <span>🎯 Pref: {(proj.preference_score * 100).toFixed(0)}%</span>
                              </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="proj-card-footer">
                              <button
                                className="ask-details-btn"
                                onClick={() =>
                                  handleSendMessage(
                                    `Tell me more about Project #${proj.rank} (${proj.title}). What architecture, dataset, and libraries should I use?`
                                  )
                                }
                              >
                                Ask details about this <ArrowRight size={12} />
                              </button>

                              <div className="card-feedback-group">
                                <button
                                  className={`fb-mini-btn ${currentFb.like ? "active-like" : ""}`}
                                  onClick={() => handleFeedback(proj.id, proj.title, "like")}
                                  title="Like"
                                >
                                  <ThumbsUp size={12} />
                                </button>
                                <button
                                  className={`fb-mini-btn ${currentFb.dislike ? "active-dislike" : ""}`}
                                  onClick={() => handleFeedback(proj.id, proj.title, "dislike")}
                                  title="Dislike"
                                >
                                  <ThumbsDown size={12} />
                                </button>
                                <div className="mini-star-rating">
                                  {[1, 2, 3, 4, 5].map((sVal) => (
                                    <Star
                                      key={sVal}
                                      size={13}
                                      className={`mini-star ${(currentFb.rating || 0) >= sVal ? "star-active" : ""}`}
                                      onClick={() => handleFeedback(proj.id, proj.title, "rating", sVal)}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Clickable Follow-up Suggestions */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="suggestions-pill-group">
                      <span className="suggestions-label">Suggested Follow-ups:</span>
                      {msg.suggestions.map((sug, i) => (
                        <button
                          key={i}
                          className="suggestion-pill"
                          onClick={() => handleSendMessage(sug)}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Assistant Loading State */}
          {loading && (
            <div className="message-row assistant-row">
              <div className="message-avatar">
                <div className="assistant-avatar-circle">
                  <Sparkles size={14} />
                </div>
              </div>
              <div className="message-content-wrapper">
                <div className="message-bubble typing-bubble">
                  <span className="dot dot-1"></span>
                  <span className="dot dot-2"></span>
                  <span className="dot dot-3"></span>
                  <span className="typing-text">Gemini & ML Hybrid Engine thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Message Composer Area */}
        <div className="composer-container">
          {/* Active Preferences Chips Bar */}
          <div className="active-prefs-bar">
            <button
              className={`prefs-toggle-btn ${showPreferences ? "active" : ""}`}
              onClick={() => setShowPreferences(!showPreferences)}
            >
              <Sliders size={13} />
              <span>Project Preferences {activePrefsCount > 0 && `(${activePrefsCount})`}</span>
              {showPreferences ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>

            {/* Display active preferences chips */}
            {preferences.domain !== "Any Domain" && (
              <span className="pref-tag">
                Domain: {preferences.domain}
                <X size={11} onClick={() => handleUpdatePreference("domain", "Any Domain")} />
              </span>
            )}
            {preferences.difficulty !== "Any" && (
              <span className="pref-tag">
                Diff: {preferences.difficulty}
                <X size={11} onClick={() => handleUpdatePreference("difficulty", "Any")} />
              </span>
            )}
            {preferences.skills.map((s) => (
              <span key={s} className="pref-tag skill-tag">
                {s}
                <X size={11} onClick={() => removePrefTag("skills", s)} />
              </span>
            ))}
            {preferences.technologies.map((t) => (
              <span key={t} className="pref-tag tech-tag">
                {t}
                <X size={11} onClick={() => removePrefTag("technologies", t)} />
              </span>
            ))}
            {preferences.mode !== "hybrid" && (
              <span className="pref-tag mode-tag">
                Mode: {preferences.mode}
                <X size={11} onClick={() => handleUpdatePreference("mode", "hybrid")} />
              </span>
            )}

            {activePrefsCount > 0 && (
              <button className="clear-prefs-btn" onClick={handleResetPreferences}>
                Reset all
              </button>
            )}
          </div>

          {/* Expandable Preferences Section */}
          {showPreferences && (
            <div className="expanded-prefs-card">
              <div className="prefs-grid">
                {/* 1. Preferred Domain */}
                <div className="pref-group">
                  <label>
                    <Target size={13} /> Preferred Domain
                  </label>
                  <select
                    value={preferences.domain}
                    onChange={(e) => handleUpdatePreference("domain", e.target.value)}
                    className="pref-select"
                  >
                    {domains.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Difficulty Level */}
                <div className="pref-group">
                  <label>
                    <Layers size={13} /> Difficulty Level
                  </label>
                  <div className="pref-pill-row">
                    {["Any", "Beginner", "Intermediate", "Advanced"].map((lvl) => (
                      <button
                        type="button"
                        key={lvl}
                        className={`pill-btn-sm ${preferences.difficulty === lvl ? "active" : ""}`}
                        onClick={() => handleUpdatePreference("difficulty", lvl)}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Recommendation Mode & Top K */}
                <div className="pref-group">
                  <label>
                    <Sparkles size={13} /> Engine Mode & Quantity
                  </label>
                  <div className="pref-pill-row">
                    <button
                      type="button"
                      className={`pill-btn-sm ${preferences.mode === "hybrid" ? "active" : ""}`}
                      onClick={() => handleUpdatePreference("mode", "hybrid")}
                    >
                      🚀 Hybrid
                    </button>
                    <button
                      type="button"
                      className={`pill-btn-sm ${preferences.mode === "semantic_only" ? "active" : ""}`}
                      onClick={() => handleUpdatePreference("mode", "semantic_only")}
                    >
                      🧠 Semantic
                    </button>
                    <button
                      type="button"
                      className={`pill-btn-sm ${preferences.mode === "tfidf_only" ? "active" : ""}`}
                      onClick={() => handleUpdatePreference("mode", "tfidf_only")}
                    >
                      📄 TF-IDF
                    </button>
                    <span className="divider-vert" />
                    <button
                      type="button"
                      className={`pill-btn-sm ${preferences.top_k === 5 ? "active" : ""}`}
                      onClick={() => handleUpdatePreference("top_k", 5)}
                    >
                      Top 5
                    </button>
                    <button
                      type="button"
                      className={`pill-btn-sm ${preferences.top_k === 10 ? "active" : ""}`}
                      onClick={() => handleUpdatePreference("top_k", 10)}
                    >
                      Top 10
                    </button>
                  </div>
                </div>

                {/* 4. Skills Input */}
                <div className="pref-group full-width">
                  <label>
                    <Cpu size={13} /> Your Skills
                  </label>
                  <div className="tag-input-box">
                    {preferences.skills.map((s) => (
                      <span key={s} className="inner-tag-chip skill-inner-tag">
                        {s}
                        <X size={12} onClick={() => removePrefTag("skills", s)} />
                      </span>
                    ))}
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addPrefTag("skills", skillInput);
                          setSkillInput("");
                        }
                      }}
                      placeholder={preferences.skills.length === 0 ? "Type skill & press Enter or click suggestions below..." : "Type more skills..."}
                      className="pref-tag-input"
                    />
                  </div>
                  <div className="suggested-chips-row">
                    <span className="chips-label">Suggestions:</span>
                    {popularSkills.map((s) => (
                      <button
                        type="button"
                        key={s}
                        className={`mini-chip ${preferences.skills.includes(s) ? "selected" : ""}`}
                        onClick={() =>
                          preferences.skills.includes(s)
                            ? removePrefTag("skills", s)
                            : addPrefTag("skills", s)
                        }
                      >
                        {preferences.skills.includes(s) ? "✓ " : "+ "}
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Technologies Input */}
                <div className="pref-group full-width">
                  <label>
                    <Wrench size={13} /> Preferred Technologies
                  </label>
                  <div className="tag-input-box">
                    {preferences.technologies.map((t) => (
                      <span key={t} className="inner-tag-chip tech-inner-tag">
                        {t}
                        <X size={12} onClick={() => removePrefTag("technologies", t)} />
                      </span>
                    ))}
                    <input
                      type="text"
                      value={techInput}
                      onChange={(e) => setTechInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addPrefTag("technologies", techInput);
                          setTechInput("");
                        }
                      }}
                      placeholder={preferences.technologies.length === 0 ? "Type framework (e.g. FastAPI, PyTorch) & press Enter or click suggestions below..." : "Type more technologies..."}
                      className="pref-tag-input"
                    />
                  </div>
                  <div className="suggested-chips-row">
                    <span className="chips-label">Suggestions:</span>
                    {popularTechs.map((t) => (
                      <button
                        type="button"
                        key={t}
                        className={`mini-chip ${preferences.technologies.includes(t) ? "selected" : ""}`}
                        onClick={() =>
                          preferences.technologies.includes(t)
                            ? removePrefTag("technologies", t)
                            : addPrefTag("technologies", t)
                        }
                      >
                        {preferences.technologies.includes(t) ? "✓ " : "+ "}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. Advanced Weight Tuning Toggle */}
                {preferences.mode === "hybrid" && (
                  <div className="pref-group full-width">
                    <button
                      type="button"
                      className="weight-tune-toggle"
                      onClick={() => setShowWeights(!showWeights)}
                    >
                      <Sliders size={12} /> {showWeights ? "Hide Weight Tuning" : "Tune Hybrid Weights"}
                    </button>

                    {showWeights && (
                      <div className="weights-slider-grid">
                        <div className="slider-item">
                          <span>Semantic (Sentence Transformers): {Math.round(preferences.weights.semantic * 100)}%</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={preferences.weights.semantic}
                            onChange={(e) =>
                              handleUpdatePreference("weights", {
                                ...preferences.weights,
                                semantic: parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="slider-item">
                          <span>TF-IDF Keyword Similarity: {Math.round(preferences.weights.tfidf * 100)}%</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={preferences.weights.tfidf}
                            onChange={(e) =>
                              handleUpdatePreference("weights", {
                                ...preferences.weights,
                                tfidf: parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="slider-item">
                          <span>Preference Alignment: {Math.round(preferences.weights.preference * 100)}%</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={preferences.weights.preference}
                            onChange={(e) =>
                              handleUpdatePreference("weights", {
                                ...preferences.weights,
                                preference: parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat Input Bar */}
          <form
            className="chat-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Describe your project requirements, ask for recommendations, or ask questions about any project... (Enter to send)"
              rows={2}
              className="chat-textarea"
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={loading || !inputValue.trim()}
              title="Send Message"
            >
              {loading ? <RotateCcw size={16} className="spinner" /> : <Send size={16} />}
            </button>
          </form>

          {statusMessage && <p className="chat-status-msg">{statusMessage}</p>}
        </div>
      </main>

      {/* Bookmarks Modal */}
      {showBookmarksModal && (
        <div className="modal-backdrop" onClick={() => setShowBookmarksModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <Bookmark size={20} className="icon-emerald" />
                <h3>Bookmarked Projects ({bookmarks.length})</h3>
              </div>
              <button className="close-btn" onClick={() => setShowBookmarksModal(false)}>
                <X size={18} />
              </button>
            </div>

            {bookmarks.length === 0 ? (
              <p className="empty-text">No bookmarked projects yet. Click the bookmark icon on any recommended project card to save it here!</p>
            ) : (
              <div className="bookmarks-list">
                {bookmarks.map((b) => (
                  <div key={b.id || b.project_id} className="bookmark-card">
                    <div>
                      <span className="bookmark-id">[{b.project_id}]</span>
                      <h4 className="bookmark-title">{b.project_title || `Project ${b.project_id}`}</h4>
                      <p className="bookmark-meta">
                        {b.project_domain} • {b.project_difficulty}
                      </p>
                    </div>
                    <button
                      className="bookmark-inquire-btn"
                      onClick={() => {
                        setShowBookmarksModal(false);
                        handleSendMessage(
                          `Tell me more about bookmarked project ${b.project_id}: ${b.project_title}. How do I implement it?`
                        );
                      }}
                    >
                      Inquire in Chat <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Benchmark & Model Evaluation Modal */}
      {showEvalModal && (
        <div className="modal-backdrop" onClick={() => setShowEvalModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <BarChart3 size={20} className="icon-emerald" />
                <h3>AI Model Benchmark & Evaluation</h3>
              </div>
              <button className="close-btn" onClick={() => setShowEvalModal(false)}>
                <X size={18} />
              </button>
            </div>

            <p className="modal-desc">
              Empirical evaluation comparing <strong>TF-IDF</strong>,{" "}
              <strong>Sentence Transformers (all-MiniLM-L6-v2)</strong>, and the{" "}
              <strong>Hybrid Recommendation Engine</strong> across 1,210 labeled ground-truth similarity pairs.
            </p>

            <div className="k-toggle-row">
              <span>Metric Cutoff:</span>
              <button
                className={`k-pill ${evalK === 5 ? "active" : ""}`}
                onClick={() => runEvaluation(5)}
              >
                K = 5
              </button>
              <button
                className={`k-pill ${evalK === 10 ? "active" : ""}`}
                onClick={() => runEvaluation(10)}
              >
                K = 10
              </button>
            </div>

            {evalLoading ? (
              <div className="eval-loading">
                <RotateCcw className="spinner" size={24} />
                <p>Computing Precision@{evalK}, Recall@{evalK}, and F1@{evalK} on ground truth...</p>
              </div>
            ) : evalData?.models_evaluated ? (
              <div className="eval-results">
                <table className="benchmark-table">
                  <thead>
                    <tr>
                      <th>Algorithm</th>
                      <th>Precision@{evalK}</th>
                      <th>Recall@{evalK}</th>
                      <th>F1-Score</th>
                      <th>Hits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(evalData.models_evaluated).map(([mKey, mVal]) => (
                      <tr key={mKey} className={mKey === "hybrid" ? "row-highlight" : ""}>
                        <td>
                          <strong>{mVal.model_name}</strong>
                          {mKey === "hybrid" && <span className="best-tag">Highest Balance</span>}
                        </td>
                        <td>{(mVal.precision_at_k * 100).toFixed(1)}%</td>
                        <td>{(mVal.recall_at_k * 100).toFixed(1)}%</td>
                        <td>{(mVal.f1_score * 100).toFixed(1)}%</td>
                        <td>{mVal.total_hits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="eval-notes">
                  <p>
                    <strong>Dataset Reference:</strong> Evaluated on{" "}
                    <code>projectiq_similarity_ground_truth.csv</code> and{" "}
                    <code>projectiq_student_ideas.csv</code>.
                  </p>
                  <p>
                    <strong>Grounded RAG:</strong> Gemini explains projects directly retrieved by this hybrid engine without hallucinating fictional projects.
                  </p>
                </div>
              </div>
            ) : (
              <p>No evaluation data loaded.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Simple safe markdown formatter for assistant messages
function formatMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Inline Code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");
  // Bullet points
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/gms, "<ul>$1</ul>");
  // Newlines
  html = html.replace(/\n\n/g, "<br/><br/>");

  return html;
}

export default App;
