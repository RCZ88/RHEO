// src/app/docs/data/page.tsx
export const metadata = { title: "Your data — RHEO docs" };

export default function DataPage() {
  return (
    <div>
      <p className="mono-label" style={{ fontSize: 11 }}>YOUR DATA</p>
      <h1 className="display-h2 mt-3">WHERE IT LIVES.</h1>

      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#a1a1aa", marginTop: 16 }}>
        RHEO keeps its record in one SQLite database. On disk that is three files:
        the database, a <code className="mono" style={{ color: "#f4f4f5" }}>-wal</code> file
        and a <code className="mono" style={{ color: "#f4f4f5" }}>-shm</code> file. SQLite
        uses the two extra files to write safely. Close RHEO before copying the folder
        by hand.
      </p>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        What holds your history
      </h2>
      <ul style={{ fontSize: 14, lineHeight: 1.7, color: "#a1a1aa", marginLeft: 20, listStyle: "disc" }}>
        <li><code className="mono" style={{ color: "#f4f4f5" }}>logs</code> — every app and site session, per minute, with duration and category. 43,805 rows in one real database.</li>
        <li><code className="mono" style={{ color: "#f4f4f5" }}>sessions</code> — aggregated sessions with start/end time.</li>
        <li><code className="mono" style={{ color: "#f4f4f5" }}>productivity_sessions</code> — per-app productivity tracking.</li>
        <li><code className="mono" style={{ color: "#f4f4f5" }}>browser_sessions</code> — per-domain browser time, on by default.</li>
        <li><code className="mono" style={{ color: "#f4f4f5" }}>ai_chat_messages</code> — every AI conversation.</li>
        <li><code className="mono" style={{ color: "#f4f4f5" }}>ai_debug_events</code> — every prompt and answer, newest 25,000 rows. Secret formats are redacted before saving.</li>
      </ul>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        Beside the database
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
        Your settings and state files, a <code className="mono" style={{ color: "#f4f4f5" }}>backups/</code>
        folder, a few caches and the AI question log. They do not hold your history.
      </p>
      <ul style={{ fontSize: 14, lineHeight: 1.7, color: "#a1a1aa", marginLeft: 20, listStyle: "disc", marginTop: 8 }}>
        <li><code className="mono" style={{ color: "#f4f4f5" }}>gas-secrets.json</code> and <code className="mono" style={{ color: "#f4f4f5" }}>sync-auth.json</code> — opt-in sync, sit in the same folder.</li>
        <li><code className="mono" style={{ color: "#f4f4f5" }}>deskflow-audit-key.bin</code> — the audit key. It is a file, not a secret in a keystore.</li>
        <li><code className="mono" style={{ color: "#f4f4f5" }}>deskflow-prefs.json</code> — your settings, including API keys in plain text. Do not share this folder.</li>
      </ul>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        Your AI questions and answers are stored too
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
        Every prompt and every answer is saved in the same database, in a table called
        <code className="mono" style={{ color: "#f4f4f5" }}> ai_debug_events</code>. The newest
        25,000 rows are kept. Known secret formats (API keys, bearer tokens) are removed
        before saving.
      </p>

      <h2 className="mono mt-10 mb-3" style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>
        The data folder, open
      </h2>
      <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <img
          src="/media/app-data-dir.png"
          alt="The RHEO data directory open in a file manager, showing deskflow-data.db, -wal, -shm, backups and config files"
          width={2048}
          height={1225}
          loading="lazy"
          decoding="async"
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </div>

      <p className="mono mt-12" style={{ fontSize: 11, color: "#63636b", letterSpacing: "0.08em" }}>
        Not released yet. v0.2.0, pre-release.
      </p>
    </div>
  );
}
