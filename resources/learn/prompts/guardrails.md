# Guardrails — Lyceum Learn Generation

## Output format guardrails

1. **No JSON envelope.** The entire output must be raw .lmd text. No `{"content": "---\\n..."}`, no `{ "choices": [...] }`, no JSON wrapper of any kind.

2. **No code fences around the lesson.** The .lmd itself uses code fences inside, but the entire lesson must not be wrapped in triple backticks.

3. **No conversational framing.** Do not prefix with "Here is your lesson:" or suffix with "Let me know if you would like revisions."

4. **Frontmatter required.** Every lesson starts with `---` and contains at minimum: `lyceum`, `title`, `part`, `slug`, `mastery_target`.

5. **No HTML output.** Use Markdown throughout. For tables, use Markdown table syntax, not HTML `<table>`.

## Content guardrails

6. **No hallucinated APIs or libraries.** Every function, package, or API referenced must be real and correctly attributed. When uncertain, say "I believe" and encourage verification.

7. **Code must be reasonable.** Code snippets should follow idiomatic patterns for the language. They do not need to be copy-paste runnable (missing imports are acceptable), but the logic must be correct.

8. **No endorsement of specific vendors.** Compare approaches, not products. "Some teams use X, others use Y" not "You should use X."

9. **Security by default.** Any lesson touching auth, data handling, or user input must include a security caveat or reference the Security curriculum part.

10. **Checklist alignment.** Each lesson should explicitly help the learner make progress on at least 3 checklist items from the curriculum part.

## Generation pipeline checks

11. **Pre-flight.** Before generating, verify the slug exists in `CURRICULUM` and has a matching entry in `topicPrompts`. If not, fall back to a generic system prompt.

12. **Post-flight.** After generation, verify the output:
    - Starts with `---`
    - Contains at least one `##` heading
    - Does not contain `{"` or `"content":` (signs of JSON wrapping)
    - Ends with a newline

13. **Fallback behavior.** If the model returns wrapped JSON (detected by `looksLikeJson`), unwrap it, extract the `.content` field, and re-verify against rule 12. If it still fails after unwrapping, return an error to the caller.

## Edge cases

14. **Very long input.** If the user prompt exceeds 6000 characters, summarize it before injecting into the system prompt. Preserve the .lmd output instruction.

15. **Empty topic.** If no topic is provided, generate a general .lmd about "how to learn effectively" as a meta-lesson.

16. **Language model uncertainty.** When the model says "I am not sure" or similar, the coach persona should respond: "Good — uncertainty is the beginning of precision. Here is how to find out."
