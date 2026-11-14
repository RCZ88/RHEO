// Landing live-verify probe — vault lap + tour + hero centering on https://rheooo.pages.dev
// Final recipe proven 2026-11-15 (v10.3, chunks 234rqp5glonys). Run via Code Mode `execute`:
// paste the body of verify() steps into an execute call (tools.probe.* are Code-Mode-only).
//
// HARD-WON RULES (each cost a session):
// 1. Assert OPEN on `path.sil.hi` count === 3. The visible "read …" line says
//    "read rest" even when the vault is OPEN — never assert on the read string.
// 2. probe.eval returns a WRAPPER { target, value, ledger } — conditionals on the
//    result must read `.value` (a `mark.found` check on the wrapper silently
//    skipped the tour phase for three whole sessions).
// 3. probe.click takes `ref` (from probe.snapshot(), format "@e9"), NOT a selector
//    and NOT a `target` key. Scroll the button into view BEFORE snapshot.
// 4. probe.open({url}) returns before navigation completes — wait_for
//    { selectorVisible: "#hero" } BEFORE injecting helpers, or the page
//    navigation wipes them ("window.__poll is not a function").
// 5. The probe MCP server is SHARED across concurrent agents — keep open+act+close
//    in ONE execute call; re-attach with the recorded port if stolen mid-work.
// 6. emulate({reducedMotion}) must happen in the SAME session as the test that
//    depends on it, and prove it took with matchMedia before interpreting.
// 7. set_viewport({width:1440,height:900}) before measuring the hero — the probe's
//    default window is ~437px tall and the hero section is 100vh (min 600px), so
//    every un-resized measurement is garbage. Correct result: wrapper center 450
//    == vh/2, delta 0, band flush with section bottom.

export const CHROME = "/home/clementzhao/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
export const URL = "https://rheooo.pages.dev";

export const HELPERS = String.raw`(function(){
  window.__read = function(){ var best=null; document.querySelectorAll('div').forEach(function(d){
    var t=(d.textContent||'').trim(); if(t.indexOf('read ')===0 && (best===null||t.length<best.length)) best=t; }); return best; };
  window.__tab = function(id){ var t=document.getElementById('figure-tab-'+id);
    return t && t.getAttribute('aria-disabled')!=='true' ? t : null; };
  window.__panel = function(){ return document.getElementById('figure-panel'); };
  window.__sil = function(){ var f=window.__panel(); return f?f.querySelectorAll('path.sil.hi').length:-1; };
  window.__sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  window.__poll = async function(fn,ms){ var by=performance.now()+ms;
    while(performance.now()<by){ var v=fn(); if(v) return v; await window.__sleep(100); } return null; };
  return 'ok';
})()`;

// Expected results on v10.3 (all sil-based):
//  hero:        { vh:900, sectionH:900, wrapCenter:450, deltaVsVhCenter:0 }
//  lap:         sil trail ends at 3 (corrective lap lands it ~+4s); finalSil 3
//  rm-from-open: layers mounts instantly (dialLap fast path), NO V5 abort
//  rm-from-closed: sil 3
//  tour:        snapshot ref click runs the tour; re-enabled, vault open, no errors
//  console:     zero errors
