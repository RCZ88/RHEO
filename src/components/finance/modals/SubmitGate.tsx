import React, { useEffect } from 'react'

/**
 * Pushes a modal's validity up to `TransactionModalShell`.
 *
 * WHY THIS COMPONENT EXISTS — do not "simplify" it back into a render prop.
 *
 * `TransactionModalShell` exposes its body as a RENDER PROP:
 *
 *     children({ submit, phase, setCanSubmit })
 *
 * which the shell invokes as a plain function call inside its own render. A hook
 * written inside that callback therefore has no component of its own — it is
 * attributed to whichever fiber happens to be rendering, and React throws
 * "Minified React error #321 / Invalid hook call" as soon as the two disagree
 * (a branch that renders a different number of hooks, an early return, a
 * Suspense retry). This is exactly what happened: all eight transaction modals
 * opened with `useEffect(() => setCanSubmit(valid), ...)` inline in the render
 * prop, so every one of them was a latent 321.
 *
 * Rendering `<SubmitGate />` gives the effect a REAL component boundary, so the
 * hook owns its own hook list and the call is unconditional and stable.
 */
export const SubmitGate: React.FC<{
	valid: boolean
	setCanSubmit: (v: boolean) => void
}> = ({ valid, setCanSubmit }) => {
	useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
	return null
}