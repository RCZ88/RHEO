// src/app/docs/faq/page.tsx
export const metadata = { title: "FAQ — RHEO docs" };

const QA = [
  { q: "Does RHEO send my data anywhere?", a: "By default, no. The update check and currency rates run with no setup. Everything else needs your key, your provider, or something you turned on. See /docs/network." },
  { q: "Where is my data stored?", a: "One SQLite database in your data folder. On disk that is three files (database, -wal, -shm). Settings and caches sit beside it. See /docs/data." },
  { q: "Can I use AI without sending anything off my machine?", a: "Yes. Pick Ollama or llama.cpp as your provider. Nothing leaves. See /docs/ai." },
  { q: "What does the AI prompt contain?", a: "Today's app usage, goals, sleep, planning notes, off-device activity, and — if you connected them — email subjects and calendar items. Finance only if unlocked. See /docs/ai." },
  { q: "Are there analytics or tracking?", a: "No analytics SDK, beacon, WebSocket or EventSource in main, preload or renderer. Browser sites are recorded by default — that is your own record, not telemetry." },
  { q: "Is sync encrypted?", a: "The sync key has a known weakness (1 byte of entropy). Until it is fixed, docs do not claim encryption. See the launch blockers list." },
  { q: "Can I turn off auto-update?", a: "Not yet. It is a packaged-builds-only feature with no off switch. Planned." },
];

export default function FaqPage() {
  return (
    <div>
      <p className="mono-label" style={{ fontSize: 11 }}>FAQ</p>
      <h1 className="display-h2 mt-3">SHORT ANSWERS.</h1>
      <dl className="mt-10 flex flex-col gap-8">
        {QA.map((qa) => (
          <div key={qa.q}>
            <dt className="mono" style={{ fontSize: 14, color: "#f4f4f5", fontWeight: 500 }}>{qa.q}</dt>
            <dd style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa", marginTop: 6 }}>{qa.a}</dd>
          </div>
        ))}
      </dl>
      <p className="mono mt-12" style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.08em" }}>
        Not released yet. v0.2.0, pre-release.
      </p>
    </div>
  );
}