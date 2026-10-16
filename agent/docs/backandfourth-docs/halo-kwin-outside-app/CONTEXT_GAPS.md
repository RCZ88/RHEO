# Context Gaps — halo-kwin-outside-app

| # | Context | Status | Location | How to obtain |
|---|---|---|---|---|
| 1 | The four fatal runtime defects and their measured evidence | ✅ Have | `INITIAL_PROMPT.md` §"What I changed"; verbatim `halo-diagnostic.log` lines | — |
| 2 | KWin 6 `paintScreen` real signature | ✅ Have | quoted from `/usr/include/kwin/effect/effect.h:709` | — |
| 3 | `ReconfigureFlags` is global scope, not `KWin::` | ✅ Have | `effect.h:675` `Q_DECLARE_FLAGS` | — |
| 4 | `init()` / `screenGeometryChanged()` absent in KWin 6 | ✅ Have | grep of `effect.h` — no such decls | — |
| 5 | `InputEventFilter` is `KWIN_EXPORT`, methods return consuming `bool` | ✅ Have | quoted from `/usr/include/kwin/input.h:405+` | — |
| 6 | WebKitGTK helper has no Electron preload → `haloBridge` undefined | ✅ Have | `haloIsland.ts:904` branch + `preload.ts:2377` | — |
| 7 | `pushFrame` writes raw pixels with no length prefix | ✅ Have | quoted verbatim from `offscreenRenderer.ts` | — |
| 8 | **Is `InputEventFilter` installable from a third-party plugin?** | ✅ **RESOLVED** | `installInputEventFilter()` public on `KWIN_EXPORT InputRedirection`; `input()` accessor at `input.h:571`; public ctor at `input.h:405` | Sent as Q1 ADDENDUM. Awaiting specialist confirmation of filter weight + install timing. |
| 8b | Which `InputFilterOrder` weight an overlay should use | ❌ Unknown | — | Ask (Q1 addendum). Not documented in the headers. |
| 8c | Is `Effect::reconfigure()` early enough for `input()->s_self != nullptr` | ❌ Unknown | — | Ask (Q1 addendum). Needs either header reading or a runtime probe. |
| 9 | Exact KWin version string | ⚠️ Partial | headers are KWin 6.x, exact version unconfirmed | `kwin_6 --version` is **not on PATH** on this box. Try `qdbus6 org.kde.KWin /KWin supportInformation`, or `strings /usr/lib64/libKF6KWin.so.6 \| grep -m1 '6\.[0-9]'`. |
| 10 | Where a plugin must be installed on this build | ❌ Unknown | `~/.local/share/kwin` exists, `~/.local/lib/kwin*` absent | Ask, or read `kwin_6 --help` / the KWin effects docs for the `KPlugin` layout `halo.json` declares. |
| 11 | `InputRedirection` public surface | ✅ Have | `installInputEventFilter` / `uninstallInputEventFilter` public; `input()` inline accessor at `input.h:571` | — |
| 12 | Which compositor actually runs (Plasma 6 vs KWin 5 on X11) | ⚠️ Partial | `XDG_SESSION_TYPE=wayland`, `XDG_CURRENT_DESKTOP=KDE` | Headers are authoritative for the build; confirm the RUNNING compositor matches. |

## Rule

**Gap 8 is resolved: the input contract is publicly reachable on this build.** The architecture's
stated blocker may not exist — that is the single most important finding of this round and it
contradicts the research doc's §21 and §70. Gaps 8b/8c (filter weight, install timing) are small and
are with the specialist.

**Never reconstruct a KWin API from memory or from documentation.** Read `/usr/include/kwin/`. The
Round 1 spike was written from the public API docs and did not compile against the installed headers;
the docs and the shipped API had diverged. Quote the header, with a line number, or say UNKNOWN.