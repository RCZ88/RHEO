/**
 * Terminal-workspace alias for the app's single find-in-page implementation.
 *
 * This file used to hold a SECOND, independent copy of the find overlay that
 * dimmed and blurred the whole viewport and only listed matching text nodes —
 * it was never mounted, so it silently rotted into a second broken version of
 * the same feature. There is now exactly one implementation, and the terminal
 * re-exports it.
 */
export { NativeFindOverlay, default } from '../../components/NativeFindOverlay';
