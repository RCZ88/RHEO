// src/app/docs/ai/page.tsx
export const metadata = { title: "AI — RHEO docs" };

export default function AiPage() {
  return (
    <div>
      <p className="mono-label" style={{ fontSize: 11 }}>AI</p>
      <h1 className="display-h2 mt-3">WHAT A PROMPT CONTAINS.</h1>

      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#a1a1aa", marginTop: 16 }}>
        When you ask the AI a question, the app builds a prompt from your day's data
        and sends it to the provider you picked. Nothing is sent unless you ask.
      </p>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        What goes in
      </h2>
      <ul style={{ fontSize: 14, lineHeight: 1.7, color: "#a1a1aa", marginLeft: 20, listStyle: "disc" }}>
        <li>Today's app and site usage (per-app totals, duration).</li>
        <li>Today's goals and 7-day goal trends.</li>
        <li>Last night's sleep (hours and quality).</li>
        <li>Active projects and planning notes.</li>
        <li>Activity logged away from the computer (up to 5 entries).</li>
        <li>Canvas cards you have open, so the assistant can update rather than duplicate.</li>
        <li>Your derived profile: traits, interests, habits, communication style.</li>
        <li>The first few email subjects and calendar items, only if you connected a connector.</li>
      </ul>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        What stays out
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
        Finance data is locked by default and only included if you unlock it. The lock
        fails closed: if it cannot be read, finance is omitted.
      </p>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        Who receives it
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
        The provider you configure. Local options (Ollama, llama.cpp) send nothing off the
        machine. Cloud options (OpenRouter, Groq, Gemini, Cloudflare, Azure) send the
        prompt to that host.
      </p>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        What is stored
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
        Every prompt and every answer is saved in the same SQLite database, in a table
        called <code className="mono" style={{ color: "#f4f4f5" }}>ai_debug_events</code>.
        The newest 25,000 rows are kept. Known secret formats are removed before saving.
      </p>

      <p className="mono mt-12" style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.08em" }}>
        Pick a local provider and nothing leaves your machine. Not released yet. v0.2.0, pre-release.
      </p>
    </div>
  );
}