# Release notes

## v1.0.0 — First release

**Sprint Goal Banner for Jira** shows your active sprint goal in a banner above
the board, so you never have to click into the sprint to remember what the team
committed to.

### Highlights
- 🎯 **Sprint goal banner** above the board, showing the active sprint's name and goal.
- 🔀 **Parallel sprints** supported — every active sprint's goal is listed.
- 📐 **Never covers the board** — the banner sits in the page flow, so the board just starts below it.
- 🎚️ **Per-board toggle** from the toolbar popup; the ✕ hides it for the current board.
- 🌗 **Light / Dark / System themes** to match your Jira.
- 📋 **Kanban-aware** — shows a short note instead of an error on boards without sprints.

### Privacy
No accounts, no tracking, no servers. The extension talks only to your own Jira
site using your existing session — the same request Jira's own app makes. Your
data never leaves your browser. See [`PRIVACY.md`](./PRIVACY.md).

### Install
- **Chrome Web Store:** _link once approved._
- **Manual:** download `sprint-goal-banner-1.0.0.zip` from this release, unzip,
  then load the folder via `chrome://extensions` → Developer mode → **Load unpacked**.

### Compatibility
- Jira Cloud (`*.atlassian.net`)
- Chrome 102+ (and Chromium-based browsers: Edge, Brave, etc.)

---

_For Jira Server / Data Center, edit `matches` and `host_permissions` in
`manifest.json` to your Jira domain — the same Agile REST API path applies._
