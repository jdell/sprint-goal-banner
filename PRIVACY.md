# Privacy Policy — Sprint Goal Banner for Jira

_Last updated: September 5, 2026_

Sprint Goal Banner for Jira ("the extension") is designed to keep your data on
your own machine. It exists only to display your active Jira sprint goal.

## What the extension does

- Runs only on Jira Cloud pages (`https://*.atlassian.net/*`).
- Reads the board id from the page URL and calls Jira's own Agile REST API
  (`/rest/agile/1.0/board/{id}/sprint?state=active`) on the same domain you are
  already signed in to, using your existing browser session. This is the same
  request Jira's own web app makes.
- Displays the returned sprint name and goal in a banner on the board page.
- Optionally (on by default, can be turned off in the popup) fetches a small
  static JSON file of CSS selectors from the extension's public GitHub
  repository about once a day, so banner placement can be repaired quickly when
  Jira changes its page layout.

## Data collection

**The extension does not collect, transmit, sell, or share any personal data.**

- No analytics, tracking, telemetry, or advertising.
- No data is sent to the developer or to any third-party server.
- The extension makes only two kinds of network request:
  1. To your own Jira site, initiated by your browser with your own
     credentials. The sprint data returned is used only to render the banner
     and is not stored or forwarded anywhere.
  2. If selector auto-update is enabled (the default), a plain download of the
     public `selectors.json` file from the extension's GitHub repository
     (`raw.githubusercontent.com`), about once a day. This request carries no
     account data, no Jira data, and no identifiers — like any web download,
     the server sees only your IP address. Turn it off in the popup
     ("Auto-update selectors") and the extension uses its built-in list only.

## Local storage

The extension uses Chrome's `storage.local` to remember, on your device only:

- Whether the banner is shown for a given board (per-board on/off toggle).
- Your chosen banner theme (System / Light / Dark).
- Whether selector auto-update is enabled, and the last downloaded selector
  list (a cache of the public `selectors.json` described above).

These never leave your browser and are removed if you uninstall the extension.

## Permissions

- **`storage`** — to save the preferences and the selector-list cache described
  above.
- **`activeTab`** — used only when you click the toolbar icon, to read the
  current tab's URL and identify which board you are toggling.
- The content script runs on `https://*.atlassian.net/*` to display the banner
  and request the sprint goal from your own Jira site. No other sites are
  accessed, apart from the optional selector-list download described above.

## Contact

Questions about this policy can be directed to the developer through the Chrome
Web Store listing's support channel.
