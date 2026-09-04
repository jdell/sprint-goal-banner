# Sprint Goal Banner for Jira

Shows a banner above your Jira board with the **active sprint's goal**, so you don't have to click into the sprint to read it.

Works on Jira Cloud (`*.atlassian.net`). It reads the board id from the URL and calls Jira's own Agile REST API using your logged-in session — no tokens, no config, nothing leaves your browser.

## Install (developer mode)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `sprint-goal-banner` folder.
4. Open any Jira board (`.../boards/123`). The banner appears under the header.

To update after edits, click the refresh icon on the extension card.

## How it works

- Detects the board id from the URL (`/boards/123` or `?rapidView=123`).
- Fetches `GET /rest/agile/1.0/board/{id}/sprint?state=active` (same-origin, with credentials).
- Renders each active sprint's name + goal in the banner. If a board runs parallel sprints, all active goals are shown.
- **Inserts the banner in the normal page flow, just above the board content**, so it never overlaps the board — the board simply starts below it.
- Follows Jira's single-page navigation and re-checks every couple of seconds so the banner stays put.
- Detects Kanban boards (which have no sprints) and shows a short note instead of an error.

## Turning it on/off per board

Click the extension's toolbar icon while on a board to open the popup, then flip **Show on this board**. The choice is remembered per board id.

The **✕** on the banner also hides it for the current board — turn it back on from the toolbar popup.

## Theme

The popup has a **Banner theme** switch: **System** (follows your OS/browser light-or-dark setting — the default), **Light** (always light), or **Dark** (always dark). It applies to the banner on every board.

## Notes & tweaks

- **No goal shows** but the sprint has one: the sprint's Goal field may be empty in Jira, or you may be on a Kanban board (no sprints).
- **Jira Server / Data Center:** change the `matches` and `host_permissions` in `manifest.json` to your Jira domain — the same Agile API path applies.

## Publishing to the Chrome Web Store

1. **Package it.** Run `bash package.sh` (or `zip -r sprint-goal-banner.zip . -x '*.DS_Store' 'store/*' 'package.sh' 'STORE_LISTING.md'`). This produces `sprint-goal-banner-<version>.zip` containing only the files the extension needs to run. The `store/` folder (screenshots) and the docs are intentionally excluded from the package.
2. **Create a developer account** at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time US$5 fee).
3. **Add a new item** and upload the zip.
4. **Fill the listing** using `STORE_LISTING.md` — name, summary, description, single-purpose statement, and the permission justifications are all written out there.
5. **Privacy tab:** host `PRIVACY.md` at a public URL (a GitHub repo or Gist works) and paste that URL into the Privacy policy field. Answer the data-usage questions as listed in `STORE_LISTING.md` (all "No").
6. **Upload assets:** store icon is `icons/icon128.png`; add the four screenshots in `store/` (01 = main image, then dark theme, Kanban note, settings popup).
7. **Submit for review.** First reviews typically take a few business days.

### Files in the package
- `manifest.json`, `content.js`, `banner.css`, `popup.html`, `popup.js`, `icons/`
### Not shipped (repo/store only)
- `store/` (screenshots), `STORE_LISTING.md`, `PRIVACY.md`, `README.md`, `LICENSE`, `package.sh`, `PUBLISHING.md`, `RELEASE_NOTES.md`, `.gitignore`

See **[`PUBLISHING.md`](./PUBLISHING.md)** for the full GitHub + Web Store release walkthrough, and **[`RELEASE_NOTES.md`](./RELEASE_NOTES.md)** for the release changelog.

## Version history
- **1.0.0** — Initial release: sprint-goal banner above the board, per-board toggle, Light/Dark/System themes, Kanban handling.
