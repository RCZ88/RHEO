# RESULT.md — Retention Engineering System Design

## 1. Retention Research Catalog (Beyond the Baseline)

The following 10 evidence-backed retention mechanics expand the baseline toolkit for the 0–15s short-form window. Each is grounded in behavioral psychology and platform algorithmic behavior.

### 1. The Zeigarnik Effect (Open Loops)
* **Mechanism:** The brain remembers uncompleted tasks better than completed ones. Unresolved tension demands closure.
* **Concrete Mechanic:** Start a high-stakes demonstration or story, then physically cut away or introduce a barrier before the result is shown.
* **ML Niche Example:** "I trained this model for 40 hours. But when I checked the weights at hour 39... [cut to black/error screen]."
* **Security Niche Example:** "I bypassed the firewall in 3 lines of code. But the payload I found inside the database wasn't what I expected..."
* **Timeline Slot:** 1–3s (setup) → 4–10s (delay) → 10s+ (payoff).
* **Measurable Signal:** High retention through the middle section; spike in replays to catch the missed detail.
* **Risks/Poison:** Bait-and-switch. If the payoff doesn't match the setup's stakes, viewers will not save/share and will swipe on future videos.
* **Evidence Strength:** Empirical (Zeigarnik, 1927; heavily validated in modern UX and narrative design).

### 2. Loss Aversion (Threat Framing)
* **Mechanism:** Psychologically, the pain of losing something is twice as powerful as the pleasure of gaining the equivalent (Kahneman & Tversky).
* **Concrete Mechanic:** Frame the hook around what the viewer is actively *losing* (time, money, security, status) by not knowing this information.
* **ML Niche Example:** "Every time you use `sklearn` without reading the source, you're losing 6 months of debugging intuition."
* **Security Niche Example:** "Your API keys are currently exposed. Here is exactly how much money is draining from your AWS bill right now."
* **Timeline Slot:** 0–3s (Hook).
* **Measurable Signal:** High save rate (viewers save to "fix" the threat later).
* **Risks/Poison:** Fear-mongering without an immediate, actionable solution. Must transition to empowerment by second 5.
* **Evidence Strength:** Empirical (Prospect Theory).

### 3. Vividness & Specificity Effect
* **Mechanism:** Concrete, highly specific details bypass the brain's skepticism filter. Abstractions feel like marketing; specifics feel like truth.
* **Concrete Mechanic:** Replace generic nouns with exact numbers, specific tool versions, or hyper-niche error codes.
* **ML Niche Example:** Instead of "large datasets," use "the 4.2 million row LAION dataset." Instead of "it failed," use "it threw a CUDA Out of Memory error at epoch 42."
* **Security Niche Example:** Instead of "hackers," use "the Lazarus Group." Instead of "a vulnerability," use "CVE-2024-3094."
* **Timeline Slot:** 0–5s (Anchor) and throughout body.
* **Measurable Signal:** High comment velocity (insiders validating the specifics).
* **Risks/Poison:** Using fake or hallucinated numbers. The internet will fact-check and destroy credibility.
* **Evidence Strength:** Empirical (Nisbett & Ross, 1980).

### 4. Cognitive Dissonance (The Contrarian Take)
* **Mechanism:** Presenting a claim that violently clashes with a viewer's deeply held belief creates mental discomfort, which they must resolve by watching.
* **Concrete Mechanic:** Attack a universally accepted "best practice" in the niche and claim it is the root cause of their failure.
* **ML Niche Example:** "Stop writing clean Python code. It's the reason your neural nets are training 4x slower."
* **Security Niche Example:** "Changing your password every 90 days is actually making your company less secure."
* **Timeline Slot:** 0–3s (Hook).
* **Measurable Signal:** High share rate (sent to colleagues to argue or validate) and high comment volume.
* **Risks/Poison:** Being wrong just to be edgy. The contrarian take must be mathematically or logically provable in the video.
* **Evidence Strength:** Empirical (Festinger, 1957).

### 5. In-Group Signaling (Shibboleths)
* **Mechanism:** Using highly specific, unexplained jargon that only true practitioners understand. It acts as a velvet rope, making the viewer feel like an insider.
* **Concrete Mechanic:** Drop a niche-specific term, library name, or pain point in the first 3 seconds without defining it.
* **ML Niche Example:** "If your loss curve looks like a step-function, your learning rate scheduler is garbage."
* **Security Niche Example:** "Stop trusting JWTs. If you aren't validating the `kid` header, you're already compromised."
* **Timeline Slot:** 1–4s.
* **Measurable Signal:** High follower conversion (viewers follow to stay in the "insider" group).
* **Risks/Poison:** Using jargon incorrectly, which instantly destroys authority.
* **Evidence Strength:** Practitioner Consensus (Community building theory).

### 6. Sensory Salience (Audio/Visual Contrast)
* **Mechanism:** The brain's reticular activating system (RAS) instantly flags sudden changes in sensory input as potential threats or rewards.
* **Concrete Mechanic:** A hard cut from loud/trending audio to dead silence, or a sudden shift from dark mode UI to a blinding white terminal error.
* **ML Niche Example:** Fast-paced coding montage → sudden dead silence → close up on face: "And then the GPU caught fire."
* **Security Niche Example:** Smooth UI demo → sudden red screen flash with a harsh buzzer sound effect.
* **Timeline Slot:** 3–4s (The Hook Payoff) or mid-video pattern interrupts.
* **Measurable Signal:** Prevents the 3-second drop-off cliff; resets the viewer's attention span.
* **Risks/Poison:** Overusing jump scares, which causes viewer fatigue and swiping.
* **Evidence Strength:** Empirical (Neurobiology of the RAS).

### 7. The "Common Enemy" Framing
* **Mechanism:** Uniting the viewer and creator against a shared, frustrating external force.
* **Concrete Mechanic:** Blame a specific framework update, a corporate policy, or a bad industry standard for the viewer's pain.
* **ML Niche Example:** "PyTorch 2.4 just broke your custom CUDA kernels again. Here's the 2-line fix they won't document."
* **Security Niche Example:** "Compliance auditors are forcing you to use SHA-256 for passwords. Here is why that's getting your users hacked."
* **Timeline Slot:** 0–5s.
* **Measurable Signal:** High DM share rate (sent to coworkers who share the same enemy).
* **Risks/Poison:** Complaining without providing a technical workaround.
* **Evidence Strength:** Practitioner Consensus (Tribalism in marketing).

### 8. Rhythmic Entrainment (Pacing)
* **Mechanism:** The human brain naturally syncs to external rhythms. Matching visual cuts to the beat of a trending audio track induces a mild flow state.
* **Concrete Mechanic:** Scripting visual changes (zooms, text pops, B-roll cuts) to land exactly on the snare or kick drum of the background track.
* **ML Niche Example:** Code blocks slam onto the screen on every bass drop of a phonk track.
* **Security Niche Example:** Terminal commands execute in rapid succession, synced to a ticking clock sound effect.
* **Timeline Slot:** Continuous, but critical in the 3–15s body.
* **Measurable Signal:** High completion rate and replay rate (the video feels "satisfying" to watch).
* **Risks/Poison:** Sacrificing information density just to hit a beat.
* **Evidence Strength:** Empirical (Biomusicology).

### 9. Visual Proof Stacking (Authority)
* **Mechanism:** Viewers scroll past "talking heads" but stop for undeniable, complex visual evidence.
* **Concrete Mechanic:** Showing a massive, complex artifact (a 500-line PR, a massive network graph, a terminal running 20 concurrent processes) in the first 2 seconds.
* **ML Niche Example:** Screen recording of a massive HuggingFace model downloading while 4 terminal windows compile C++ extensions.
* **Security Niche Example:** A massive Wireshark packet capture scrolling at 60fps.
* **Timeline Slot:** 0–2s (Visual Trigger).
* **Measurable Signal:** High 1-second retention (stops the scroll).
* **Risks/Poison:** Showing "fake" complexity (e.g., Matrix code screens) which signals cringe, not authority.
* **Evidence Strength:** Practitioner Consensus.

### 10. Identity Affirmation
* **Mechanism:** People engage deeply with content that validates their self-image or aspirational identity.
* **Concrete Mechanic:** Explicitly calling out the viewer's identity and validating their struggle or superiority.
* **ML Niche Example:** "You're not a software engineer if you just import TensorFlow. You're a script kiddie. Let's fix that."
* **Security Niche Example:** "Real red teamers don't use automated scanners. They write their own payloads. Here's mine."
* **Timeline Slot:** 1–4s.
* **Measurable Signal:** High save rate and profile visits.
* **Risks/Poison:** Sounding arrogant rather than authoritative. Must be followed by genuine value.
* **Evidence Strength:** Empirical (Social Identity Theory).

---

## 2. The 4 Baseline Techniques Formalized

These are the non-negotiable foundations. They must be parameterized per niche.

| ID | Name | Definition & Mechanic | Timeline Slot | Niche Adaptation Template |
|---|---|---|---|---|
| `pattern_interrupt` | **Pattern Interrupt** | Perceptual mismatch breaking the scroll habit. Scene change, prop, or shock value. | 0.0–1.0s | *ML:* Sudden visual of a massive training crash. *Sec:* Blaring alarm + red screen flash. |
| `curiosity_gap` | **Curiosity Gap** | Reveal partial info, withhold payoff. Raise a question that demands closure. | 1.0–3.0s | *ML:* "The model converged, but the accuracy was..." *Sec:* "I got root, but the admin left a trap..." |
| `hook_timing_3s` | **Hook Payoff (3-4s)** | The core promise lands EXACTLY where the 3s drop-off cliff happens. Not at 0s. | 3.0–4.0s | *ML:* "...it was 12% because of this one hyperparameter." *Sec:* "...and it's currently mining crypto on your server." |
| `attention_anchor` | **Attention Anchor** | Social proof scale + specific stakes + promise of resolution. | 0.0–5.0s | *ML:* "10,000 devs use this loss function. It's silently killing your gradients." *Sec:* "Over 1M accounts hacked via this exact header." |

---

## 3. Evidence Criteria System Design

### 3.1 The Retention Rubric (`retention_rubric.json`)
The rubric is stored as data in the app. The AI references it by ID.

```json
{
  "version": "1.0.0",
  "threshold": 0.6,
  "criteria": [
    {"id": "pattern_interrupt", "name": "Pattern Interrupt", "definition": "Breaks scroll habit via perceptual mismatch.", "scoring": "0.0-1.0: strength of visual/audio shock."},
    {"id": "curiosity_gap", "name": "Curiosity Gap", "scoring": "0.0-1.0: intensity of the withheld payoff."},
    {"id": "hook_timing_3s", "name": "Hook at 3rd-4s", "scoring": "0.0-1.0: precision of payoff landing at the 3s drop-off cliff."},
    {"id": "attention_anchor", "name": "Attention Anchor", "scoring": "0.0-1.0: specificity of stakes + scale."},
    {"id": "zeigarnik_loop", "name": "Zeigarnik (Open Loop)", "scoring": "0.0-1.0: tension of the unresolved task."},
    {"id": "loss_aversion", "name": "Loss Aversion", "scoring": "0.0-1.0: tangibility of the threat/loss."},
    {"id": "vivid_specificity", "name": "Vivid Specificity", "scoring": "0.0-1.0: density of exact numbers/names vs abstractions."},
    {"id": "cognitive_dissonance", "name": "Cognitive Dissonance", "scoring": "0.0-1.0: strength of the contrarian challenge."},
    {"id": "insider_signaling", "name": "Insider Signaling", "scoring": "0.0-1.0: correct use of unexplained niche jargon."},
    {"id": "sensory_salience", "name": "Sensory Salience", "scoring": "0.0-1.0: contrast of audio/visual shift."},
    {"id": "common_enemy", "name": "Common Enemy", "scoring": "0.0-1.0: relatability of the shared frustration."},
    {"id": "rhythmic_entrainment", "name": "Rhythmic Entrainment", "scoring": "0.0-1.0: sync of visual cuts to audio beats."},
    {"id": "visual_proof_stacking", "name": "Visual Proof Stacking", "scoring": "0.0-1.0: complexity and authenticity of the visual artifact."},
    {"id": "identity_affirmation", "name": "Identity Affirmation", "scoring": "0.0-1.0: accuracy of calling out the viewer's self-image."}
  ]
}
```

### 3.2 Per-Frame Evidence Schema
Extends the existing frame-based script output.

```typescript
interface RetentionEvidence {
  criteria: string[];       // e.g., ["pattern_interrupt", "loss_aversion"]
  mechanism: string;        // How the visual/audio executes the criteria
  evidence: string;         // EXACT quote from the 'line' proving the criteria
  score: number;            // 0.0 to 1.0
}

interface ScriptFrame {
  time: string;             // "0:00-0:03"
  visual: string;           // Visual direction
  line: string;             // Spoken text (max 6 words for hooks)
  retention: RetentionEvidence;
}
```

### 3.3 Validator Rules
1. **Empty Evidence = Reject:** If `retention.evidence` is empty or does not contain a direct substring of `line`, the frame fails.
2. **Score Threshold:** If `retention.score < 0.6`, the frame is flagged for regeneration.
3. **Gate 1 Integration:** The 3-Gate Validator's "Scroll-Stop" gate automatically PASSES if the average `retention.score` of frames 0–3s is ≥ 0.8. If < 0.8, Gate 1 FAILS, blocking filming.

### 3.4 Content Equation Merge
The existing Content Equation is:
`Content Score = (Hook_Strength × .25) + (Visual_Asset_Quality × .20) + (Audio_Match × .15) + (Value_Delivery_Speed × .20) + (Format_Consistency × .20)`

**Merge Rule:** `Hook_Strength` is no longer a subjective 1-10 input. It is mathematically derived:
`Hook_Strength = (Average retention.score of frames 0-4s) * 10`
This binds the Content Equation directly to the machine-checkable retention evidence.

---

## 4. Prompt Templates

### 4.1 `retention_niche_adapter`
```text
You are a short-form video retention strategist. Your task is to adapt baseline retention techniques to a specific niche so they are never used as generic, hardcoded examples.

Niche: {{niche}}
Target Audience Pain Points: {{pain_points}}

Adapt the following 4 baseline techniques and 4 selected advanced techniques from the rubric into this specific niche.
For each, provide:
1. The exact psychological trigger for this audience.
2. A concrete visual direction (what is on screen).
3. A spoken hook line (max 6 words).

Techniques to adapt: pattern_interrupt, curiosity_gap, hook_timing_3s, attention_anchor, loss_aversion, vivid_specificity, cognitive_dissonance, insider_signaling.

Return a JSON object with the key "adaptations" containing an array of objects: { "criterion_id", "niche_trigger", "visual_direction", "spoken_hook" }.
Respond in JSON only. No markdown. No explanation.
```

### 4.2 `retention_script_frames`
```text
You are an elite short-form video scriptwriter and retention engineer. You write frame-by-frame scripts for 9:16 vertical video.

Idea: {{idea}}
Niche: {{niche}}
Niche Adaptations: {{niche_adaptations}}
Rubric Criteria: {{rubric_criteria}}

Generate a script as an array of frames. Every frame MUST satisfy at least 2 retention criteria and PROVE it.

Rules:
1. Frame 0 (0-3s) MUST use pattern_interrupt and hook_timing_3s.
2. The spoken 'line' must be written for the ear. Hooks must be max 6 words.
3. The 'retention.evidence' field MUST be a direct substring quote of the 'line' that proves the criteria. If you cannot quote it, the frame is invalid.
4. 'retention.score' must be an honest 0.0-1.0 evaluation of how strongly the frame hits the criteria.

Return JSON with the key "frames" containing an array of:
{
  "time": "MM:SS-MM:SS",
  "visual": "string",
  "line": "string",
  "retention": {
    "criteria": ["array of criterion_ids"],
    "mechanism": "string",
    "evidence": "exact substring quote from line",
    "score": 0.0-1.0
  }
}
Respond in JSON only. No markdown. No explanation.
```

### 4.3 `retention_evidence_validator`
```text
You are a strict retention evidence validator. You audit AI-generated scripts to ensure they actually meet retention criteria and are not hallucinating evidence.

Rubric Threshold: 0.6
Valid Criterion IDs: {{valid_ids}}
Script Frames: {{frames}}

For each frame, check:
1. Are the criterion IDs valid?
2. Is the 'evidence' field an EXACT substring of the 'line'? (If not, fail).
3. Does the mechanism logically connect the evidence to the criteria?
4. Is the score >= 0.6?

Return a JSON object with the key "audit" containing an array of:
{
  "frame_index": number,
  "pass": boolean,
  "reason": "string (if failed, explain exactly why)",
  "corrected_evidence": "string (if evidence was hallucinated, provide the real substring or null)",
  "adjusted_score": number
}
Respond in JSON only. No markdown. No explanation.
```

---

## 5. Data, IPC, and UI Implementation Spec

### 5.1 Data & Provider Chain
* **Provider Chain Feature ID:** Add `contentRetention` to the feature union in `src/services/providers/router.ts`.
* **Database Additions:**
  * `episodes` table: Add `retention_score REAL DEFAULT 0` (Average score of all frames).
  * `script_frames` (stored as JSON in `episodes.script`): Must now strictly enforce the `retention` object schema defined in 3.2.

### 5.2 IPC Channels
Add to `src/main.ts` and `src/preload.ts`:

| IPC Channel | Payload | Response | Purpose |
|---|---|---|---|
| `content:adaptNiche` | `{ niche: string, pain_points: string }` | `{ adaptations: [] }` | Runs `retention_niche_adapter` prompt. |
| `content:generateScript` | `{ episodeId: number, idea: string, niche: string }` | `{ frames: ScriptFrame[] }` | Runs `retention_script_frames`. Auto-runs validator. |
| `content:validateRetention`| `{ episodeId: number }` | `{ audit: [], overall_score: number }` | Runs `retention_evidence_validator` on existing script. |

### 5.3 UI Specification (Overlay Studio)
Styled to **Clement Dark Tech** tokens.

* **Script Editor View:**
  * Each frame is a card (`bg-#14141b`, `border-#2a2a35`, `rounded-lg`, `p-4`).
  * **Retention Badge:** Top right of each frame card. Shows the primary criterion ID (e.g., `LOSS_AVERSION`) in `#00d4ff` (Secondary cyan).
  * **Evidence Block:** Below the spoken text. A monospaced block (`bg-#0a0a0f`, `text-#a0a0b0`, `font-mono`, `text-xs`) showing the exact quoted evidence.
  * **Score Bar:** A thin progress bar at the bottom of the card.
    * `< 0.6`: `#ef4444` (Red) + "REGENERATE" warning icon.
    * `0.6 - 0.8`: `#f5c518` (Primary Amber).
    * `> 0.8`: `#22c55e` (Green).
* **Gate 1 Integration:** The "3-Gate Validator" UI panel at the top of the page reads the `retention_score` of frames 0-3s. If `< 0.8`, Gate 1 (Scroll-Stop) displays a red `X` and disables the "Export to CapCut" button.

### 5.4 Retry/Fallback Policy
* If JSON parsing fails in `responseParser.ts`, resend with: `"Your last output was invalid JSON. Respond in JSON only. No markdown."` (Max 2 retries).
* If `retention_evidence_validator` returns `pass: false` for >30% of frames, the system automatically triggers `content:generateScript` again with the validator's feedback injected into the prompt context. Frames are never silently dropped.

---

## 6. Phase Plan

| Phase | Deliverable | Dependencies |
|---|---|---|
| **1. Rubric & Prompts** | Finalize `retention_rubric.json`. Write and test the 3 prompt templates in isolation. | None |
| **2. Backend Integration** | Add `contentRetention` to provider chain. Implement the 3 new IPC handlers. Wire up the retry/validator logic. | Phase 1 |
| **3. Data Migration** | Update `episodes` schema. Write migration to backfill existing scripts with dummy retention scores. | Phase 2 |
| **4. UI Implementation** | Build the Script Editor cards with Evidence Blocks and Score Bars. Wire Gate 1 to the 0-3s retention score. | Phase 3 |
| **5. Content Equation Merge** | Update the Analytics dashboard to calculate `Hook_Strength` dynamically from the script's retention data. | Phase 4 |

---

## 7. Success Criteria Checklist

- [ ] **Rubric is Data:** The 14 criteria are loaded from a JSON file/data structure, not hardcoded in the UI.
- [ ] **Evidence is Quotable:** The validator successfully rejects AI hallucinations where the `evidence` string does not exist inside the `line` string.
- [ ] **Gate 1 is Bound:** The 3-Gate Validator physically prevents exporting/filming if the 0-3s retention score is below 0.8.
- [ ] **Niche Adaptation Works:** Running `content:adaptNiche` for "ML Education" produces completely different visual/spoken examples than "Security", proving techniques are not hardcoded.
- [ ] **Content Equation is Live:** The `Hook_Strength` metric in the analytics dashboard updates automatically when a script's retention scores change.
- [ ] **UI Tokens Match:** All new UI elements strictly use `#0a0a0f`, `#14141b`, `#f5c518`, `#00d4ff`, and Inter font.
- [ ] **No Silent Failures:** Every AI call shows a loading state, and parse failures trigger the exact 2-retry fallback policy before showing a friendly error toast.