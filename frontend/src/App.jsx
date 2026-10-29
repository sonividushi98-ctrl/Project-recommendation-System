import { useState } from "react";
import "./App.css";

function App() {
  const [idea, setIdea] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [savedIdeas, setSavedIdeas] = useState([]);
  const [similarProjects, setSimilarProjects] = useState([]);
  const [innovationSuggestions, setInnovationSuggestions] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);

  async function checkBackend() {
    try {
      const response = await fetch("http://127.0.0.1:8000/health");

      if (!response.ok) {
        throw new Error("Backend request failed");
      }

      const data = await response.json();
      setMessage(`Backend connection successful: ${data.status}`);
    } catch {
      setMessage(
        "Cannot reach the backend. Check that the Python server is running."
      );
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanedIdea = idea.trim();
    const cleanedTitle = title.trim();

    if (cleanedTitle.length < 3) {
      setMessage("Please enter a title of at least 3 characters.");
      return;
    }

    if (cleanedIdea.length < 10) {
      setMessage("Please describe your idea in at least 10 characters.");
      return;
    }

    setAnalyzing(true);
    setSimilarProjects([]);
    setMessage("Analyzing your idea and searching for related projects...");

    try {
      // Step 1: Analyze the idea using AI semantic search.
      const analysisResponse = await fetch(
        "http://127.0.0.1:8000/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idea: `${cleanedTitle}. ${cleanedIdea}`,
            top_k: 3,
          }),
        }
      );

      const analysisData = await analysisResponse.json();

      if (!analysisResponse.ok) {
        const detail = Array.isArray(analysisData.detail)
          ? analysisData.detail.map((item) => item.msg).join(", ")
          : analysisData.detail;

        throw new Error(detail || "Could not analyze your idea.");
      }

      setSimilarProjects(analysisData.similar_projects || []);

      
const ideaText = `${cleanedTitle} ${cleanedIdea}`.toLowerCase();
const topMatch = (analysisData.similar_projects || [])[0];

const suggestions = [
  {
    title: "Explore a different target audience",
    description:
      "Adapt the project for a specific group, such as beginners, rural communities, small businesses, or people with accessibility needs."
  },
  {
    title: "Add a context-specific feature",
    description:
      "Identify a practical need not addressed in the project descriptions you reviewed, then design a feature around that need."
  },
  {
    title: "Design for real-world constraints",
    description:
      "Consider limited internet access, low-cost devices, privacy, usability, or limited technical resources."
  },
  {
    title: "Measure the project's impact",
    description:
      "Define measurable outcomes and test your solution with representative users or realistic sample data."
  }
];

if (ideaText.includes("plant") || ideaText.includes("crop") ||
    ideaText.includes("farm")) {
  suggestions[1] = {
    title: "Add a farm-focused feature",
    description:
      "Explore local-language guidance, crop-specific recommendations, or disease tracking over time. Check your dataset to see which needs remain underexplored."
  };
} else if (ideaText.includes("student") ||
           ideaText.includes("education") ||
           ideaText.includes("learning")) {
  suggestions[1] = {
    title: "Personalize the learning experience",
    description:
      "Explore progress tracking, accessible learning materials, or feedback tailored to different student needs."
  };
}

if (topMatch) {
  suggestions.push({
    title: "Differentiate from the closest match",
    description:
      `Compare your idea with "${topMatch.title}". Identify differences in users, features, data, or intended outcomes, then choose a specific direction to investigate.`
  });
}

setInnovationSuggestions(suggestions);


      // Step 2: Save the submitted idea.
      const saveResponse = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: cleanedTitle,
          description: cleanedIdea,
        }),
      });

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        const detail = Array.isArray(saveData.detail)
          ? saveData.detail.map((item) => item.msg).join(", ")
          : saveData.detail;

        throw new Error(
          detail || "Analysis succeeded, but the idea could not be saved."
        );
      }

      setMessage(
        `Analysis complete! Your idea was saved with ID ${saveData.id}.`
      );
      setIdea("");
      setTitle("");
    } catch (error) {
      setMessage(
        error.message || "Could not connect to the backend."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function loadIdeas() {
    try {
      const response = await fetch("http://127.0.0.1:8000/ideas");

      if (!response.ok) {
        throw new Error("Could not load saved ideas.");
      }

      const data = await response.json();
      setSavedIdeas(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="page">
      <header className="navbar">
        <a className="logo" href="/">
          ProjectIQ<span>.</span>
        </a>
        <span className="nav-label">PROJECT INNOVATION PLATFORM</span>
      </header>

      <main className="hero">
        <p className="eyebrow">THINK DIFFERENTLY. BUILD SOMETHING NEW.</p>

        <h1>
          Your next big idea
          <br />
          starts <span>here.</span>
        </h1>

        <p className="description">
          Explore your project idea, understand what has already been built,
          and discover new directions worth exploring.
        </p>

        <form className="idea-form" onSubmit={handleSubmit}>
          <label htmlFor="title">Project title</label>

          <input
            id="title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Smart Waste Management"
            maxLength={200}
            required
          />

          <label htmlFor="idea">What do you want to build?</label>

          <textarea
            id="idea"
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder="Describe your project idea or the problem you want to solve..."
            rows={5}
            maxLength={5000}
            required
          />

          <button type="submit" disabled={analyzing}>
            {analyzing ? "Analyzing your idea..." : "Explore my idea ↗"}
          </button>
        </form>

        {message && (
          <p className="message" role="status">
            {message}
          </p>
        )}

        {similarProjects.length > 0 && (
          <section className="results-section">
            <h2>Related projects</h2>
            <p>
              These projects have descriptions related to your idea. Use them
              to identify differences and explore a new direction.
            </p>

            {similarProjects.map((project) => (
              <article className="idea-card" key={project.id}>
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                

                <p>
                  <strong>Domain:</strong> {project.domain || "Not specified"}
                </p>

                <p>
                  <strong>Technologies:</strong>{" "}
                  {project.technologies?.join(", ") || "Not specified"}
                </p>

                
<p>
  <strong>Semantic similarity:</strong>{" "}
  {(project.similarity * 100).toFixed(1)}%
</p>

<p>
  <strong>Interpretation:</strong>{" "}
  {project.similarity >= 0.6
    ? "Strong match — review the similarities carefully."
    : project.similarity >= 0.35
      ? "Possible match — compare the project details."
      : "Lower similarity — the descriptions are less closely related."}
</p>

              </article>
            ))}

            <p className="results-note">
              Similarity scores measure how closely descriptions relate. They
              do not establish plagiarism or prove that an idea is original.
            </p>
          </section>
        )}
      
        {innovationSuggestions.length > 0 && (
          <section className="results-section">
            <h2>Innovation opportunities</h2>
            <p>
              Use these starting points to explore how your project could
              better meet a specific need. Validate them against your dataset
              and with potential users.
            </p>

            {innovationSuggestions.map((suggestion, index) => (
              <article
                className="idea-card"
                key={`${suggestion.title}-${index}`}
              >
                <h3>{suggestion.title}</h3>
                <p>{suggestion.description}</p>
              </article>
            ))}
          </section>
        )}

        <section className="saved-section">
          <h2>Previously submitted ideas</h2>

          <button type="button" onClick={loadIdeas}>
            Load saved ideas
          </button>

          {savedIdeas.map((item) => (
            <article className="idea-card" key={item.id}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <small>Idea ID: {item.id}</small>
            </article>
          ))}
        </section>

        <button className="test-button" onClick={checkBackend}>
          Test backend connection
        </button>
      </main>

      <footer>
        ProjectIQ · Discover gaps. Explore possibilities. Innovate.
      </footer>
    </div>
  );
}

export default App;