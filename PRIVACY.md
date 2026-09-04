# Privacy Policy — Sprint Goal Banner for Jira

_Last updated: September 4, 2026_

Sprint Goal Banner for Jira ("the extension") is designed to keep your data on
your own machine. It exists only to display your active Jira sprint goal.

## What the extension does

- Runs only on Jira Cloud pages (`https://*.atlassian.net/*`).
- Reads the board id from the page URL and calls Jira's own Agile REST API
  (`/rest/agile/1.0/board/{id}/sprint?state=active`) on the same domain you are
  already signed in to, using your existing browser session. This is the same
  request Jira's own web app makes.
- Displays the returned sprint name and goal in a banner on the board page.

## Data collection

**The extension does not collect, transmit, sell, or share any personal data.**

- No analytics, tracking, telemetry, or advertising.
- No data is sent to the developer or to any third-party server.
- The only network request is to your own Jira site, initiated by your browser
  with your own credentials. The sprint data returned is used only to render the
  banner and is not stored or forwarded anywhere.

## Local storage

The extension uses Chrome's `storage.local` to remember two preferences on your
device only:

- Whether the banner is shown for a given board (per-board on/off toggle).
- Your chosen banner theme (System / Light / Dark).

These preferences never leave your browser and are removed if you uninstall the
extension.

## Permissions

- **`storage`** — to save the preferences described above.
- **Host access to `https://*.atlassian.net/*`** — to read the board id and
  request the sprint goal from your Jira site. No other sites are accessed.

## Contact

Questions about this policy can be directed to the developer through the Chrome
Web Store listing's support channel.
