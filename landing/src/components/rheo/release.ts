/**
 * RELEASE — one constant, read by every place that names the version.
 *
 * WHY IT IS ITS OWN FILE. The footer said `v0.1` while `Download.tsx` said
 * `v0.2.0`, two hardcoded strings about the same fact, and they disagreed on a
 * page whose entire argument is that its labels are true. A version is not a
 * thing you type in two places; it is a thing you declare once.
 *
 * Change this and the footer, the Proof section and any docs page follow.
 */
export const RELEASE_VERSION = "v0.2.0";

/** The one line that stands where the changelog used to. */
export const RELEASE_LINE = `Not released yet. ${RELEASE_VERSION}, pre-release.`;