# Chrome Web Store — listing content

Copy/paste these into the Developer Dashboard when you submit. Nothing here is
uploaded automatically; it's a fill-in sheet.

## Basics

- **Name:** Sprint Goal Banner for Jira
- **Category:** Workflow & Planning (or Productivity)
- **Language:** English

## Summary (132 characters max)

> See your active Jira sprint goal in a banner above the board — no more clicking into the sprint to remember what you're aiming for.

## Description

> **Stop hunting for your sprint goal.**
>
> Jira tucks the sprint goal away behind a few clicks, so it's easy to forget what the team actually committed to this sprint. Sprint Goal Banner puts it front and center: a clean banner sits right above your board and shows the active sprint's goal at all times.
>
> **Features**
> - Shows the active sprint's name and goal in a banner above the board.
> - Supports boards running parallel sprints — every active goal is listed.
> - Pushes the board down instead of covering it, so nothing is hidden.
> - Per-board on/off toggle from the toolbar popup.
> - Light, Dark, and System themes to match your Jira.
> - Recognizes Kanban boards and shows a friendly note instead of an error.
>
> **Private by design**
> No accounts, no tracking, no servers. The extension talks only to your own Jira site using your existing session — the same request Jira's own app makes. Your data never leaves your browser. (Optionally, and on by default, it downloads a small public list of CSS selectors from the developer's GitHub once a day so placement can be repaired quickly when Jira changes its layout — no data about you is sent, and you can turn it off in the popup.)
>
> Works on Jira Cloud (yourcompany.atlassian.net).

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
> No. All code is bundled in the package; nothing is fetched or executed from a
> remote source. The extension optionally downloads a static JSON *data* file
> (a list of CSS selectors, `selectors.json` in the extension's public GitHub
> repository) about once a day so board-layout changes in Jira can be fixed
> without waiting for a store review. The file is validated client-side, is
> only ever passed to `querySelector`, and is never executed; the download can
> be disabled in the popup and sends no user data.

## Data usage disclosures (Privacy practices tab)

- Does this item collect or use personal or sensitive user data? **No.**
- Sold to third parties? **No.**
- Used or transferred for purposes unrelated to the item's single purpose? **No.**
- Used or transferred to determine creditworthiness / lending? **No.**
- Certify compliance with the Developer Program Policies: **Yes.**
- Privacy policy URL: host `PRIVACY.md` somewhere public (e.g. a GitHub repo or
  Gist) and paste the URL here. A privacy policy URL is required because the
  extension runs content scripts on users' Jira sites.

## Assets

- **Store icon:** `icons/icon128.png` (128×128).
- **Screenshots (1280×800):** upload in this order — the first is the main image.
  1. `store/01-sprint-goal-banner.png` — the goal banner above a board.
  2. `store/02-dark-theme.png` — dark theme.
  3. `store/03-kanban-note.png` — the Kanban message.
  4. `store/04-settings-popup.png` — the toolbar popup (toggle + theme).
- **Small promo tile (optional):** 440×280.

Suggested per-screenshot captions:
1. "Your sprint goal, always in view above the board"
2. "Light, Dark, and System themes"
3. "Kanban-aware — no confusing errors"
4. "Toggle per board and switch themes from the popup"

## Suggested support/homepage URL

Point to a public repo (GitHub) containing this source, or an email support link.
