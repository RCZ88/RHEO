Design and implement a settings page UI that includes a “persistent bottom save bar” pattern (similar to Discord).

The interface should detect when the user makes changes to any input field (text, toggle, dropdown, etc.) and enter a “dirty state” when the current values differ from the original saved state.

When the page is in a dirty state, display a sticky panel fixed to the bottom of the viewport. This panel must remain visible regardless of scrolling and should not block interaction with the rest of the UI.

The panel should include:

* A primary action button labeled “Save Changes”
* A secondary action such as “Reset” or “Discard”
* Optional short text indicating that there are unsaved changes

Behavior requirements:

* The panel is hidden by default
* It appears immediately when any change is detected
* It disappears only when the user saves or resets all changes
* Saving updates the stored state and clears the dirty state
* Reset restores all values to their original state and clears the dirty state

Design requirements:

* The panel should feel integrated with the page, not like a popup or modal
* Use subtle elevation (shadow) and a slight slide-up animation when appearing
* Maintain consistent spacing, padding, and theme with the rest of the UI
* Do not use intrusive animations or notifications

Technical logic:

* Track an initial state snapshot of all inputs
* Continuously compare it with the current state to determine if changes exist
* Use this comparison to control the visibility of the bottom panel

The goal is to create a non-intrusive but persistent UI element that clearly communicates unsaved changes and provides accessible actions without disrupting the user’s workflow.
