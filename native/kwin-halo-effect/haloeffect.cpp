/*
 * Halo Island — KWin compositor effect. GATE 1.
 *
 * Research: agent/docs/halo/HALO_WINDOWLESS_COMPOSITOR_RESEARCH.md
 * Ruling:  agent/docs/backandfourth-docs/halo-kwin-outside-app/RESULT_ROUND2.md
 *
 * GATE 1 DOES EXACTLY TWO THINGS (research §89 step 1):
 *   1. paints a fixed 182x28 capsule AFTER the normal scene
 *   2. installs and uninstalls the selective input filter
 *
 * It deliberately does NOT draw anything real yet. No transport, no frame, no layout rect.
 * The capsule is a placeholder whose only job is to prove the effect loads, chains correctly,
 * and sits above native Wayland applications. That is the one thing every later gate assumes,
 * so it is the one thing worth proving first.
 *
 * CRASH DISCIPLINE (research §24). This code runs INSIDE the compositor. A crash here takes down
 * the desktop shell, not just the island. Therefore: chain the scene first and unconditionally,
 * never dereference without a null check, bound every retry, and never throw.
 */

#include "haloeffect.h"

#include <QFile>
#include <QPainter>
#include <QRect>
#include <QTextStream>
#include <QTimer>

namespace HaloEffect
{

/* ── HaloInputFilter ────────────────────────────────────────────────────────────────
 * The entire selection contract. Read RESULT_ROUND2 §"The hit-test contract" alongside this. */

HaloInputFilter::HaloInputFilter(QObject *parent, KWin::InputFilterOrder::Order order)
    : KWin::InputEventFilter(order)
    , m_owner(parent)
{
    /* `InputEventFilter` is NOT a QObject — verified at input.h:405, where it is declared
     * `class KWIN_EXPORT InputEventFilter` with no base. So multiple inheritance with QObject is
     * impossible, and `QObject(parent)` is a hard compile error:
     *
     *     error: type 'QObject' is not a direct base of 'HaloInputFilter'
     *
     * Lifetime is therefore held by the EFFECT, which deletes the filter in its own destructor
     * (where `InputEventFilter`'s own destructor does the uninstall). The owner link is a raw
     * QObject pointer because no signal/slot is needed across the boundary at gate 1. */
    Q_UNUSED(parent)
}

bool HaloInputFilter::pointerMotion(KWin::PointerMotionEvent *event)
{
    /* ALWAYS false. Never consume a motion event.
     *
     * RESULT_ROUND2 §hit-test, verbatim: "pointerMotion: update the global pointer sample / hover
     * FSM, but **always return false**. This preserves mouse movement and hover for Firefox/VS
     * Code and keeps KWin's normal pointer routing intact."
     *
     * Gate 1 has no hover FSM to drive, so this is purely the pass-through. Returning `true` here
     * would make the mouse feel broken on every application on the desktop — the single worst
     * failure this plugin could produce, and the easiest to write by accident. */
    Q_UNUSED(event)
    return false;
}

bool HaloInputFilter::pointerButton(KWin::PointerButtonEvent *event)
{
    /* FAIL OPEN, ALWAYS, UNTIL A REAL LAYOUT ARRIVES.
     *
     * Gate 1 publishes no `actionRects`, so `m_armed` is empty. An empty armed rect means "the
     * island owns nothing", and owning nothing means consuming nothing. Every button therefore
     * passes through to the app underneath. That is the correct gate-1 behaviour and it is also
     * what makes this plugin safe to load into a live session before gate 2 exists. */
    if (!event) {
        return false;
    }

    /* Only the left button is ever ours. Right / middle / wheel must reach the app regardless of
     * geometry — RESULT: "Do not consume wheel, touch, keyboard, or unrelated mouse buttons
     * unless that exact action is implemented and tested." */
    if (event->button != Qt::LeftButton) {
        return false;
    }

    const bool isPress = event->state == KWin::PointerButtonState::Pressed;

    if (isPress) {
        /* A press inside an armed rectangle CAPTURES the gesture. The release half is consumed
         * even if the pointer leaves the rectangle, so a swallowed press can never be followed by
         * a release delivered to the application underneath. */
        m_captured = m_armed.isValid() && m_armed.contains(event->position.toPoint());
        /* `m_captured` stays false here at gate 1 because `m_armed` is empty, so this returns
         * false and the click reaches the app. The code path is complete for gate 2. */
        return m_captured;
    }

    /* Release. Consume it only if this gesture was captured, and only fire an action when the
     * release is still over the same rect. Gate 1 fires nothing; it only releases the capture. */
    if (!m_captured) {
        return false;
    }
    m_captured = false;
    return true;
}

/* ── HaloEffect ──────────────────────────────────────────────────────────────────── */

/**
 * A compositor plugin has no usable stdout — KWin does not forward it, and the desktop is managed
 * by a system service rather than a terminal the user can see.
 *
 * So the observable state of the effect is written to a small file the RHEO main process polls.
 * This is the ONLY way to tell "the plugin never loaded" from "it loaded and is painting", which
 * are otherwise indistinguishable from the app's side.
 */
void HaloEffect::writeStatus(const char *event, const QString &detail)
{
    /* Best effort. A plugin must never fail because it could not write a diagnostic. */
    try {
        const QString path = qEnvironmentVariable("XDG_STATE_HOME", QStringLiteral("/tmp"))
            + QStringLiteral("/rheo/halo-kwin-effect.status");
        QFile f(path);
        if (!f.open(QIODevice::WriteOnly | QIODevice::Truncate | QIODevice::Text)) {
            return;
        }
        QTextStream out(&f);
        out << "{\"event\":\"" << QString::fromLatin1(event) << "\"";
        if (!detail.isEmpty()) {
            out << ",\"detail\":\"" << detail << "\"";
        }
        out << "}\n";
        out.flush();
    } catch (...) {
        /* Never propagate. See research §24. */
    }
}

HaloEffect::HaloEffect(QObject *parent)
    : KWin::Effect(parent)
{
}

HaloEffect::~HaloEffect()
{
    /* Delete the filter while KWin's input singleton is still alive. `InputEventFilter`'s
     * destructor uninstalls it automatically (input.h:409 "Deleting an instance of InputEventFilter
     * automatically uninstalls it from InputRedirection"), so this is the whole teardown. */
    delete m_filter;
    m_filter = nullptr;
    writeStatus("unloaded");
}

void HaloEffect::reconfigure(ReconfigureFlags flags)
{
    /* Chain FIRST. Then install. RESULT_ROUND2 §"Safe lifecycle" specifies exactly this. */
    KWin::Effect::reconfigure(flags);
    ensureInputFilter();
    writeStatus("reconfigured");
}

void HaloEffect::ensureInputFilter()
{
    /* IDEMPOTENT. A second reconfigure must not install a second filter — that would double every
     * event and is the failure their `halo-kwin-filter-lifecycle.probe` gate exists to catch. */
    if (m_filter) {
        return;
    }

    /* The attempt cap is checked BEFORE the singleton probe so a permanently-null singleton costs
     * exactly kMaxInstallAttempts event-loop turns and then stops. */
    if (m_installAttempts >= kMaxInstallAttempts) {
        if (!m_retryScheduled) {
            m_retryScheduled = true;
            writeStatus("filter-install-GAVE-UP",
                        QStringLiteral("input() never became available; effect stays non-interactive"));
        }
        return;
    }

    auto *redirect = KWin::input();
    if (!redirect) {
        m_installAttempts++;
        if (!m_retryScheduled) {
            m_retryScheduled = true;
            /* singleShot(0) defers to the next event-loop turn so plugin-load cannot spin here.
             * Combined with the attempt cap this is bounded, which is the whole point. */
            QTimer::singleShot(0, this, [this] {
                m_retryScheduled = false;
                ensureInputFilter();
            });
        }
        return;
    }

    /* Filter weight.
     *
     * RESULT_ROUND2 says `InputFilterOrder::Later` — BUT THAT ENUM VALUE DOES NOT EXIST on this
     * build. The real enum (input.h:355-380) is:
     *
     *   PlaceholderOutput, Dpms, ButtonRebind, SlowKeys, BounceKeys, StickyKeys, MouseKeys,
     *   EisInput, VirtualTerminal, LockScreen, ScreenEdge, DragAndDrop, WindowSelector, TabBox,
     *   GlobalShortcut, Effects, InteractiveMoveResize, Popup, Decoration, WindowAction,
     *   XWayland, InternalWindow, InputMethod, Forward
     *
     * "Lower values come first" (input.h:409). Their stated CONTRACT is "after WM/system filters,
     * before the final forwarding filter", so the correct real value is `Decoration` — the last
     * policy filter before the cluster of window-forwarding filters. `Forward` is explicitly
     * excluded: installing after it means the filter cannot intercept anything.
     *
     * `Effects` is explicitly rejected by RESULT ("too early and risks interfering with KWin's own
     * effect input handling"), which is consistent with this reading.
     */
    m_filter = new HaloInputFilter(this, KWin::InputFilterOrder::Decoration);
    redirect->installInputEventFilter(m_filter);
    writeStatus("filter-installed", QStringLiteral("order=Decoration"));
}

void HaloEffect::buildCapsule()
{
    /* Gate 1 placeholder. The real colours come from the Figma token block later; this only has to
     * be visibly a capsule, opaque enough to tell it from a rendering artefact. */
    const qreal dpr = m_output ? m_output->scale() : 1.0;
    const int pw = static_cast<int>(kPillWidth * dpr);
    const int ph = static_cast<int>(kPillHeight * dpr);

    m_capsule = QImage(pw, ph, QImage::Format_ARGB32_Premultiplied);
    if (m_capsule.isNull()) {
        return;
    }
    m_capsule.fill(Qt::transparent);

    QPainter p(&m_capsule);
    p.setRenderHint(QPainter::Antialiasing, true);
    p.setPen(Qt::NoPen);
    /* #202024 at ~92% — the dark theme's bg/base family. */
    p.setBrush(QColor(32, 32, 36, 235));
    p.drawRoundedRect(QRectF(0.0, 0.0, pw, ph), ph / 2.0, ph / 2.0);
    p.end();
}

void HaloEffect::paintScreen(const KWin::RenderTarget &renderTarget,
                             const KWin::RenderViewport &viewport,
                             int mask,
                             const KWin::Region &deviceRegion,
                             KWin::LogicalOutput *screen)
{
    /* CHAIN FIRST, UNCONDITIONALLY. Research §19: the normal scene is painted exactly once before
     * anything of ours. Returning early WITHOUT chaining would blank the user's desktop — which
     * is why the "nothing to draw" path below still falls through to this call. */
    KWin::Effect::paintScreen(renderTarget, viewport, mask, deviceRegion, screen);

    if (!screen) {
        return;
    }

    if (m_output != screen) {
        m_output = screen;
        buildCapsule();
    }

    if (m_capsule.isNull()) {
        return;
    }

    /* Top-centre in output-logical coordinates, matching `surfaceAnchorFractions('top')` in
     * src/shared/halo/geometry.ts. Both sides centre on the output so the surface cannot drift
     * from where the renderer believes it is. */
    const KWin::Rect g = screen->geometry();
    const qreal dpr = screen->scale() > 0 ? screen->scale() : 1.0;
    const int logicalW = static_cast<int>(m_capsule.width() / dpr);
    const int logicalH = static_cast<int>(m_capsule.height() / dpr);
    m_position = QRect(g.x() + (g.width() - logicalW) / 2, g.y(), logicalW, logicalH);

    /* QImage backend only.
     *
     * The GL backend needs a texture upload and a blend-state change inside the compositor. Doing
     * that wrong is exactly the crash research §24 warns about, so this revision returns without
     * drawing on GL rather than risk the desktop. Gate 1's job is to prove the effect LOADS and
     * CHAINS; whether the compositor is running the software or GL backend is a gate-2 question.
     *
     * If this turns out to be a GL session, the capsule will not appear and that is the honest
     * result to report — not something to paper over with an unsafe texture path. */
    QImage *target = renderTarget.image();
    if (!target) {
        static bool warned = false;
        if (!warned) {
            warned = true;
            writeStatus("paint-skipped", QStringLiteral("GL backend: renderTarget.image() is null"));
        }
        return;
    }

    QPainter painter(target);
    painter.setRenderHint(QPainter::SmoothPixmapTransform, true);
    painter.drawImage(m_position.topLeft(), m_capsule);
    painter.end();

    /* NO EXPLICIT REPAINT CALL — AND THAT IS DELIBERATE, WITH A KNOWN LIMITATION.
     *
     * `LogicalOutput` has no `repaintRegion()` in KWin 6 (verified: no `repaint` member in
     * core/output.h). The scheduling entry point is `RenderLoop::scheduleRepaint()`
     * (core/renderloop.h:79), and an effect has no public handle to the render loop —
     * `Compositor::composite(RenderLoop*)` only passes one in, it does not hand one out.
     *
     * So the capsule relies on the compositor painting frames for other reasons. On a live desktop
     * that is effectively continuous — pointer motion, window updates, animations all schedule
     * repaints — so a gate-1 capsule is visible in practice.
     *
     * THE LIMITATION, STATED PLAINLY: on a completely idle desktop the capsule could be missed.
     * A static overlay needs a self-scheduled repaint, and that needs a render-loop handle this
     * API does not currently expose to plugins. The real fix is a `QTimer` in the effect that
     * requests a repaint while a frame is armed, which is a GATE-2 concern: it only becomes
     * necessary once frames are live and the capsule actually changes.
     *
     * I am noting this rather than silently omitting it, because "it worked on my busy desktop"
     * is exactly how a repaint bug survives. */
}

} // namespace HaloEffect