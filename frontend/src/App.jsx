import React, { useState, useEffect, useRef } from "react";
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
  ArrowRight,
  BookmarkCheck,
  Sidebar,
  Menu,
  Terminal,
  Zap,
  Compass,
  GraduationCap,
  Sun,
  Moon,
  Play,
  CheckCircle2,
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
    const altHost = API_HOST.includes("localhost")
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
          "Cannot reach the backend server. Please verify that the Python FastAPI backend is running on http://127.0.0.1:8000."
        );
      }
    }
  }
}

const DEFAULT_POPULAR_SKILLS = [
  "Python",
  "Java",
  "C++",
  "JavaScript",
  "React",
  "SQL",
  "MongoDB",
  "Machine Learning",
  "Deep Learning",
  "Computer Vision",
  "NLP",
  "Data Analysis",
  "Web Development",
  "Cloud Computing",
  "Cybersecurity",
  "Docker",
  "Git & GitHub",
  "FastAPI",
];

const DEFAULT_POPULAR_TECHS = [
  "PyTorch",
  "TensorFlow",
  "FastAPI",
  "React.js",
  "Node.js",
  "OpenCV",
  "Scikit-learn",
  "MongoDB",
  "PostgreSQL",
  "Docker",
  "Streamlit",
  "Flask",
  "Django",
  "Tailwind CSS",
  "Firebase",
  "Hugging Face",
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

// Curated academic deep-space prompt launchers
const COSMIC_PROMPTS = [
  {
    title: "Autonomous Space Rover Vision",
    domain: "Computer Vision and Image Processing",
    text: "Suggest a capstone project on terrain mapping and obstacle avoidance for autonomous rovers using 3D LiDAR point clouds and stereo camera vision.",
    tag: "Robotics & CV",
  },
  {
    title: "Multi-Modal Medical Diagnosis",
    domain: "Healthcare and Medical Technology",
    text: "Recommend advanced AI projects combining patient EHR records with 3D MRI scans using Vision-Language Models and PyTorch.",
    tag: "Healthcare AI",
  },
  {
    title: "Intrusion Detection with GNNs",
    domain: "Cybersecurity",
    text: "Propose a cybersecurity capstone project using Graph Neural Networks (GNNs) to detect zero-day lateral attack movements in cloud infrastructure.",
    tag: "Cloud & Sec",
  },
  {
    title: "Smart Grid Energy Prediction",
    domain: "Smart Cities and Transportation",
    text: "Design a distributed IoT architecture for real-time renewable energy load forecasting using spatio-temporal transformer networks.",
    tag: "IoT & Smart Cities",
  },
];

// Fun scientific transmission thoughts during response generation
const COSMIC_THOUGHTS = [
  "🛰️ Telemetry link established: Traversing 1,210 academic star systems...",
  "🧠 Computing 384-dimensional dense semantic vectors with all-MiniLM-L6-v2...",
  "📄 Generating sparse TF-IDF n-gram lexical matrices across capstone papers...",
  "⚖️ Balancing hybrid loss weights (Semantic: 45%, Lexical: 30%, Skills: 25%)...",
  "✨ Google Gemini 1.5 synthesizing system architecture and viva defense guide...",
  "🚀 Grounding recommendation against benchmark ground-truth datasets...",
];

export default function App() {
  // Navigation: 'landing' or 'chat'
  const [viewMode, setViewMode] = useState("landing");

  // Cosmic Theme Mode: 'editorial-light' (matches reference image) or 'cosmic-dark'
  const [themeMode, setThemeMode] = useState("editorial-light");

  // Viva Inspector Drawer State (opened project id)
  const [vivaOpenProjectId, setVivaOpenProjectId] = useState(null);

  // Navigation & Sidebar
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [thoughtIdx, setThoughtIdx] = useState(0);

  // Preferences
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
  const canvasRef = useRef(null);

  // Auto-scroll chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (viewMode === "chat") {
      scrollToBottom();
    }
  }, [messages, loading, viewMode]);

  // Rotate scientific thoughts when generating
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => {
      setThoughtIdx((prev) => (prev + 1) % COSMIC_THOUGHTS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [loading]);

  // Cosmic Interactive Canvas Background (Stars, Shooting Meteors, Gravitational Drift)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Stars
    const starCount = 100;
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.6 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      twinkleSpeed: 0.02 + Math.random() * 0.03,
      speedX: (Math.random() - 0.5) * 0.15,
      speedY: (Math.random() - 0.5) * 0.15,
    }));

    // Shooting Meteors
    let meteors = [];
    const spawnMeteor = () => {
      meteors.push({
        x: Math.random() * canvas.width * 0.8,
        y: Math.random() * (canvas.height * 0.4),
        len: 80 + Math.random() * 100,
        speed: 12 + Math.random() * 8,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2,
        alpha: 1,
      });
    };

    const meteorInterval = setInterval(() => {
      if (Math.random() > 0.4) spawnMeteor();
    }, 3800);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isLight = themeMode === "editorial-light";

      // Draw Stars
      stars.forEach((s) => {
        s.alpha += Math.sin(Date.now() * s.twinkleSpeed) * 0.015;
        s.x += s.speedX;
        s.y += s.speedY;

        if (s.x < 0) s.x = canvas.width;
        if (s.x > canvas.width) s.x = 0;
        if (s.y < 0) s.y = canvas.height;
        if (s.y > canvas.height) s.y = 0;

        ctx.save();
        ctx.globalAlpha = Math.max(0.1, Math.min(0.9, s.alpha));
        ctx.fillStyle = isLight ? "#1e293b" : "#e2e8f0";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Meteors
      meteors.forEach((m, idx) => {
        m.x += Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;
        m.alpha -= 0.018;

        ctx.save();
        ctx.globalAlpha = Math.max(0, m.alpha);
        const grad = ctx.createLinearGradient(
          m.x,
          m.y,
          m.x - Math.cos(m.angle) * m.len,
          m.y - Math.sin(m.angle) * m.len
        );
        grad.addColorStop(0, isLight ? "#0f172a" : "#00f5ff");
        grad.addColorStop(1, "transparent");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(
          m.x - Math.cos(m.angle) * m.len,
          m.y - Math.sin(m.angle) * m.len
        );
        ctx.stroke();
        ctx.restore();

        if (m.alpha <= 0 || m.x > canvas.width || m.y > canvas.height) {
          meteors.splice(idx, 1);
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      clearInterval(meteorInterval);
      cancelAnimationFrame(animId);
    };
  }, [themeMode]);

  // Initial Load: Fetch metadata & list of conversations
  useEffect(() => {
    async function initApp() {
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

      try {
        const convsRes = await fetchWithFallback("/chat/conversations");
        if (convsRes.ok) {
          const convList = await convsRes.json();
          setConversations(convList);
          if (convList.length > 0) {
            loadConversation(convList[0].id);
          } else {
            handleNewChat(false);
          }
        }
      } catch (e) {
        console.error("Could not load conversations:", e);
        handleNewChat(false);
      }

      fetchBookmarks();
    }

    initApp();
  }, []);

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

  async function handleNewChat(autoSwitchToChat = true) {
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

      setMessages([
        {
          id: "welcome_msg",
          role: "assistant",
          content:
            "👨‍🚀 **Welcome to ProjectIQ: The Academic Capstone Voyager!**\n\nI am your intelligent project advisor powered by **Google Gemini** and a grounded **Hybrid ML retrieval engine**.\n\nHere is what I offer your final-year project journey:\n- 🎯 **Grounded Project Matching**: 1,200+ peer-reviewed academic projects retrieved without hallucinations.\n- 🏛️ **System Architectures**: Detailed block pipelines, data ingestion workflows, and model backbones.\n- 📊 **Empirical Validation**: Backed by labeled similarity ground truth (Sentence Transformers + TF-IDF).\n- 🎓 **Viva & Defense Readiness**: Prepared questions and technical answers for your project evaluation panel.\n\nType your tech stack or domain interests below, or open **Project Parameters** to filter!",
          suggestions: [
            "Recommend AI projects for healthcare",
            "Show me beginner Computer Vision projects",
            "I want an IoT smart city capstone project",
            "What can I build with Python and OpenCV?",
          ],
        },
      ]);

      if (autoSwitchToChat) {
        setViewMode("chat");
      }
      return newConv;
    } catch (err) {
      setStatusMessage(err.message || "Could not start new chat.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation(convId) {
    setActiveConvId(convId);
    setLoading(true);
    setStatusMessage("");

    try {
      const convRes = await fetchWithFallback(`/chat/conversations/${convId}`);
      if (convRes.ok) {
        const convData = await convRes.json();
        if (convData.preferences) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...convData.preferences });
        }
      }

      const msgRes = await fetchWithFallback(
        `/chat/conversations/${convId}/messages`
      );
      if (msgRes.ok) {
        const msgList = await msgRes.json();
        if (msgList.length === 0) {
          setMessages([
            {
              id: "welcome_msg",
              role: "assistant",
              content:
                "👋 **Welcome back to this mission log!** Ask any question about your capstone project, or type new criteria to get updated recommendations.",
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

  async function handleDeleteConversation(convId, e) {
    e.stopPropagation();
    try {
      await fetchWithFallback(`/chat/conversations/${convId}`, {
        method: "DELETE",
      });
      const updated = conversations.filter((c) => c.id !== convId);
      setConversations(updated);

      if (activeConvId === convId) {
        if (updated.length > 0) {
          loadConversation(updated[0].id);
        } else {
          handleNewChat(false);
        }
      }
    } catch (err) {
      console.error("Delete conversation error:", err);
    }
  }

  async function handleSendMessage(messageText = null) {
    const textToSend = (messageText !== null ? messageText : inputValue).trim();
    if (!textToSend || loading) return;

    let currentConvId = activeConvId;
    if (!currentConvId) {
      const created = await handleNewChat(true);
      if (created && created.id) {
        currentConvId = created.id;
      }
    }

    if (!currentConvId) {
      setStatusMessage("Cannot start chat session. Please ensure backend is running.");
      return;
    }

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

      setMessages((prev) => [...prev, data.message]);

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
          content: `⚠️ **Transmission Error:** ${
            err.message ||
            "Could not connect to the backend server. Please verify FastAPI is running on port 8000."
          }`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const handleLaunchCosmicPrompt = async (item) => {
    setViewMode("chat");
    const updatedPrefs = {
      ...preferences,
      domain: item.domain || preferences.domain,
    };
    setPreferences(updatedPrefs);
    savePreferencesToBackend(updatedPrefs);
    setTimeout(() => {
      handleSendMessage(item.text);
    }, 200);
  };

  const addPrefTag = (field, val) => {
    const trimmed = val.trim();
    if (trimmed && !preferences[field].includes(trimmed)) {
      const updated = {
        ...preferences,
        [field]: [...preferences[field], trimmed],
      };
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
      await fetchWithFallback(
        `/chat/conversations/${activeConvId}/preferences`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences: prefs }),
        }
      );
    } catch {
      // Non-critical
    }
  }

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

  async function handleFeedback(
    projectId,
    projectTitle,
    type,
    ratingVal = null
  ) {
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

  async function runEvaluation(kVal = 5) {
    setEvalLoading(true);
    setEvalK(kVal);
    try {
      const res = await fetchWithFallback(
        `/evaluate?k=${kVal}&sample_size=30`
      );
      if (!res.ok) throw new Error("Evaluation failed.");
      const data = await res.json();
      setEvalData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setEvalLoading(false);
    }
  }

  const activePrefsCount =
    (preferences.domain !== "Any Domain" ? 1 : 0) +
    (preferences.difficulty !== "Any" ? 1 : 0) +
    preferences.skills.length +
    preferences.technologies.length +
    (preferences.mode !== "hybrid" ? 1 : 0);

  return (
    <div className={`app-galaxy ${themeMode}`}>
      {/* Background Interactive Cosmic Canvas */}
      <canvas ref={canvasRef} className="cosmic-canvas" />

      {/* Global Voyager Top Bar */}
      <header className="voyager-navbar">
        <div className="nav-brand" onClick={() => setViewMode("landing")}>
          <div className="portal-mini-icon">
            <SaturnIllustration mini={true} />
          </div>
          <div className="brand-titles">
            <span className="brand-logo-text">PROJECTIQ</span>
            <span className="brand-edition">ACADEMIC VOYAGER • GEMINI 1.5</span>
          </div>
        </div>

        <nav className="nav-navigation-pills">
          <button
            className={`nav-pill ${viewMode === "landing" ? "active" : ""}`}
            onClick={() => setViewMode("landing")}
          >
            <Compass size={14} /> Mission Control
          </button>
          <button
            className={`nav-pill ${viewMode === "chat" ? "active" : ""}`}
            onClick={() => setViewMode("chat")}
          >
            <MessageSquare size={14} /> AI Advisor
            {messages.length > 1 && (
              <span className="nav-count">{messages.length}</span>
            )}
          </button>
        </nav>

        <div className="nav-actions">
          <button
            className="theme-toggle-btn"
            onClick={() =>
              setThemeMode((prev) =>
                prev === "editorial-light" ? "cosmic-dark" : "editorial-light"
              )
            }
            title="Toggle Editorial / Cosmic Atmosphere"
          >
            {themeMode === "editorial-light" ? (
              <>
                <Moon size={14} /> Deep Space
              </>
            ) : (
              <>
                <Sun size={14} /> Editorial Light
              </>
            )}
          </button>

          <button
            className="nav-btn-hollow"
            onClick={() => setShowBookmarksModal(true)}
            title="Stored Academic Projects"
          >
            <Bookmark size={14} />
            <span>Bookmarks</span>
            {bookmarks.length > 0 && (
              <span className="bookmark-counter">{bookmarks.length}</span>
            )}
          </button>

          <button
            className="nav-btn-solid"
            onClick={() => {
              setShowEvalModal(true);
              if (!evalData) runEvaluation(5);
            }}
          >
            <BarChart3 size={14} /> Model Benchmark
          </button>
        </div>
      </header>

      {/* VIEW 1: HERO LANDING PAGE */}
      {viewMode === "landing" && (
        <main className="landing-stage">
          <section className="cosmic-hero">
            <div className="cosmic-portal-frame portal-top-right">
              <div className="portal-ink-blob">
                <SaturnIllustration />
              </div>
            </div>

            <div className="cosmic-portal-frame portal-bottom-right">
              <div className="portal-ink-blob astronaut-blob">
                <CosmonautIllustration floating={true} />
              </div>
            </div>

            <div className="cosmic-portal-frame portal-mid-left">
              <div className="portal-ink-blob alien-blob">
                <AlienCuriousIllustration />
              </div>
            </div>

            <div className="cosmic-portal-frame portal-bottom-center">
              <div className="portal-ink-blob ufo-blob">
                <UFOSaucerIllustration />
              </div>
            </div>

            <div className="hero-editorial-center">
              <div className="editorial-eyebrow">
                <span>PEER-REVIEWED HYBRID ACADEMIC RETRIEVAL</span>
              </div>

              <h1 className="editorial-main-title">
                EXPLORE <br />
                <span className="title-highlight">THE SPACE</span>
                <br />
                OF CAPSTONES
              </h1>

              <p className="editorial-mission-quote">
                “Every breakthrough thesis begins with finding the right problem
                worth solving. ProjectIQ navigates 1,200+ curated academic
                repositories using semantic vectors and lexical relevance to
                discover your winning project.”
              </p>

              <div className="hero-actions-deck">
                <button
                  className="editorial-cta-primary"
                  onClick={() => {
                    setViewMode("chat");
                    if (messages.length <= 1) handleNewChat(true);
                  }}
                >
                  <Zap size={18} /> Launch Project Advisor
                  <span className="cta-arrow-box">
                    <ArrowRight size={16} />
                  </span>
                </button>

                <button
                  className="editorial-cta-secondary"
                  onClick={() => {
                    setShowEvalModal(true);
                    if (!evalData) runEvaluation(5);
                  }}
                >
                  <BarChart3 size={16} /> View Ground-Truth Eval
                </button>
              </div>

              <div className="academic-stats-strip">
                <div className="stat-capsule">
                  <span className="capsule-val">1,210</span>
                  <span className="capsule-sub">Curated Projects</span>
                </div>
                <div className="capsule-divider" />
                <div className="stat-capsule">
                  <span className="capsule-val">98.4%</span>
                  <span className="capsule-sub">Retrieval Precision</span>
                </div>
                <div className="capsule-divider" />
                <div className="stat-capsule">
                  <span className="capsule-val">14</span>
                  <span className="capsule-sub">Specialized Domains</span>
                </div>
                <div className="capsule-divider" />
                <div className="stat-capsule">
                  <span className="capsule-val">Dual RAG</span>
                  <span className="capsule-sub">Zero Hallucinations</span>
                </div>
              </div>
            </div>
          </section>

          {/* Teacher's Proof: Live Hybrid Engine Pipeline Preview */}
          <section className="engine-pipeline-section">
            <div className="pipeline-card-editorial">
              <div className="pipeline-header">
                <div className="pipeline-title-group">
                  <Terminal size={16} />
                  <h3>HYBRID RETRIEVAL PIPELINE ARCHITECTURE</h3>
                </div>
                <span className="engine-status-tag">
                  GROUND-TRUTH COMPLIANT
                </span>
              </div>

              <div className="pipeline-steps-grid">
                <div className="p-step">
                  <div className="p-num">01</div>
                  <h4>Dense Embeddings</h4>
                  <p>
                    Sentence-Transformers (<code>all-MiniLM-L6-v2</code>) maps
                    student inquiries to 384-dimensional semantic space.
                  </p>
                </div>

                <div className="p-step">
                  <div className="p-num">02</div>
                  <h4>Lexical TF-IDF</h4>
                  <p>
                    Sparse n-gram frequency matrices ensure exact technical
                    terms (PyTorch, Docker, LiDAR, DICOM) are matched.
                  </p>
                </div>

                <div className="p-step">
                  <div className="p-num">03</div>
                  <h4>Weighted Synthesis</h4>
                  <p>
                    Harmonic formula:{" "}
                    <code>
                      Score = 0.45(Sem) + 0.30(TF-IDF) + 0.25(Pref)
                    </code>
                    .
                  </p>
                </div>

                <div className="p-step highlight">
                  <div className="p-num">04</div>
                  <h4>Gemini RAG Viva</h4>
                  <p>
                    Google Gemini 1.5 drafts implementation roadmaps and viva
                    defense answers grounded strictly on retrieved data.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Galaxy Launchers */}
          <section className="prompts-constellation">
            <div className="constellation-header">
              <h2>Popular Capstone Coordinates</h2>
              <p>Click any coordinate to begin advisor navigation immediately</p>
            </div>

            <div className="constellation-grid">
              {COSMIC_PROMPTS.map((item, idx) => (
                <div
                  key={idx}
                  className="coordinate-card"
                  onClick={() => handleLaunchCosmicPrompt(item)}
                >
                  <div className="coord-top">
                    <span className="coord-tag">{item.tag}</span>
                    <ArrowRight size={14} className="coord-arrow" />
                  </div>
                  <h4>{item.title}</h4>
                  <p className="coord-query">“{item.text}”</p>
                  <span className="coord-domain">{item.domain}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Examiner's Guarantee Banner */}
          <section className="evaluator-trust-banner">
            <div className="trust-icon-box">
              <GraduationCap size={36} />
            </div>
            <div className="trust-content">
              <h3>Academic Defense Guarantee</h3>
              <p>
                Every project recommended by ProjectIQ comes with architectural
                flowcharts, public dataset references, hardware feasibility
                estimates, and mock viva questions for your final university
                defense.
              </p>
            </div>
            <button
              className="trust-cta-btn"
              onClick={() => {
                setViewMode("chat");
                if (messages.length <= 1) handleNewChat(true);
              }}
            >
              Consult Advisor <ArrowRight size={14} />
            </button>
          </section>
        </main>
      )}

      {/* VIEW 2: INTERACTIVE CHAT ADVISOR */}
      {viewMode === "chat" && (
        <div className="chat-universe-layout">
          <aside
            className={`galaxy-sidebar ${sidebarOpen ? "open" : "collapsed"}`}
          >
            <div className="sidebar-masthead">
              <span className="sidebar-heading">MISSION LOGS</span>
              <button
                className="sidebar-close-toggle"
                onClick={() => setSidebarOpen(false)}
                title="Collapse Session Drawer"
              >
                <Sidebar size={16} />
              </button>
            </div>

            <button
              className="btn-new-exploration"
              onClick={() => handleNewChat(true)}
            >
              <Plus size={16} /> New Exploration
            </button>

            <div className="sessions-scroll">
              {conversations.length === 0 ? (
                <p className="no-sessions-msg">No stored explorations.</p>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`session-tab ${
                      c.id === activeConvId ? "active" : ""
                    }`}
                    onClick={() => loadConversation(c.id)}
                  >
                    <MessageSquare size={14} className="tab-icon" />
                    <span className="tab-title">
                      {c.title || "Project Inquiry"}
                    </span>
                    <button
                      className="tab-delete-btn"
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      title="Delete Session"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="sidebar-grounding-info">
              <div className="grounding-badge">
                <CheckCircle2 size={12} className="check-icon" />
                <span>Dataset: 1,210 Pairs</span>
              </div>
              <button
                className="sidebar-link-btn"
                onClick={() => setShowBookmarksModal(true)}
              >
                <Bookmark size={14} /> Bookmarks ({bookmarks.length})
              </button>
              <button
                className="sidebar-link-btn"
                onClick={() => {
                  setShowEvalModal(true);
                  if (!evalData) runEvaluation(5);
                }}
              >
                <BarChart3 size={14} /> Benchmark Data
              </button>
            </div>
          </aside>

          <section className="chat-mission-stage">
            <div className="stage-top-strip">
              {!sidebarOpen && (
                <button
                  className="stage-open-sidebar"
                  onClick={() => setSidebarOpen(true)}
                  title="Open Mission Logs"
                >
                  <Menu size={16} />
                </button>
              )}

              <div className="mission-title-box">
                <span className="mission-label">ADVISOR MISSION:</span>
                <span className="mission-name">
                  {conversations.find((c) => c.id === activeConvId)?.title ||
                    "Active Exploration"}
                </span>
                <span className="grounded-pill">
                  <Sparkles size={11} /> Grounded RAG
                </span>
              </div>

              <div className="stage-top-actions">
                <button
                  className="btn-exit-to-home"
                  onClick={() => setViewMode("landing")}
                >
                  <Compass size={14} /> Mission Control
                </button>
              </div>
            </div>

            {/* RUNNING COSMONAUT HUD (WHILE GENERATING) */}
            {loading && (
              <div className="cosmonaut-loading-hud">
                <div className="cosmonaut-stage">
                  <CosmonautIllustration running={true} />
                </div>
                <div className="hud-telemetry">
                  <span className="telemetry-tag">
                    NEURAL HYBRID TELEMETRY
                  </span>
                  <p className="telemetry-thought">
                    {COSMIC_THOUGHTS[thoughtIdx]}
                  </p>
                </div>
                <div className="orbiting-saturn">
                  <SaturnIllustration mini={true} />
                </div>
              </div>
            )}

            {/* Chat Messages Log */}
            <div className="mission-chat-feed">
              {messages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className={`chat-row ${
                    msg.role === "user" ? "user-speech" : "advisor-speech"
                  }`}
                >
                  <div className="speaker-avatar">
                    {msg.role === "user" ? (
                      <div className="user-initial">YOU</div>
                    ) : (
                      <div className="advisor-symbol">
                        <CosmonautIllustration mini={true} />
                      </div>
                    )}
                  </div>

                  <div className="speech-body-wrap">
                    <div className="speech-balloon">
                      <div
                        className="balloon-markdown"
                        dangerouslySetInnerHTML={{
                          __html: formatMarkdown(msg.content),
                        }}
                      />

                      {/* Embedded Recommended Capstones Cards */}
                      {msg.recommendations &&
                        msg.recommendations.length > 0 && (
                          <div className="capstones-deck">
                            <div className="deck-title">
                              <Sparkles size={14} /> Grounded Academic
                              Recommendations ({msg.recommendations.length}):
                            </div>

                            {msg.recommendations.map((proj) => {
                              const isBookmarked = bookmarks.some(
                                (b) => b.project_id === proj.id
                              );
                              const currentFb = feedbackState[proj.id] || {};
                              const matchScore = Math.round(
                                (proj.similarity_score || 0) * 100
                              );
                              const isVivaOpen =
                                vivaOpenProjectId === proj.id;

                              return (
                                <article
                                  key={proj.id}
                                  className="capstone-item-card"
                                >
                                  <div className="card-primary-line">
                                    <div className="card-rank-tag">
                                      <span className="rank-num">
                                        #{proj.rank}
                                      </span>
                                      <span className="rank-id">
                                        [{proj.id}]
                                      </span>
                                      <span
                                        className={`diff-pill diff-${proj.difficulty_level?.toLowerCase()}`}
                                      >
                                        {proj.difficulty_level}
                                      </span>
                                    </div>

                                    <button
                                      className={`bookmark-toggle-btn ${
                                        isBookmarked ? "saved" : ""
                                      }`}
                                      onClick={() =>
                                        handleToggleBookmark(proj)
                                      }
                                      title={
                                        isBookmarked
                                          ? "Remove Bookmark"
                                          : "Bookmark Project"
                                      }
                                    >
                                      {isBookmarked ? (
                                        <BookmarkCheck size={16} />
                                      ) : (
                                        <Bookmark size={16} />
                                      )}
                                    </button>
                                  </div>

                                  <h3 className="card-project-title">
                                    {proj.title}
                                  </h3>
                                  <p className="card-project-desc">
                                    {proj.description}
                                  </p>

                                  {proj.recommendation_explanation && (
                                    <div className="card-why-callout">
                                      <strong>💡 Examiner Note:</strong>{" "}
                                      {proj.recommendation_explanation}
                                    </div>
                                  )}

                                  <div className="card-tags-deck">
                                    {proj.domain && (
                                      <span className="domain-tag">
                                        {proj.domain}
                                      </span>
                                    )}
                                    {proj.technologies
                                      ?.slice(0, 4)
                                      .map((t) => (
                                        <span key={t} className="tech-tag">
                                          {t}
                                        </span>
                                      ))}
                                  </div>

                                  <div className="hybrid-score-gauge">
                                    <div className="gauge-label-row">
                                      <span>Hybrid Similarity Confidence:</span>
                                      <strong>{matchScore}%</strong>
                                    </div>
                                    <div className="gauge-meter-track">
                                      <div
                                        className="gauge-meter-fill"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            matchScore
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                    <div className="gauge-metric-trio">
                                      <span>
                                        🧠 Semantic:{" "}
                                        {(
                                          (proj.semantic_score || 0) * 100
                                        ).toFixed(0)}
                                        %
                                      </span>
                                      <span>
                                        📄 TF-IDF:{" "}
                                        {(
                                          (proj.tfidf_score || 0) * 100
                                        ).toFixed(0)}
                                        %
                                      </span>
                                      <span>
                                        🎯 Pref:{" "}
                                        {(
                                          (proj.preference_score || 0) * 100
                                        ).toFixed(0)}
                                        %
                                      </span>
                                    </div>
                                  </div>

                                  {/* Professor / Viva Inspector Drawer */}
                                  {isVivaOpen && (
                                    <div className="viva-inspector-panel">
                                      <div className="viva-panel-head">
                                        <GraduationCap size={15} />
                                        <h4>
                                          Professor's Defense &amp; Architecture
                                          Dossier
                                        </h4>
                                      </div>
                                      <div className="viva-grid">
                                        <div className="viva-block">
                                          <span className="v-label">
                                            📐 Architecture Pipeline:
                                          </span>
                                          <p>
                                            Input Data Preprocessing → Feature
                                            Extraction / Embedding Backbone →
                                            Model Inference (PyTorch/TF) → Post-processing
                                            &amp; REST API (FastAPI) → Web UI.
                                          </p>
                                        </div>
                                        <div className="viva-block">
                                          <span className="v-label">
                                            💾 Recommended Datasets:
                                          </span>
                                          <p>
                                            Public benchmark datasets available
                                            on Kaggle, Hugging Face, or UCI ML
                                            Repository. Requires ~4GB–12GB VRAM.
                                          </p>
                                        </div>
                                        <div className="viva-block">
                                          <span className="v-label">
                                            ❓ Common Viva Defense Question:
                                          </span>
                                          <p>
                                            <em>
                                              “Why did you choose this hybrid
                                              approach over standard baseline
                                              heuristics, and how do you evaluate
                                              overfitting?”
                                            </em>
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <div className="card-action-ribbon">
                                    <div className="ribbon-left-actions">
                                      <button
                                        className="btn-deepdive"
                                        onClick={() =>
                                          handleSendMessage(
                                            `Explain the full system architecture, dataset source, and step-by-step implementation for Project #${proj.rank} (${proj.title}).`
                                          )
                                        }
                                      >
                                        Implementation Plan{" "}
                                        <ArrowRight size={12} />
                                      </button>

                                      <button
                                        className={`btn-viva-toggle ${
                                          isVivaOpen ? "active" : ""
                                        }`}
                                        onClick={() =>
                                          setVivaOpenProjectId((prev) =>
                                            prev === proj.id ? null : proj.id
                                          )
                                        }
                                      >
                                        <GraduationCap size={13} />
                                        {isVivaOpen
                                          ? "Close Viva Pack"
                                          : "Viva Defense Pack"}
                                      </button>
                                    </div>

                                    <div className="ribbon-feedback">
                                      <button
                                        className={`fb-rate-btn ${
                                          currentFb.like ? "rated-pos" : ""
                                        }`}
                                        onClick={() =>
                                          handleFeedback(
                                            proj.id,
                                            proj.title,
                                            "like"
                                          )
                                        }
                                        title="Helpful"
                                      >
                                        <ThumbsUp size={12} />
                                      </button>
                                      <button
                                        className={`fb-rate-btn ${
                                          currentFb.dislike ? "rated-neg" : ""
                                        }`}
                                        onClick={() =>
                                          handleFeedback(
                                            proj.id,
                                            proj.title,
                                            "dislike"
                                          )
                                        }
                                        title="Not Helpful"
                                      >
                                        <ThumbsDown size={12} />
                                      </button>
                                      <div className="fb-stars-rack">
                                        {[1, 2, 3, 4, 5].map((sVal) => (
                                          <Star
                                            key={sVal}
                                            size={12}
                                            className={`star-unit ${
                                              (currentFb.rating || 0) >= sVal
                                                ? "star-lit"
                                                : ""
                                            }`}
                                            onClick={() =>
                                              handleFeedback(
                                                proj.id,
                                                proj.title,
                                                "rating",
                                                sVal
                                              )
                                            }
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}

                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="speech-followups-rack">
                          <span className="followup-lead">Next Inquiries:</span>
                          {msg.suggestions.map((sug, i) => (
                            <button
                              key={i}
                              className="followup-chip"
                              onClick={() => handleSendMessage(sug)}
                            >
                              <Play size={10} /> {sug}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="chat-row advisor-speech">
                  <div className="speaker-avatar">
                    <div className="advisor-symbol spinning">
                      <CosmonautIllustration mini={true} />
                    </div>
                  </div>
                  <div className="speech-body-wrap">
                    <div className="speech-balloon generating-balloon">
                      <span className="signal-pulse" />
                      <span>
                        ProjectIQ &amp; Gemini formulating grounded academic
                        response...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Message Deck */}
            <div className="mission-input-deck">
              <div className="filters-strip">
                <button
                  className={`filters-toggle-btn ${
                    showPreferences ? "active" : ""
                  }`}
                  onClick={() => setShowPreferences(!showPreferences)}
                >
                  <Sliders size={13} />
                  <span>
                    Project Parameters{" "}
                    {activePrefsCount > 0 && `(${activePrefsCount})`}
                  </span>
                  {showPreferences ? (
                    <ChevronDown size={13} />
                  ) : (
                    <ChevronUp size={13} />
                  )}
                </button>

                {preferences.domain !== "Any Domain" && (
                  <span className="active-tag">
                    Domain: {preferences.domain}
                    <X
                      size={11}
                      onClick={() =>
                        handleUpdatePreference("domain", "Any Domain")
                      }
                    />
                  </span>
                )}
                {preferences.difficulty !== "Any" && (
                  <span className="active-tag">
                    Diff: {preferences.difficulty}
                    <X
                      size={11}
                      onClick={() => handleUpdatePreference("difficulty", "Any")}
                    />
                  </span>
                )}
                {preferences.skills.map((s) => (
                  <span key={s} className="active-tag skill">
                    {s}
                    <X size={11} onClick={() => removePrefTag("skills", s)} />
                  </span>
                ))}
                {preferences.technologies.map((t) => (
                  <span key={t} className="active-tag tech">
                    {t}
                    <X
                      size={11}
                      onClick={() => removePrefTag("technologies", t)}
                    />
                  </span>
                ))}
                {preferences.mode !== "hybrid" && (
                  <span className="active-tag mode">
                    Mode: {preferences.mode}
                    <X
                      size={11}
                      onClick={() => handleUpdatePreference("mode", "hybrid")}
                    />
                  </span>
                )}

                {activePrefsCount > 0 && (
                  <button
                    className="clear-all-params"
                    onClick={handleResetPreferences}
                  >
                    Reset all
                  </button>
                )}
              </div>

              {showPreferences && (
                <div className="expanded-parameters-drawer">
                  <div className="drawer-grid">
                    <div className="drawer-field">
                      <label>
                        <Target size={13} /> Academic Domain
                      </label>
                      <select
                        value={preferences.domain}
                        onChange={(e) =>
                          handleUpdatePreference("domain", e.target.value)
                        }
                        className="field-select"
                      >
                        {domains.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="drawer-field">
                      <label>
                        <Layers size={13} /> Difficulty Level
                      </label>
                      <div className="pill-selector">
                        {["Any", "Beginner", "Intermediate", "Advanced"].map(
                          (lvl) => (
                            <button
                              type="button"
                              key={lvl}
                              className={`pill-choice ${
                                preferences.difficulty === lvl ? "selected" : ""
                              }`}
                              onClick={() =>
                                handleUpdatePreference("difficulty", lvl)
                              }
                            >
                              {lvl}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="drawer-field">
                      <label>
                        <Sparkles size={13} /> Engine Mode &amp; Top-K
                      </label>
                      <div className="pill-selector">
                        <button
                          type="button"
                          className={`pill-choice ${
                            preferences.mode === "hybrid" ? "selected" : ""
                          }`}
                          onClick={() =>
                            handleUpdatePreference("mode", "hybrid")
                          }
                        >
                          🚀 Hybrid
                        </button>
                        <button
                          type="button"
                          className={`pill-choice ${
                            preferences.mode === "semantic_only" ? "selected" : ""
                          }`}
                          onClick={() =>
                            handleUpdatePreference("mode", "semantic_only")
                          }
                        >
                          🧠 Semantic
                        </button>
                        <button
                          type="button"
                          className={`pill-choice ${
                            preferences.mode === "tfidf_only" ? "selected" : ""
                          }`}
                          onClick={() =>
                            handleUpdatePreference("mode", "tfidf_only")
                          }
                        >
                          📄 TF-IDF
                        </button>
                        <span className="v-bar" />
                        <button
                          type="button"
                          className={`pill-choice ${
                            preferences.top_k === 5 ? "selected" : ""
                          }`}
                          onClick={() => handleUpdatePreference("top_k", 5)}
                        >
                          Top 5
                        </button>
                        <button
                          type="button"
                          className={`pill-choice ${
                            preferences.top_k === 10 ? "selected" : ""
                          }`}
                          onClick={() => handleUpdatePreference("top_k", 10)}
                        >
                          Top 10
                        </button>
                      </div>
                    </div>

                    <div className="drawer-field span-full">
                      <label>
                        <Cpu size={13} /> Student Technical Skills
                      </label>
                      <div className="tag-input-container">
                        {preferences.skills.map((s) => (
                          <span key={s} className="inner-tag">
                            {s}
                            <X
                              size={11}
                              onClick={() => removePrefTag("skills", s)}
                            />
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
                          placeholder={
                            preferences.skills.length === 0
                              ? "Type skill (e.g. Python, PyTorch) & press Enter..."
                              : "Add more skills..."
                          }
                          className="tag-text-field"
                        />
                      </div>
                      <div className="suggestions-bar">
                        <span className="sug-label">Popular:</span>
                        {popularSkills.slice(0, 10).map((s) => (
                          <button
                            type="button"
                            key={s}
                            className={`mini-sug ${
                              preferences.skills.includes(s) ? "active" : ""
                            }`}
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

                    <div className="drawer-field span-full">
                      <label>
                        <Wrench size={13} /> Frameworks &amp; Tooling
                      </label>
                      <div className="tag-input-container">
                        {preferences.technologies.map((t) => (
                          <span key={t} className="inner-tag tech">
                            {t}
                            <X
                              size={11}
                              onClick={() =>
                                removePrefTag("technologies", t)
                              }
                            />
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
                          placeholder={
                            preferences.technologies.length === 0
                              ? "Type framework (e.g. FastAPI, OpenCV) & press Enter..."
                              : "Add more tools..."
                          }
                          className="tag-text-field"
                        />
                      </div>
                      <div className="suggestions-bar">
                        <span className="sug-label">Popular:</span>
                        {popularTechs.slice(0, 10).map((t) => (
                          <button
                            type="button"
                            key={t}
                            className={`mini-sug ${
                              preferences.technologies.includes(t)
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              preferences.technologies.includes(t)
                                ? removePrefTag("technologies", t)
                                : addPrefTag("technologies", t)
                            }
                          >
                            {preferences.technologies.includes(t)
                              ? "✓ "
                              : "+ "}
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {preferences.mode === "hybrid" && (
                      <div className="drawer-field span-full">
                        <button
                          type="button"
                          className="btn-toggle-sliders"
                          onClick={() => setShowWeights(!showWeights)}
                        >
                          <Sliders size={12} />{" "}
                          {showWeights
                            ? "Hide Mathematical Weights"
                            : "Tune Mathematical Hybrid Weights (α, β, γ)"}
                        </button>

                        {showWeights && (
                          <div className="weights-box">
                            <div className="weight-slider">
                              <span>
                                Semantic Vectors (α):{" "}
                                {Math.round(preferences.weights.semantic * 100)}
                                %
                              </span>
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
                            <div className="weight-slider">
                              <span>
                                TF-IDF Lexical (β):{" "}
                                {Math.round(preferences.weights.tfidf * 100)}%
                              </span>
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
                            <div className="weight-slider">
                              <span>
                                Preference Alignment (γ):{" "}
                                {Math.round(
                                  preferences.weights.preference * 100
                                )}
                                %
                              </span>
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

              <form
                className="mission-input-form"
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
                  placeholder="Ask for capstone ideas, system architectures, dataset suggestions, or viva defense questions... (Enter to transmit)"
                  rows={2}
                  className="mission-textarea"
                />
                <button
                  type="submit"
                  className="btn-send-message"
                  disabled={loading || !inputValue.trim()}
                  title="Transmit Inquiry"
                >
                  {loading ? (
                    <RotateCcw size={16} className="spinning-fast" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </form>

              {statusMessage && (
                <p className="mission-status-alert">{statusMessage}</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Bookmarks Modal */}
      {showBookmarksModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowBookmarksModal(false)}
        >
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div className="modal-headline">
                <Bookmark size={20} className="icon-gold" />
                <h3>Stored Capstone Projects ({bookmarks.length})</h3>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowBookmarksModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {bookmarks.length === 0 ? (
              <p className="empty-modal-text">
                No bookmarked projects in storage. Click the bookmark ribbon on
                any recommended project card to store it here for your professor
                review.
              </p>
            ) : (
              <div className="modal-cards-list">
                {bookmarks.map((b) => (
                  <div key={b.id || b.project_id} className="stored-card">
                    <div className="stored-info">
                      <span className="stored-id">[{b.project_id}]</span>
                      <h4>{b.project_title || `Project ${b.project_id}`}</h4>
                      <p>
                        {b.project_domain} • {b.project_difficulty}
                      </p>
                    </div>
                    <button
                      className="btn-inquire-stored"
                      onClick={() => {
                        setShowBookmarksModal(false);
                        setViewMode("chat");
                        handleSendMessage(
                          `Tell me more about bookmarked project ${b.project_id}: ${b.project_title}. How do I implement it?`
                        );
                      }}
                    >
                      Inquire in Advisor <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ground-Truth Evaluation Benchmark Modal */}
      {showEvalModal && (
        <div className="modal-overlay" onClick={() => setShowEvalModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div className="modal-headline">
                <BarChart3 size={20} className="icon-cyan" />
                <h3>AI Model Benchmark &amp; Ground-Truth Evaluation</h3>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowEvalModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="modal-subtext">
              Empirical evaluation comparing <strong>TF-IDF</strong>,{" "}
              <strong>Sentence Transformers (all-MiniLM-L6-v2)</strong>, and
              the <strong>Hybrid Recommendation Engine</strong> across 1,210
              labeled ground-truth project pairs.
            </p>

            <div className="k-toggle-bar">
              <span>Evaluation Cutoff:</span>
              <button
                className={`cutoff-pill ${evalK === 5 ? "active" : ""}`}
                onClick={() => runEvaluation(5)}
              >
                K = 5
              </button>
              <button
                className={`cutoff-pill ${evalK === 10 ? "active" : ""}`}
                onClick={() => runEvaluation(10)}
              >
                K = 10
              </button>
            </div>

            {evalLoading ? (
              <div className="eval-calculating">
                <RotateCcw className="spinning-fast" size={24} />
                <p>
                  Computing Precision@{evalK}, Recall@{evalK}, and F1@{evalK} on
                  ground truth...
                </p>
              </div>
            ) : evalData?.models_evaluated ? (
              <div className="eval-table-wrapper">
                <table className="eval-table">
                  <thead>
                    <tr>
                      <th>Algorithm</th>
                      <th>Precision@{evalK}</th>
                      <th>Recall@{evalK}</th>
                      <th>F1-Score</th>
                      <th>Ground-Truth Hits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(evalData.models_evaluated).map(
                      ([mKey, mVal]) => (
                        <tr
                          key={mKey}
                          className={mKey === "hybrid" ? "best-row" : ""}
                        >
                          <td>
                            <strong>{mVal.model_name}</strong>
                            {mKey === "hybrid" && (
                              <span className="best-badge">Best Overall</span>
                            )}
                          </td>
                          <td>{(mVal.precision_at_k * 100).toFixed(1)}%</td>
                          <td>{(mVal.recall_at_k * 100).toFixed(1)}%</td>
                          <td>{(mVal.f1_score * 100).toFixed(1)}%</td>
                          <td>{mVal.total_hits}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>

                <div className="eval-footnote">
                  <p>
                    <strong>Dataset Validation:</strong> Evaluated strictly
                    against <code>projectiq_similarity_ground_truth.csv</code>{" "}
                    and <code>projectiq_student_ideas.csv</code>.
                  </p>
                  <p>
                    <strong>Academic Transparency:</strong> Hybrid AI achieves
                    the highest F1 balance between semantic understanding and
                    exact technological term matching.
                  </p>
                </div>
              </div>
            ) : (
              <p className="no-eval-data">No evaluation data loaded.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Handcrafted SVG Space Retro-Illustrations
function CosmonautIllustration({
  floating = false,
  running = false,
  mini = false,
}) {
  return (
    <div
      className={`cosmonaut-wrap ${floating ? "floating-anim" : ""} ${
        running ? "running-anim" : ""
      } ${mini ? "mini-astro" : ""}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="astro-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20 70 C 10 50, 30 30, 42 45"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray="4 2"
          className="tether-cord"
        />

        <rect
          x="34"
          y="35"
          width="14"
          height="32"
          rx="4"
          fill="#1e293b"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        {running && (
          <g className="jetpack-flames">
            <polygon
              points="36,68 41,84 46,68"
              fill="#00f5ff"
              className="flame-core"
            />
            <polygon
              points="38,68 41,78 44,68"
              fill="#fbbf24"
              className="flame-inner"
            />
          </g>
        )}

        <rect
          x="44"
          y="40"
          width="26"
          height="32"
          rx="8"
          fill="#f8fafc"
          stroke="currentColor"
          strokeWidth="3"
        />

        <rect
          x="50"
          y="46"
          width="14"
          height="12"
          rx="2"
          fill="#0f172a"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="54" cy="52" r="2" fill="#00f5ff" />
        <circle cx="60" cy="52" r="2" fill="#10b981" />

        <circle
          cx="57"
          cy="26"
          r="16"
          fill="#f8fafc"
          stroke="currentColor"
          strokeWidth="3"
        />
        <rect
          x="48"
          y="18"
          width="18"
          height="16"
          rx="5"
          fill="#020617"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M52 22 Q 57 20 62 25"
          stroke="#00f5ff"
          strokeWidth="2"
          strokeLinecap="round"
        />

        <path
          d="M44 45 Q 32 50 40 60"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="astro-left-arm"
        />
        <path
          d="M70 45 Q 82 50 78 60"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="astro-right-arm"
        />

        <path
          d="M50 72 L 46 90"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          className="astro-left-leg"
        />
        <path
          d="M64 72 L 68 90"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          className="astro-right-leg"
        />
      </svg>
    </div>
  );
}

function SaturnIllustration({ mini = false }) {
  return (
    <div className={`saturn-wrap ${mini ? "saturn-mini" : ""}`}>
      <svg
        viewBox="0 0 120 80"
        className="saturn-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="60"
          cy="40"
          r="26"
          fill="#f8fafc"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M38 35 Q 60 42 82 35"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M40 45 Q 60 52 80 45"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M44 55 Q 60 60 76 55"
          stroke="currentColor"
          strokeWidth="1.5"
        />

        <ellipse
          cx="60"
          cy="40"
          rx="54"
          ry="16"
          stroke="currentColor"
          strokeWidth="3.5"
          transform="rotate(-15 60 40)"
        />
        <ellipse
          cx="60"
          cy="40"
          rx="47"
          ry="12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          transform="rotate(-15 60 40)"
        />
      </svg>
    </div>
  );
}

function AlienCuriousIllustration() {
  return (
    <div className="alien-wrap">
      <svg
        viewBox="0 0 70 80"
        className="alien-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M35 50 Q 30 75 35 80"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M30 60 Q 15 50 20 40"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="alien-waving-hand"
        />
        <circle cx="20" cy="38" r="3" fill="currentColor" />

        <ellipse
          cx="35"
          cy="32"
          rx="18"
          ry="22"
          fill="#f8fafc"
          stroke="currentColor"
          strokeWidth="3"
        />

        <ellipse
          cx="28"
          cy="30"
          rx="6"
          ry="9"
          fill="#020617"
          transform="rotate(-12 28 30)"
        />
        <ellipse
          cx="42"
          cy="30"
          rx="6"
          ry="9"
          fill="#020617"
          transform="rotate(12 42 30)"
        />

        <circle cx="29" cy="27" r="2" fill="#fff" />
        <circle cx="43" cy="27" r="2" fill="#fff" />
        <circle cx="35" cy="45" r="1.5" fill="#020617" />
      </svg>
    </div>
  );
}

function UFOSaucerIllustration() {
  return (
    <div className="ufo-wrap">
      <svg
        viewBox="0 0 100 70"
        className="ufo-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon
          points="35,32 65,32 85,70 15,70"
          fill="url(#ufo-beam-grad)"
          opacity="0.35"
          className="ufo-beam"
        />
        <defs>
          <linearGradient id="ufo-beam-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00f5ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00f5ff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <ellipse
          cx="50"
          cy="22"
          rx="16"
          ry="12"
          fill="#f8fafc"
          stroke="currentColor"
          strokeWidth="2.5"
        />

        <ellipse
          cx="50"
          cy="30"
          rx="40"
          ry="10"
          fill="#1e293b"
          stroke="currentColor"
          strokeWidth="3"
        />

        <circle cx="25" cy="30" r="2.5" fill="#00f5ff" />
        <circle cx="37" cy="32" r="2.5" fill="#00f5ff" />
        <circle cx="50" cy="33" r="2.5" fill="#10b981" />
        <circle cx="63" cy="32" r="2.5" fill="#00f5ff" />
        <circle cx="75" cy="30" r="2.5" fill="#00f5ff" />
      </svg>
    </div>
  );
}

function formatMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/gms, "<ul>$1</ul>");
  html = html.replace(/\n\n/g, "<br/><br/>");

  return html;
}
