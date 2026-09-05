# Sprint Goal Banner for Jira

Shows a banner above your Jira board with the **active sprint's goal**, so you don't have to click into the sprint to read it.

Works on Jira Cloud (`*.atlassian.net`). It reads the board id from the URL and calls Jira's own Agile REST API using your logged-in session — no tokens, no config, and apart from an optional daily download of [`selectors.json`](./selectors.json) from this repo (placement fixes; no data about you is sent, opt out in the popup), nothing leaves your browser.

## Install (developer mode)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `sprint-goal-banner` folder.
4. Open any Jira board (`.../boards/123`). The banner appears under the header.

To update after edits, click the refresh icon on the extension card.

## How it works

- Detects the board id from the URL (board and backlog views: `/boards/123`, `/boards/123/backlog`, or legacy `?rapidView=123`).
- Asks `GET /rest/agile/1.0/board/{id}` for the board type (Kanban boards get a short note instead of an error), then fetches `GET /rest/agile/1.0/board/{id}/sprint?state=active` (same-origin, with credentials, following pagination). Sprints that originate on other boards are filtered out unless the board shows only those.
- Renders each active sprint's name + goal in the banner. If a board runs parallel sprints, all active goals are shown.
- **Inserts the banner in the normal page flow, just above the board content**, so it never overlaps the board — the board simply starts below it. The banner lives in a shadow root, so Jira's CSS can't restyle it and vice versa.
- Finds its place with a tiered anchor search: Jira's board container test hooks first, fuzzy attribute matches next, and the `main[role="main"]` landmark as a fallback — so a Jira UI rework degrades placement gracefully instead of breaking the banner.
- The selector tiers are remotely updatable: about once a day the extension downloads [`selectors.json`](./selectors.json) from this repo (validated, capped, CSS selectors only — never code), so a broken selector can be fixed by editing that file instead of waiting days for a store review. Placement never waits on the network — built-in defaults apply immediately — and the download can be turned off in the popup (**Auto-update selectors**).
- Follows Jira's single-page navigation via the Navigation API and re-places the banner through a MutationObserver when Jira re-renders — no constant polling.
- Refreshes the goal about once a minute while the tab is visible, and backs off with retries when Jira can't be reached.

## Turning it on/off per board

Click the extension's toolbar icon while on a board to open the popup, then flip **Show on this board**. The choice is remembered per board id.

The **✕** on the banner also hides it for the current board — turn it back on from the toolbar popup.

## Theme

The popup has a **Banner theme** switch: **System** (follows Jira's own light/dark mode when one is set, otherwise your OS/browser setting — the default), **Light** (always light), or **Dark** (always dark). It applies to the banner on every board.

## Notes & tweaks

- **No goal shows** but the sprint has one: the sprint's Goal field may be empty in Jira, or you may be on a Kanban board (no sprints).
- **Jira Server / Data Center:** change the `matches` in `manifest.json` to your Jira domain — the same Agile API path applies.

## Publishing to the Chrome Web Store

1. **Package it.** Run `bash package.sh` (or the same allowlist by hand: `zip -r sprint-goal-banner.zip manifest.json content.js popup.html popup.js icons`). This produces `sprint-goal-banner-<version>.zip` containing only the files the extension needs to run — never zip the whole folder, or `.git/`, editor state, and docs end up in the store upload.
2. **Create a developer account** at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time US$5 fee).
3. **Add a new item** and upload the zip.
4. **Fill the listing** using `STORE_LISTING.md` — name, summary, description, single-purpose statement, and the permission justifications are all written out there.
5. **Privacy tab:** host `PRIVACY.md` at a public URL (a GitHub repo or Gist works) and paste that URL into the Privacy policy field. Answer the data-usage questions as listed in `STORE_LISTING.md` (all "No").
6. **Upload assets:** store icon is `icons/icon128.png`; add the four screenshots in `store/` (01 = main image, then dark theme, Kanban note, settings popup).
7. **Submit for review.** First reviews typically take a few business days.

### Files in the package
- `manifest.json`, `content.js`, `popup.html`, `popup.js`, `icons/`
### Not shipped (repo/store only)
- `store/` (screenshots), `STORE_LISTING.md`, `PRIVACY.md`, `README.md`, `LICENSE`, `package.sh`, `PUBLISHING.md`, `RELEASE_NOTES.md`, `.gitignore`
- `selectors.json` — the served selector config; fetched at runtime from this repo, must **not** be bundled into the zip

See **[`PUBLISHING.md`](./PUBLISHING.md)** for the full GitHub + Web Store release walkthrough, and **[`RELEASE_NOTES.md`](./RELEASE_NOTES.md)** for the release changelog.

## Version history
- **1.2.0** — Remotely-updatable selector list: placement selectors can be repaired by editing `selectors.json` in this repo (daily fetch, validated client-side, opt-out toggle in the popup).
- **1.1.0** — Hardening release: tiered anchor search with semantic-landmark fallback, shadow-DOM styling, Navigation API + MutationObserver instead of polling, stale-fetch guards, board-type detection, pagination, retry with backoff, visible-tab refresh, least-privilege permissions (`activeTab` instead of host permissions).
- **1.0.0** — Initial release: sprint-goal banner above the board, per-board toggle, Light/Dark/System themes, Kanban handling.
