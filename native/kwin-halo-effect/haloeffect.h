/*
 * Halo Island — KWin effect header.
 *
 * GATE 1 (research §89 step 1, RESULT_ROUND2 §"Executive decisions" #7):
 * a minimal effect that PAINTS A FIXED CAPSULE and INSTALLS/UNINSTALLS THE INPUT FILTER.
 * Nothing else. The shared-memory transport is deliberately NOT here yet — their rule is
 * "only then connect the transport", because a prototype that also carries a transport
 * gives you two failures at once and no way to tell which one you have.
 *
 * KWin 6 API. Signatures read from the installed headers, never from documentation:
 *   - /usr/include/kwin/effect/effect.h:709
 *       paintScreen(const RenderTarget&, const RenderViewport&, int, const Region&, LogicalOutput*)
 *   - /usr/include/kwin/effect/effect.h:684
 *       reconfigure(ReconfigureFlags)      <-- the setup hook; `init()` does NOT exist
 *   - /usr/include/kwin/effect/effect.h:675
 *       Q_DECLARE_FLAGS(ReconfigureFlags, ...)  -> GLOBAL scope, so NOT `KWin::ReconfigureFlags`
 *   - /usr/include/kwin/input.h:405           InputEventFilter (KWIN_EXPORT, bool-returning)
 *   - /usr/include/kwin/input.h:571           inline InputRedirection *input()
 *   - /usr/include/kwin/input.h               installInputEventFilter / uninstallInputEventFilter
 *   - /usr/include/kwin/input_event.h:21,34   PointerMotionEvent / PointerButtonEvent
 */

#pragma once

#include <kwin/effect/effect.h>
#include <kwin/core/output.h>
#include <kwin/core/rendertarget.h>
#include <kwin/core/renderviewport.h>
#include <kwin/input.h>
#include <kwin/input_event.h>

/* `Q_INTERFACES(KPluginFactory)` needs the declaration visible in THIS file, because moc parses
 * this header and resolves the name against what it can see here. effect.h includes it
 * transitively via <KPluginFactory>, but relying on a transitive include for a name moc has to
 * resolve produced `error: Undefined interface`. */
#include <KPluginFactory>

#include <QImage>
#include <QObject>
#include <QPointer>
#include <QRect>

namespace HaloEffect
{

/**
 * HOW MANY CONSECUTIVE FAILED INSTALL ATTEMPTS BEFORE GIVING UP.
 *
 * RESULT_ROUND2 is explicit: "Do not let a persistent null singleton create an unbounded
 * zero-delay timer loop" and "limit retry count/time, log one diagnostic, and leave the effect
 * non-interactive if the singleton never becomes available."
 *
 * An unbounded retry here is not a slow leak — it is a zero-delay timer inside the compositor,
 * which starves the compositor's event loop and freezes the whole desktop. Hence a hard cap.
 */
constexpr int kMaxInstallAttempts = 20;

/** The fixed gate-1 capsule. Board 1 / Sizes, Small preset. */
constexpr int kPillWidth = 182;
constexpr int kPillHeight = 28;

class HaloEffect;

/**
 * The selective input filter — the "make-or-break part" of the research doc.
 *
 * EVERY RULE HERE COMES FROM RESULT_ROUND2 §"The hit-test contract". They are not stylistic:
 *
 *  - `pointerMotion` ALWAYS returns false. Motion observation must never consume, or Firefox and
 *    VS Code lose their own hover states. This is the single most important line in the file.
 *  - `pointerButton` fails OPEN. No valid layout, no armed rectangle, stale frame, inactive backend
 *    => `false`, so the click reaches the app underneath. "Visual failure must fail open for input."
 *  - Press and release are a PAIR. A press inside an armed rect captures the gesture; the matching
 *    release is consumed even if the pointer left; the action fires only if the release is still
 *    over the same action.
 *  - A press that starts OUTSIDE an armed rect is never consumed, even if the release lands inside.
 *  - Only the left button is ever owned. Right/middle/wheel/touch/keyboard always pass through.
 *
 * GATE 1 SCOPE: there is no layout transport yet, so `m_armedRect` is empty and this filter
 * consumes NOTHING. That is deliberate and correct — a filter with no published layout must pass
 * every event through. It is also why gate 1 is safe to load into a live session.
 */
/**
 * NOTE: `KWin::InputEventFilter` is NOT a QObject (verified at input.h:405 — it is declared with
 * no base class), so this class cannot also inherit QObject and must not declare `Q_OBJECT`.
 * The EFFECT owns the filter's lifetime and deletes it in its own destructor.
 */
class HaloInputFilter : public KWin::InputEventFilter
{
public:
    explicit HaloInputFilter(QObject *parent, KWin::InputFilterOrder::Order order);

    bool pointerMotion(KWin::PointerMotionEvent *event) override;
    bool pointerButton(KWin::PointerButtonEvent *event) override;

    /* The one armed rectangle, in output-logical coordinates. Empty until a LAYOUT message
     * publishes real DOM hit-targets (gate 2). */
    void setArmedRect(const QRect &rect)
    {
        m_armed = rect;
    }
    bool hasArmedRect() const
    {
        return !m_armed.isEmpty();
    }

private:
    /** Raw owner link — not a QObject base, so no signals/slots across this boundary. */
    QObject *m_owner = nullptr;
    QRect m_armed;
    /** Gesture capture: a press inside `m_armed` arms the release half. See RESULT §hit-test. */
    bool m_captured = false;
};

class HaloEffect : public KWin::Effect
{
    Q_OBJECT

public:
    explicit HaloEffect(QObject *parent = nullptr);
    ~HaloEffect() override;

    void paintScreen(const KWin::RenderTarget &renderTarget,
                     const KWin::RenderViewport &viewport,
                     int mask,
                     const KWin::Region &deviceRegion,
                     KWin::LogicalOutput *screen) override;

    /* KWin 6's setup hook. `init()` was removed from the API. */
    void reconfigure(ReconfigureFlags flags) override;

private:
    /**
     * Idempotent install, called from `reconfigure()` and never from `paintScreen()`.
     *
     * RESULT_ROUND2 §"Safe lifecycle" specifies exactly this shape: install once, retry a bounded
     * number of times if `KWin::input()` is null yet, and give up rather than loop forever.
     */
    void ensureInputFilter();

    void buildCapsule();

    HaloInputFilter *m_filter = nullptr;
    int m_installAttempts = 0;
    bool m_retryScheduled = false;

    QPointer<KWin::LogicalOutput> m_output;
    QImage m_capsule;
    QRect m_position;

    /* Gate 1 observability. A compositor plugin has no stdout, so the state the main process
     * needs to read lives here and is surfaced in a file the app can poll. */
    static void writeStatus(const char *event, const QString &detail = QString());
};

} // namespace HaloEffect

/*
 * THE FACTORY — WRITTEN OUT LONGHAND, NOT VIA `KWIN_EFFECT_FACTORY`
 * ===================================================================
 *
 * WHY NOT THE MACRO. `KWIN_EFFECT_FACTORY(className, jsonFile)` (effect.h:1200) expands to a class
 * whose `Q_PLUGIN_METADATA` is generated BY `moc`. But `moc` does not run the C preprocessor over
 * macros it does not itself define — `Q_PLUGIN_METADATA` reaches our header only by being expanded
 * out of `effect.h`. So moc never saw the factory, emitted no code for it, and the linked library
 * contained neither the factory class nor Qt's plugin entry points.
 *
 * The symptom chain, all measured:
 *   - `nm -D libhalo.so | grep factory`   -> nothing
 *   - `nm -D libhalo.so | grep qt_plugin` -> nothing
 *   - moc output                          -> 90 lines, zero `qt_plugin_instance`
 * A WORKING KWin effect exports both:
 *   /usr/lib64/qt6/plugins/kwin/effects/configs/kcm_kwin4_genericscripted.so
 *     0000000000006d50 T qt_plugin_instance
 *     0000000000006d30 T qt_plugin_query_metadata_v2
 *
 * Qt's loader looks for exactly those two symbols. Without them the .so is a shared library that
 * happens to be Qt-flavoured — not a plugin. That is why KWin reported:
 *     kf.coreaddons: "Could not find plugin /usr/lib64/qt6/plugins/kwin/effects/halo"
 * and `isEffectSupported halo` returned false, even with both files in the right directory and a
 * dlopen that succeeded.
 *
 * Writing the class out here means moc sees a real `class ... { Q_OBJECT Q_PLUGIN_METADATA(...) }`
 * in a file it parses, and emits `qt_plugin_instance` / `qt_plugin_query_metadata_v2` for it.
 *
 * `EffectPluginFactory_iid` is the IID macro at effect.h:1131. The `_SUPPORTED_ENABLED` variants of
 * the macro only differ in `isSupported()` / `enabledByDefault()`, both `true` here — which is
 * exactly what the two-argument `KWIN_EFFECT_FACTORY` expands to (effect.h:1200-1201).
 */
class halo_factory : public KWin::EffectPluginFactory
{
    Q_OBJECT
    Q_PLUGIN_METADATA(IID "org.kde.kwin.EffectPluginFactory" FILE "halo.json")
    Q_INTERFACES(KPluginFactory)

public:
    explicit halo_factory()
    {
    }
    ~halo_factory() override
    {
    }

    bool isSupported() const override
    {
        return true;
    }
    bool enabledByDefault() const override
    {
        return true;
    }
    KWin::Effect *createEffect() const override
    {
        return new HaloEffect::HaloEffect();
    }
};