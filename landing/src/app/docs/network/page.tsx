// src/app/docs/network/page.tsx
export const metadata = { title: "Network — RHEO docs" };

const ROWS = [
  { name: "Update check", host: "api.github.com (release feed)", sends: "Platform, version, standard headers. No key, no account, no install ID.", when: "Packaged builds only, once a day, auto-downloads." },
  { name: "Currency rates", host: "api.exchangerate-api.com", sends: "Nothing but the URL.", when: "When you open Finance." },
  { name: "AI provider", host: "Whichever you configure (OpenRouter, Ollama, etc.)", sends: "Your question and a summary of your day. Finance data stays out unless unlocked.", when: "When you ask a question." },
  { name: "Speech to text", host: "Groq (default) or your configured STT endpoint", sends: "Recorded audio.", when: "Only if you set an API key." },
  { name: "GitHub commit sync", host: "api.github.com", sends: "Repo coordinates, optional token.", when: "Only when you run it." },
  { name: "GAS mirror", host: "Your Google Apps Script URL", sends: "Facts and triples derived from your activity.", when: "Only if you configure it. Scheduler is unwired." },
  { name: "Sync server", host: "Your sync server (default 127.0.0.1:8787)", sends: "Credentials and activity data, encrypted in transit. Not encrypted on disk — see blocker.", when: "Only after you log in." },
  { name: "Design registries", host: "ui.aceternity.com, refero.design", sends: "Nothing but the slug.", when: "Only when you open the design browser." },
];

export default function NetworkPage() {
  return (
    <div>
      <p className="mono-label" style={{ fontSize: 11 }}>NETWORK</p>
      <h1 className="display-h2 mt-3">OUTBOUND CALLS.</h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#a1a1aa", marginTop: 16 }}>
        Nothing leaves unless you connect something, with two exceptions:
      </p>
      <ul style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa", marginTop: 8, marginLeft: 20, listStyle: "disc" }}>
        <li>The update check, in packaged builds. It runs once a day and sends platform and version.</li>
        <li>Currency rates, when you open Finance. No key, no account.</li>
      </ul>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.16)" }}>
              <th className="text-left py-2 pr-4 mono" style={{ fontSize: 11, color: "#8a8a94" }}>CALL</th>
              <th className="text-left py-2 pr-4 mono" style={{ fontSize: 11, color: "#8a8a94" }}>HOST</th>
              <th className="text-left py-2 pr-4 mono" style={{ fontSize: 11, color: "#8a8a94" }}>SENDS</th>
              <th className="text-left py-2 mono" style={{ fontSize: 11, color: "#8a8a94" }}>WHEN</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <td className="py-3 pr-4" style={{ color: "#f4f4f5", fontWeight: 500 }}>{r.name}</td>
                <td className="py-3 pr-4 mono" style={{ fontSize: 12, color: "#a1a1aa" }}>{r.host}</td>
                <td className="py-3 pr-4" style={{ color: "#a1a1aa" }}>{r.sends}</td>
                <td className="py-3" style={{ color: "#8a8a94", fontSize: 13 }}>{r.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        Update check
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
        In packaged builds RHEO checks the project's release feed once a day and downloads a new
        version in the background. The request sends no account, key or install ID. Like any web
        request, the server sees your IP address and standard headers such as the user agent.
      </p>

      <p className="mono mt-12" style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.08em" }}>
        Not released yet. v0.2.0, pre-release.
      </p>
    </div>
  );
}