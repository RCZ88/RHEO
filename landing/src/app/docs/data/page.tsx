// src/app/docs/data/page.tsx
export const metadata = { title: "Your data — RHEO docs" };

export default function DataPage() {
  return (
    <div>
      <p className="mono-label" style={{ fontSize: 11 }}>YOUR DATA</p>
      <h1 className="display-h2 mt-3">WHERE IT LIVES.</h1>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        One SQLite database, three files on disk
      </h2>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#a1a1aa" }}>
        RHEO keeps its record in one SQLite database. SQLite writes in WAL mode, so on
        disk that is three files: <code className="mono" style={{ color: "#f4f4f5" }}>deskflow-data.db</code>,
        <code className="mono" style={{ color: "#f4f4f5" }}>deskflow-data.db-wal</code> and
        <code className="mono" style={{ color: "#f4f4f5" }}>deskflow-data.db-shm</code>. Close
        RHEO before copying the folder by hand.
      </p>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        Beside the database
      </h2>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#a1a1aa" }}>
        Your settings and state files, a <code className="mono" style={{ color: "#f4f4f5" }}>backups/</code>
        folder, a few caches and the AI question log. They do not hold your history.
      </p>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        Your AI questions and answers are stored too
      </h2>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#a1a1aa" }}>
        Every prompt and every answer is saved in the same database, in a table called
        <code className="mono" style={{ color: "#f4f4f5" }}> ai_debug_events</code>. The newest
        25,000 rows are kept. Known secret formats (API keys, bearer tokens) are removed
        before saving.
      </p>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        Other things in the folder
      </h2>
      <ul className="flex flex-col gap-2" style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
        <li>API keys you enter are stored unencrypted in the data folder. Do not share that folder.</li>
        <li>Browser sites are recorded by default.</li>
        <li><code className="mono" style={{ color: "#f4f4f5" }}>gas-secrets.json</code> and <code className="mono" style={{ color: "#f4f4f5" }}>sync-auth.json</code> sit in the same folder. Both are opt-in.</li>
        <li><code className="mono" style={{ color: "#f4f4f5" }}>deskflow-audit-key.bin</code> is the audit key. It is a file, not a secret in a keystore.</li>
      </ul>

      <p className="mono mt-12" style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.08em" }}>
        Not released yet. v0.2.0, pre-release.
      </p>
    </div>
  );
}