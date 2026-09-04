/*
 * Sprint Goal Banner for Jira
 * Injects a banner above the Jira board showing the active sprint's goal, and
 * pushes the page content down so nothing is hidden behind it.
 * Works on Jira Cloud (*.atlassian.net) by reading the board id from the URL
 * and calling the same-origin Agile REST API with the user's own session.
 *
 * Resilience model: Jira's data-testid hooks are internal and churn on UI
 * reworks (Oct 2024 board rework, Mar 2025 new navigation), so placement uses
 * a tiered anchor search — exact test ids, then fuzzy attribute matches, then
 * semantic landmarks (main[role="main"]) that are an accessibility contract
 * Atlassian can't casually break. A scoped MutationObserver re-places the
 * banner when React drops it; the Navigation API tracks SPA route changes.
 */
(function () {
  "use strict";

  // Guard against the content script being injected more than once.
  if (window.__sgbBannerLoaded) return;
  window.__sgbBannerLoaded = true;

  // Confluence and JSM customer portals share the *.atlassian.net origin but
  // are separate SPAs — reaching Jira from them is a full page load, so this
  // page can never become a board and it's safe to do nothing at all here.
  if (/^\/(wiki|servicedesk)\//.test(location.pathname)) return;

  const HOST_TAG = "sgb-sprint-goal-banner";
  // The TTL sits just under the refresh period: a tick that lands ~60s after
  // the last fetch must see the cache as expired, or refreshes only take
  // effect every other tick.
  const CACHE_TTL_MS = 55 * 1000;
  const REFRESH_MS = 60 * 1000;
  const THEME_KEY = "sgb:theme"; // "system" | "light" | "dark"

  /* ---------- state ---------- */

  let updateSeq = 0; // generation token: awaits resumed after a newer update() must not render
  let lastUrl = location.href;
  let currentBoardId = null;
  let currentTheme = "system";
  let lastRenderKey = "";
  let currentAnchor = null; // board element the banner sits directly above (tier 1/2)
  let placedAtUrl = ""; // URL at the time of the last placement
  let failCount = 0;
  let retryTimer = 0;
  let refreshTimer = 0;
  let navPollTimer = 0;
  let placeObserver = null;
  let ensureTrailing = 0;
  let lastEnsure = 0;
  let evictions = []; // timestamps of the banner being dropped by Jira re-renders
  let forcedLandmarkUntil = 0; // while set, skip tier 1/2 (React keeps evicting us there)
  const sprintCache = new Map(); // boardId -> { ts, sprints }
  const boardTypeCache = new Map(); // boardId -> "scrum" | "kanban" | "simple" | "unknown"

  /* ---------- extension lifecycle ---------- */

  // After an extension update/reload Chrome orphans this script: chrome.* APIs
  // start throwing while DOM access keeps working. Detect that and shut down
  // instead of showing a banner the user can no longer control.
  function alive() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function teardown() {
    stopWatchers();
    if (navPollTimer) clearInterval(navPollTimer);
    navPollTimer = 0;
    themeObserver.disconnect();
    if (themeMedia) {
      try {
        themeMedia.removeEventListener("change", applyTheme);
      } catch (e) {
        /* ignore */
      }
    }
    try {
      if ("navigation" in window) window.navigation.removeEventListener("navigate", onNavigate);
    } catch (e) {
      /* ignore */
    }
    window.removeEventListener("popstate", onUrlMaybeChanged);
    document.removeEventListener("visibilitychange", onVisibility);
    removeBanner();
    hostEl = null; // release the detached shadow tree
    contentEl = null;
    updateSeq++; // cancel any in-flight update
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(key, (res) => {
          resolve(chrome.runtime.lastError ? null : res);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  /* ---------- board id detection ---------- */

  // Board views the banner belongs on: the board itself and the backlog (both
  // sprint-centric). Reports/settings/timeline sub-views are excluded — there
  // is no board container there and the goal is off-topic.
  function parseBoardLocation(href) {
    let url;
    try {
      url = new URL(href);
    } catch (e) {
      return null;
    }
    if (url.origin !== location.origin) return null;
    const path = url.pathname;
    // Team-managed:    /jira/software/projects/KEY/boards/12
    // Company-managed: /jira/software/c/projects/KEY/boards/12/backlog
    let m = path.match(
      /\/jira\/software\/(?:c\/)?projects\/[^/]+\/boards\/(\d+)(?:\/(backlog))?\/?$/,
    );
    if (m) return { boardId: m[1], view: m[2] || "board" };
    // Legacy: /secure/RapidBoard.jspa?rapidView=12
    if (/\/secure\/RapidBoard\.jspa$/i.test(path)) {
      const rv = url.searchParams.get("rapidView");
      if (rv && /^\d+$/.test(rv)) return { boardId: rv, view: "board" };
    }
    // Other tenant variants that still end at a numeric board root.
    m = path.match(/\/boards\/(\d+)\/?$/);
    if (m) return { boardId: m[1], view: "board" };
    return null;
  }

  /* ---------- per-board enabled setting ---------- */

  function storageKey(boardId) {
    return "sgb:enabled:" + boardId;
  }

  async function isEnabled(boardId) {
    const res = await storageGet(storageKey(boardId));
    // null means the extension context is gone (or storage failed): fail
    // closed, so an orphaned script never re-renders UI the user dismissed.
    if (res === null) return false;
    return res[storageKey(boardId)] !== false; // default ON
  }

  /* ---------- data fetching ---------- */

  async function fetchJson(path) {
    const res = await fetch(location.origin + path, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const err = new Error("HTTP " + res.status);
      err.status = res.status;
      err.retryAfter = Number(res.headers.get("Retry-After")) || 0;
      throw err;
    }
    return res.json();
  }

  async function fetchBoardType(boardId) {
    if (boardTypeCache.has(boardId)) return boardTypeCache.get(boardId);
    try {
      const data = await fetchJson(`/rest/agile/1.0/board/${boardId}`);
      const type = data && typeof data.type === "string" ? data.type : "unknown";
      boardTypeCache.set(boardId, type);
      return type;
    } catch (e) {
      // Can't tell — try the sprint endpoint anyway; its 400 still means "no
      // sprint support" and is handled below.
      return "unknown";
    }
  }

  async function fetchActiveSprints(boardId) {
    const cached = sprintCache.get(boardId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.sprints;
    sprintCache.delete(boardId);

    // The agile API caps maxResults at 50 and signals the end via isLast; more
    // than one page of *active* sprints is unheard of, but loop anyway.
    const collected = [];
    let startAt = 0;
    for (let page = 0; page < 5; page++) {
      let data;
      try {
        data = await fetchJson(
          `/rest/agile/1.0/board/${boardId}/sprint?state=active&maxResults=50&startAt=${startAt}`,
        );
      } catch (err) {
        if (err.status === 400) err.kanban = true; // board without sprint support
        throw err;
      }
      const values = Array.isArray(data.values) ? data.values : [];
      collected.push(...values);
      if (data.isLast !== false || !values.length) break;
      startAt += values.length;
    }

    // A board whose filter matches other teams' issues also lists those teams'
    // active sprints. Prefer sprints that originate on this board; if none do,
    // the board is a cross-team view and every goal is relevant.
    const own = collected.filter((s) => String(s.originBoardId) === String(boardId));
    const sprints = own.length ? own : collected;
    sprintCache.set(boardId, { ts: Date.now(), sprints });
    if (sprintCache.size > 10) sprintCache.delete(sprintCache.keys().next().value);
    return sprints;
  }

  /* ---------- anchor discovery ---------- */

  // Tier 1: exact hooks for precise placement in the toolbar/board gap.
  const EXACT_ANCHORS = [
    '[data-testid="software-board.board-container"]',
    '[data-testid="platform-board-kit.ui.board.scroll.board-scroll"]',
    '[data-testid="software-board.board"]',
    '[data-test-id="platform-board-kit.ui.board.scroll.board-scroll"]',
  ];
  // Tier 2: fuzzy matches in the same family — survive suffix/namespace churn.
  // Both attribute spellings exist in Jira's DOM history. The data-vc values
  // are telemetry markers, the least contractual hooks of all — last in line.
  const FUZZY_ANCHORS = [
    '[data-testid^="software-board.board"]',
    '[data-testid*="board-scroll" i]',
    '[data-test-id*="board-scroll" i]',
    '[data-testid*="board-container" i]',
    '[data-vc="page-container-v2-main-wrapper"]',
    '[data-vc="business-board-container"]',
  ];
  // Tier 3: semantic landmarks. main[role="main"] is guaranteed by Atlassian's
  // navigation system; #jira-frontend is the SPA mount root present from the
  // initial HTML. The banner is prepended inside these rather than made a
  // sibling, landing at the top of the main content area.
  const LANDMARK_ANCHORS = ["main[role='main']", "main", "#ak-main-content", "#jira-frontend"];

  function usableAnchor(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest('[role="dialog"]')) return false; // e.g. a board preview in a modal
    return el.getBoundingClientRect().width > 200;
  }

  function queryFirst(selectors) {
    for (const sel of selectors) {
      let el = null;
      try {
        el = document.querySelector(sel);
      } catch (e) {
        continue; // e.g. an `i` attribute flag on an engine that lacks it
      }
      if (usableAnchor(el)) return el;
    }
    return null;
  }

  /* ---------- banner host (shadow DOM) ---------- */

  const SHADOW_CSS = `
    :host {
      /* Reset everything inherited from Jira's cascade, then re-establish. */
      all: initial;
      display: block;
      position: relative;
      z-index: 5;
      margin: 0 0 4px;

      /* --- light tokens (default) --- */
      --sgb-bg-a: #deebff;
      --sgb-bg-b: #e9f2ff;
      --sgb-border: #b3d4ff;
      --sgb-fg: #172b4d;
      --sgb-label: #0052cc;
      --sgb-name: #42526e;
      --sgb-muted: #6b778c;
      --sgb-sep: #a5adba;
      --sgb-close: #6b778c;
      --sgb-close-fg-hover: #172b4d;
      --sgb-close-bg-hover: rgba(9, 30, 66, 0.08);
    }

    /* --- dark tokens (resolved in JS from the theme setting, Jira's own
           color mode, and the OS preference, in that order) --- */
    :host([data-effective-theme="dark"]) {
      --sgb-bg-a: #1c2b41;
      --sgb-bg-b: #172338;
      --sgb-border: #2c3e5d;
      --sgb-fg: #c7d1db;
      --sgb-label: #4c9aff;
      --sgb-name: #9fadbc;
      --sgb-muted: #8c9bab;
      --sgb-sep: #56637a;
      --sgb-close: #8c9bab;
      --sgb-close-fg-hover: #e6edf5;
      --sgb-close-bg-hover: rgba(255, 255, 255, 0.10);
    }

    /* Fallback only: shown while nothing has rendered to anchor on. Kept
       below Atlaskit's blanket/modal layers so it can't cover Jira's own
       overlays; the top offset is measured from the real header at runtime. */
    :host([data-mode="float"]) {
      position: fixed;
      left: 0;
      right: 0;
      margin: 0;
      z-index: 300;
    }
    :host([data-mode="float"]) .sgb-banner {
      margin: 0;
      border-radius: 0;
      border-left: none;
      border-right: none;
      box-shadow: 0 1px 3px rgba(9, 30, 66, 0.13);
    }

    .sgb-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      box-sizing: border-box;
      padding: 8px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      color: var(--sgb-fg);
      background: linear-gradient(90deg, var(--sgb-bg-a) 0%, var(--sgb-bg-b) 100%);
      border: 1px solid var(--sgb-border);
      border-radius: 4px;
    }

    .sgb-label {
      flex: 0 0 auto;
      font-weight: 700;
      color: var(--sgb-label);
      white-space: nowrap;
    }

    .sgb-text {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sgb-name {
      font-weight: 600;
      color: var(--sgb-name);
      margin-right: 6px;
    }

    .sgb-sep {
      margin: 0 10px;
      color: var(--sgb-sep);
    }

    .sgb-muted {
      color: var(--sgb-muted);
      font-style: italic;
    }

    .sgb-close {
      flex: 0 0 auto;
      border: none;
      background: transparent;
      color: var(--sgb-close);
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 3px;
      line-height: 1;
    }

    .sgb-close:hover {
      background: var(--sgb-close-bg-hover);
      color: var(--sgb-close-fg-hover);
    }
  `;

  let hostEl = null;
  let contentEl = null;

  function ensureHost() {
    if (!hostEl) {
      // A custom tag name: Jira's stylesheets have no rules for it, and the
      // shadow root keeps our styles from leaking out and Jira's from
      // leaking in.
      hostEl = document.createElement(HOST_TAG);
      const root = hostEl.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = SHADOW_CSS;
      contentEl = document.createElement("div");
      contentEl.className = "sgb-banner";
      root.append(style, contentEl);
    }
    return hostEl;
  }

  function removeBanner() {
    if (hostEl) hostEl.remove();
    lastRenderKey = "";
    currentAnchor = null;
  }

  /* ---------- theming ---------- */

  function resolveTheme() {
    if (currentTheme === "light" || currentTheme === "dark") return currentTheme;
    // "system": follow Jira's own color mode when it exposes one, else the OS.
    const jiraMode = document.documentElement.getAttribute("data-color-mode");
    if (jiraMode === "dark" || jiraMode === "light") return jiraMode;
    let prefersDark = false;
    try {
      prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) {
      /* default light */
    }
    return prefersDark ? "dark" : "light";
  }

  function applyTheme() {
    if (hostEl) hostEl.dataset.effectiveTheme = resolveTheme();
  }

  function loadTheme() {
    storageGet(THEME_KEY).then((res) => {
      if (res) currentTheme = res[THEME_KEY] || "system";
      applyTheme();
    });
  }

  /* ---------- placement ---------- */

  // Insert the banner immediately before the board content, within the same
  // parent, so it lands in the toolbar/board gap and pushes the board down in
  // normal flow. Sibling insertion never touches React-owned nodes, so it
  // can't break Jira's reconciliation — but React may silently evict the
  // banner when it replaces the parent subtree; the MutationObserver below
  // re-places it, and repeated evictions demote us to the landmark tier.
  function placeBanner(host) {
    placedAtUrl = location.href;
    const now = Date.now();
    if (now >= forcedLandmarkUntil) {
      const board = queryFirst(EXACT_ANCHORS) || queryFirst(FUZZY_ANCHORS);
      if (board && board.parentNode) {
        if (host.parentNode !== board.parentNode || host.nextElementSibling !== board) {
          board.parentNode.insertBefore(host, board);
        }
        host.dataset.mode = "inline";
        host.style.top = "";
        currentAnchor = board;
        // Trust nothing about the unknown parent's layout: if it lays children
        // out horizontally (banner beside the board instead of above it),
        // retreat to the landmark tier for a while.
        const hostRect = host.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        if (hostRect.width < 100 || hostRect.bottom > boardRect.top + 2) {
          forcedLandmarkUntil = now + 5 * 60 * 1000;
        } else {
          return;
        }
      }
    }

    currentAnchor = null;
    const landmark = queryFirst(LANDMARK_ANCHORS);
    if (landmark) {
      if (host.parentNode !== landmark || landmark.firstElementChild !== host) {
        landmark.prepend(host);
      }
      host.dataset.mode = "inline";
      host.style.top = "";
      return;
    }

    // Nothing has rendered yet: float under the (measured) header until the
    // app mounts. #jira-frontend exists in the initial HTML, so this state is
    // short-lived.
    host.dataset.mode = "float";
    let top = 56;
    const header = document.querySelector('header[role="banner"], [role="banner"]');
    if (header) top = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
    host.style.top = top + "px";
    const parent = document.body || document.documentElement;
    if (host.parentNode !== parent) parent.appendChild(host);
  }

  // Re-validate placement after DOM churn. Cheap checks first; the full
  // placeBanner pass (with its layout reads) only runs when something is
  // actually wrong or a better anchor tier may have appeared.
  function ensurePlaced() {
    if (!hostEl || !currentBoardId) return;
    if (!parseBoardLocation(location.href)) return;

    if (!hostEl.isConnected) {
      // Count an eviction only when it isn't explained by navigation (route
      // changes legitimately tear the old subtree down) and it happened at a
      // precise tier — that's the "React keeps clearing our slot" signal.
      if (currentAnchor && location.href === placedAtUrl) {
        const now = Date.now();
        evictions = evictions.filter((t) => now - t < 60 * 1000);
        evictions.push(now);
        // React keeps tearing down the subtree we anchor in — stop fighting
        // it and live in the (stabler) landmark slot for a while.
        if (evictions.length >= 4) forcedLandmarkUntil = now + 5 * 60 * 1000;
      }
      placeBanner(hostEl);
      return;
    }
    if (hostEl.dataset.mode !== "inline") {
      placeBanner(hostEl); // board content may have rendered — move in-flow
      return;
    }
    if (currentAnchor) {
      // Precise placement: confirm we still sit immediately above our board.
      if (!currentAnchor.isConnected || hostEl.nextElementSibling !== currentAnchor) {
        placeBanner(hostEl);
      }
    } else {
      // Landmark placement: upgrade when a precise board anchor appears, or
      // when a higher-priority landmark has mounted since we placed (e.g. we
      // landed in #jira-frontend before <main> existed).
      const canUpgrade =
        Date.now() >= forcedLandmarkUntil &&
        (queryFirst(EXACT_ANCHORS) || queryFirst(FUZZY_ANCHORS));
      const landmark = queryFirst(LANDMARK_ANCHORS);
      if (canUpgrade || (landmark && hostEl.parentNode !== landmark)) placeBanner(hostEl);
    }
  }

  function scheduleEnsure() {
    const now = Date.now();
    if (now - lastEnsure < 250) {
      if (!ensureTrailing) {
        ensureTrailing = setTimeout(
          () => {
            ensureTrailing = 0;
            scheduleEnsure();
          },
          250 - (now - lastEnsure),
        );
      }
      return;
    }
    lastEnsure = now;
    ensurePlaced();
  }

  /* ---------- watchers (active only while a banner is wanted) ---------- */

  function startWatchers() {
    if (!placeObserver) {
      placeObserver = new MutationObserver(scheduleEnsure);
      const root = document.getElementById("jira-frontend") || document.body;
      placeObserver.observe(root, { childList: true, subtree: true });
    }
    if (!refreshTimer) {
      // Keeps the goal fresh on a tab that never navigates: re-runs update()
      // past the cache TTL, but only while the tab is actually visible.
      refreshTimer = setInterval(() => {
        if (!alive()) {
          teardown();
          return;
        }
        if (document.visibilityState === "visible") update();
      }, REFRESH_MS);
    }
  }

  function stopWatchers() {
    if (placeObserver) {
      placeObserver.disconnect();
      placeObserver = null;
    }
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = 0;
    if (ensureTrailing) clearTimeout(ensureTrailing);
    ensureTrailing = 0;
  }

  /* ---------- rendering ---------- */

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const CLOSE_HTML = `<button class="sgb-close" title="Hide (use the toolbar icon to turn back on)">✕</button>`;

  function bannerHtml(state, payload) {
    if (state === "loading") {
      return `<span class="sgb-label">🎯 Sprint goal</span><span class="sgb-text sgb-muted">Loading…</span>`;
    }
    if (state === "note") {
      return (
        `<span class="sgb-label">${escapeHtml(payload.label)}</span>` +
        `<span class="sgb-text sgb-muted">${escapeHtml(payload.text)}</span>` +
        CLOSE_HTML
      );
    }
    if (state === "empty") {
      return (
        `<span class="sgb-label">Sprint goal</span>` +
        `<span class="sgb-text sgb-muted">${escapeHtml(payload)}</span>` +
        CLOSE_HTML
      );
    }
    // state === "goal": payload is an array of {name, goal}
    const parts = payload.map((s) => {
      const goal =
        s.goal && s.goal.trim()
          ? escapeHtml(s.goal.trim())
          : `<span class="sgb-muted">No goal set for this sprint</span>`;
      const name = escapeHtml(s.name || "Active sprint");
      return `<span class="sgb-sprint"><span class="sgb-name">${name}</span> ${goal}</span>`;
    });
    return (
      `<span class="sgb-label">🎯 Sprint goal</span>` +
      `<span class="sgb-text">${parts.join('<span class="sgb-sep">•</span>')}</span>` +
      CLOSE_HTML
    );
  }

  function renderBanner(state, payload, boardId) {
    // Never create UI on a page that isn't showing THIS board (a stale async
    // continuation could otherwise paint the wrong board's goal in the gap
    // before the deferred navigation handler bumps the generation token).
    const loc = parseBoardLocation(location.href);
    if (!loc || loc.boardId !== boardId) return;
    const host = ensureHost();
    applyTheme();

    // Diff before writing: identical re-renders (same board, same content)
    // would otherwise destroy text selection and the close button's focus.
    const key = state + "|" + boardId + "|" + JSON.stringify(payload === undefined ? null : payload);
    if (key !== lastRenderKey) {
      lastRenderKey = key;
      contentEl.innerHTML = bannerHtml(state, payload);
      const btn = contentEl.querySelector(".sgb-close");
      if (btn) {
        btn.addEventListener("click", () => {
          // boardId is captured at render time; stale renders are already
          // dropped by the update() generation token, so it matches the page.
          updateSeq++; // an in-flight refresh must not resurrect the banner
          removeBanner();
          stopWatchers();
          try {
            chrome.storage.local.set({ [storageKey(boardId)]: false });
          } catch (e) {
            /* orphaned script: the banner is gone for this page either way */
          }
        });
      }
    }
    placeBanner(host);
  }

  /* ---------- orchestration ---------- */

  function errorMessage(err) {
    const status = err && err.status;
    if (status === 401 || status === 403) {
      return "Couldn't load the sprint goal — check that you're logged in to Jira.";
    }
    if (status === 404) return "This board doesn't exist (anymore).";
    return "Couldn't load the sprint goal. Retrying…";
  }

  function scheduleRetry(err) {
    if (retryTimer) clearTimeout(retryTimer);
    const backoff = Math.min(5000 * Math.pow(2, failCount), 60000);
    const delay = Math.max((err && err.retryAfter ? err.retryAfter * 1000 : 0), backoff);
    failCount++;
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      if (!alive()) {
        teardown();
        return;
      }
      // Same gate as the refresh timer: don't hammer Jira from a hidden tab —
      // the visibilitychange handler refreshes as soon as the user returns.
      if (document.visibilityState !== "visible") return;
      update();
    }, delay);
  }

  async function update() {
    const seq = ++updateSeq;
    const loc = parseBoardLocation(location.href);
    if (!loc) {
      currentBoardId = null;
      failCount = 0;
      removeBanner();
      stopWatchers();
      return;
    }
    const boardId = loc.boardId;

    const enabled = await isEnabled(boardId);
    if (seq !== updateSeq) return;
    if (!alive()) {
      teardown();
      return;
    }
    if (boardId !== currentBoardId) {
      // Fresh board context: failure backoff and placement history from the
      // previous board must not carry over.
      failCount = 0;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = 0;
      evictions = [];
      forcedLandmarkUntil = 0;
    }
    currentBoardId = boardId;
    if (!enabled) {
      removeBanner();
      stopWatchers();
      return;
    }

    startWatchers();
    // Only show "Loading…" when the banner isn't already showing this board —
    // a background refresh must not flash the loading state over a valid goal.
    if (!(hostEl && hostEl.isConnected && lastRenderKey.split("|")[1] === boardId)) {
      renderBanner("loading", null, boardId);
    }

    const type = await fetchBoardType(boardId);
    if (seq !== updateSeq) return;
    if (type === "kanban") {
      failCount = 0; // terminal outcome — earlier failures are moot
      renderBanner("note", { label: "Kanban board", text: "sprint goals don't apply here" }, boardId);
      return;
    }

    try {
      const sprints = await fetchActiveSprints(boardId);
      if (seq !== updateSeq) return;
      failCount = 0;
      if (!sprints.length) {
        renderBanner("empty", "No active sprint on this board.", boardId);
      } else {
        renderBanner("goal", sprints, boardId);
      }
    } catch (err) {
      if (seq !== updateSeq) return;
      if (err && err.kanban) {
        boardTypeCache.set(boardId, "kanban");
        failCount = 0;
        renderBanner("note", { label: "Kanban board", text: "sprint goals don't apply here" }, boardId);
        return;
      }
      if (!(err && err.status === 404)) scheduleRetry(err); // a deleted board won't come back
      // A transient failure of a background refresh must not clobber a goal
      // that is already on screen — keep it and retry quietly. Authoritative
      // failures (auth lost, board gone) do replace the content.
      const authoritative =
        err && (err.status === 401 || err.status === 403 || err.status === 404);
      const showingContent =
        hostEl &&
        hostEl.isConnected &&
        (lastRenderKey.startsWith("goal|" + boardId + "|") ||
          lastRenderKey.startsWith("note|" + boardId + "|"));
      if (!showingContent || authoritative) {
        renderBanner("empty", errorMessage(err), boardId);
      }
    }
  }

  /* ---------- react to popup changes ---------- */

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[THEME_KEY]) {
        currentTheme = changes[THEME_KEY].newValue || "system";
        applyTheme();
      }
      if (currentBoardId && changes[storageKey(currentBoardId)]) update();
    });
  } catch (e) {
    /* ignore */
  }

  /* ---------- theme change tracking ---------- */

  // References are kept so teardown() can detach them when the extension
  // context goes away — otherwise an orphaned script keeps handling events
  // for the page's lifetime.
  let themeMedia = null;
  const themeObserver = new MutationObserver(applyTheme);
  try {
    themeMedia = matchMedia("(prefers-color-scheme: dark)");
    themeMedia.addEventListener("change", applyTheme);
  } catch (e) {
    /* ignore */
  }
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-color-mode"],
  });

  /* ---------- SPA navigation handling ---------- */

  function onUrlMaybeChanged() {
    if (!alive()) {
      teardown();
      return;
    }
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      update();
    }
  }

  // Patching history.pushState here would be dead code: content scripts run in
  // an isolated world, so Jira's own pushState calls never hit our wrapper.
  // The Navigation API's `navigate` event, however, does fire in the isolated
  // world for every navigation type (Chrome 102+, which is the manifest
  // minimum). The event precedes the URL change, so check on the next task.
  function onNavigate() {
    setTimeout(onUrlMaybeChanged, 0);
  }

  // Refresh promptly when the user returns to a stale tab.
  function onVisibility() {
    if (document.visibilityState !== "visible") return;
    if (!alive()) {
      teardown();
      return;
    }
    if (currentBoardId && parseBoardLocation(location.href)) update();
  }

  if ("navigation" in window) {
    window.navigation.addEventListener("navigate", onNavigate);
  } else {
    navPollTimer = setInterval(onUrlMaybeChanged, 1000);
  }
  window.addEventListener("popstate", onUrlMaybeChanged);
  document.addEventListener("visibilitychange", onVisibility);

  loadTheme();
  update();
})();
