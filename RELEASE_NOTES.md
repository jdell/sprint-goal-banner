# Release notes

## v1.2.0 — Remotely-updatable selectors

Jira renames its internal page hooks on UI reworks, and a Chrome Web Store
review takes days. Now the banner's placement selectors can be repaired in
minutes instead.

### Highlights
- 🔧 **Remotely-updatable selector list** — the extension downloads
  [`selectors.json`](./selectors.json) from this repository about once a day
  and uses it to find the board. When Jira changes its layout, fixing placement
  is a one-file commit — no store review, no extension update.
- 🧰 **Safe by construction** — the file contains CSS selectors only; they are
  type-checked, syntax-validated, and capped client-side, and only ever passed
  to `querySelector`. The built-in landmark fallback can never be overridden,
  and placement never waits on the network.
- 🎛️ **Opt-out toggle** — a new **Auto-update selectors** switch in the popup
  (on by default) disables the daily download entirely; the extension then
  uses only its built-in selectors. The download sends no user data.

## v1.1.0 — Hardening release

Placement and lifecycle rework so the banner survives Jira UI reworks instead
of breaking with them.

### Highlights
- 🧭 **Tiered placement** — exact board hooks first, fuzzy matches next, and the
  `main[role="main"]` landmark as a fallback, so a Jira redesign degrades
  placement gracefully instead of removing the banner.
- 🛡️ **Shadow DOM** — the banner's styles are isolated from Jira's CSS in both
  directions; the System theme now follows Jira's own dark/light mode first.
- ⚡ **Event-driven** — SPA navigation via the Navigation API and re-placement
  via a MutationObserver; the old 1.5-second polling loop is gone.
- 🔄 **Fresh data** — the goal refreshes about once a minute while the tab is
  visible; failed requests retry with backoff instead of sticking on an error.
- 🎯 **Better Jira semantics** — board type detected via the REST API (proper
  Kanban handling), sprint pagination followed, other boards' sprints filtered
  out, and stale responses can no longer paint the wrong board's goal.
- 🔐 **Least privilege** — host permissions dropped in favor of `activeTab`;
  the content script now ignores Confluence and JSM pages entirely.

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

_For Jira Server / Data Center, edit `matches` in `manifest.json` to your Jira
domain — the same Agile REST API path applies._
