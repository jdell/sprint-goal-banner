# Chrome Web Store — listing content

Copy/paste these into the Developer Dashboard when you submit. Nothing here is
uploaded automatically; it's a fill-in sheet. Paste everything as **plain
text** — the store renders no Markdown, so decoration would show up literally.

## Account prerequisites (one-time, before uploading)

- Developer account at the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time US$5 fee).
- **Verified contact email** on the dashboard's Account tab — publishing is blocked without it.
- **2-Step Verification** enabled on the Google account.
- **Trader/non-trader declaration** (EU Digital Services Act): for a free,
  non-commercial extension declare **non-trader**. (Traders must verify their
  identity, and their name/address/phone are displayed publicly on the listing.)

## Basics

- **Name** (taken from `manifest.json`): Sprint Goal Banner for Jira
- **Category:** Workflow & Planning
- **Language:** English
- **Homepage URL / support:** https://github.com/jdell/sprint-goal-banner
  (support via https://github.com/jdell/sprint-goal-banner/issues)

## Summary

The store takes the summary from `manifest.json`'s `description` field — there
is no separate box to paste into. The live summary will be:

> Shows your active Jira sprint goal in a banner above the board, so you never have to dig for it.

## Description (paste as plain text, exactly as below)

> Stop hunting for your sprint goal.
>
> Jira tucks the sprint goal away behind a few clicks, so it's easy to forget what the team actually committed to this sprint. Sprint Goal Banner puts it front and center: a clean banner sits right above your board and shows the active sprint's goal at all times.
>
> FEATURES
> • Shows the active sprint's name and goal in a banner above the board.
> • Supports boards running parallel sprints — every active goal is listed.
> • Sits in the page flow and pushes the board down rather than covering it (a brief floating state can appear while Jira is still loading).
> • Per-board on/off toggle from the toolbar popup.
> • Light, Dark, and System themes to match your Jira.
> • Recognizes Kanban boards and shows a friendly note instead of an error.
> • Self-healing placement: about once a day the extension downloads a small public list of CSS selectors from the developer's GitHub, so placement can be repaired quickly when Jira changes its layout. No data about you is sent, and you can turn this off in the popup.
>
> PRIVATE BY DESIGN
> No accounts, no tracking, no servers. The extension talks only to your own Jira site using your existing session — the same request Jira's own app makes. Sprint data is read on your device solely to render the banner and never leaves your browser. The optional selector download sends no user data.
>
> Works on Jira Cloud (yourcompany.atlassian.net).
>
> This extension is an independent project and is not affiliated with, endorsed by, or sponsored by Atlassian. Jira is a registered trademark of Atlassian Pty Ltd.

## Single purpose (required field)

> This extension has one purpose: to display the active sprint goal of the
> currently viewed Jira board in a banner on the page.

## Permission justifications (required)

**`storage`**
> Used to remember per-device preferences (whether the banner is enabled for a
> given board, the selected banner theme, and whether selector auto-update is
> on) plus a cache of the public selector list described below. No data is
> transmitted anywhere.

**`activeTab`**
> Used only when the user clicks the toolbar icon: it lets the popup read the
> current tab's URL to identify which Jira board is being toggled. No browsing
> history is read and nothing runs until the user clicks.

**Content script on `https://*.atlassian.net/*` (site access shown at install)**
> The banner is injected on Jira Cloud pages; the wildcard is required because
> every customer has their own `<site>.atlassian.net` subdomain and boards are
> reached through Jira's in-page navigation. The script reads the board id from
> the URL and requests the active sprint goal from the user's own Jira site via
> its same-origin Agile REST API using the user's existing session. Apart from
> the optional, user-disableable download of the public `selectors.json` data
> file described under Remote code, the extension accesses no other sites and
> sends no user data to third parties.

**Remote code**
> Answer **No** to the dashboard's remote-code question. The MV3 policy defines
> remotely hosted code as executable JavaScript/WASM and explicitly excludes
> data such as JSON; there is no justification box for a "No" answer, so keep
> this explanation ready for any reviewer follow-up: the extension optionally
> downloads a static JSON *data* file (a list of CSS selectors,
> `selectors.json` in the extension's public GitHub repository) about once a
> day so board-layout changes in Jira can be fixed without waiting for a store
> review. The file is validated client-side, is only ever passed to
> `querySelector`, and is never executed; the download can be disabled in the
> popup and sends no user data.

## Privacy practices tab

- **Data collected:** tick **Website content** only — the extension reads
  sprint names and goals from the user's own Jira site and displays them
  on-device (purpose: application functionality; not sold; not shared; not
  used for creditworthiness or for purposes unrelated to the single purpose).
  Do **not** tick Authentication information (the browser attaches the Jira
  session itself; the extension never reads credentials or cookies) and do
  **not** tick Web history (no browsing record is kept; the popup's on-click
  URL read is covered by the activeTab justification).
- The three certifications (not sold to third parties; not used/transferred
  for unrelated purposes; not used for creditworthiness/lending): **agree**.
- Certify compliance with the Developer Program Policies: **Yes.**
- **Privacy policy URL:** https://github.com/jdell/sprint-goal-banner/blob/main/PRIVACY.md

## Assets

- **Store icon:** `icons/icon128.png` (128×128). No Atlassian logos anywhere.
- **Screenshots (1280×800):** upload in this order — the first is the main image.
  1. `store/01-sprint-goal-banner.png` — the goal banner above a board.
  2. `store/02-dark-theme.png` — dark theme.
  3. `store/03-kanban-note.png` — the Kanban message.
  4. `store/04-settings-popup.png` — the toolbar popup (shows the per-board
     toggle, themes, and the v1.2.0 "Auto-update selectors" switch).
- **Small promo tile (optional, 440×280):** not prepared; not required for
  submission, but improves placement on some store surfaces.

Suggested per-screenshot captions:
1. "Your sprint goal, always in view above the board"
2. "Light, Dark, and System themes"
3. "Kanban-aware — no confusing errors"
4. "Toggle per board, pick a theme, and control selector auto-update"
