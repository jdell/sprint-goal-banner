/*
 * Sprint Goal Banner for Jira
 * Injects a banner under the Jira header showing the active sprint's goal, and
 * pushes the page content down so nothing is hidden behind it.
 * Works on Jira Cloud (*.atlassian.net) by reading the board id from the URL
 * and calling the same-origin Agile REST API with the user's own session.
 */
(function () {
  "use strict";

  // Guard against the content script being injected more than once.
  if (window.__sgbBannerLoaded) return;
  window.__sgbBannerLoaded = true;

  const BANNER_ID = "sgb-sprint-goal-banner";
  const CACHE_TTL_MS = 60 * 1000;

  const THEME_KEY = "sgb:theme"; // "system" | "light" | "dark"
  let lastUrl = "";
  let lastBoardId = null;
  let currentTheme = "system";
  const cache = new Map(); // boardId -> { ts, sprints }

  function loadTheme() {
    try {
      chrome.storage.local.get(THEME_KEY, (res) => {
        currentTheme = res[THEME_KEY] || "system";
        const banner = document.getElementById(BANNER_ID);
        if (banner) banner.dataset.sgbTheme = currentTheme;
      });
    } catch (e) {
      /* ignore */
    }
  }

  /* ---------- board id detection ---------- */

  function getBoardId() {
    const url = window.location.href;
    let m = url.match(/\/boards\/(\d+)/);
    if (m) return m[1];
    m = url.match(/[?&]rapidView=(\d+)/);
    if (m) return m[1];
    return null;
  }

  function onBoardPage() {
    return (
      /\/(boards|RapidBoard)\b/i.test(window.location.href) ||
      /[?&]rapidView=\d+/.test(window.location.href)
    );
  }

  /* ---------- per-board enabled setting ---------- */

  function storageKey(boardId) {
    return "sgb:enabled:" + boardId;
  }

  function isEnabled(boardId) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(storageKey(boardId), (res) => {
          resolve(res[storageKey(boardId)] !== false); // default ON
        });
      } catch (e) {
        resolve(true);
      }
    });
  }

  /* ---------- data fetching ---------- */

  async function fetchActiveSprints(boardId) {
    const cached = cache.get(boardId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.sprints;

    const base = window.location.origin;
    const res = await fetch(
      `${base}/rest/agile/1.0/board/${boardId}/sprint?state=active`,
      { credentials: "include", headers: { Accept: "application/json" } },
    );
    if (!res.ok) {
      // Kanban boards don't support sprints and return 400 here.
      if (res.status === 400) {
        const err = new Error("kanban");
        err.kanban = true;
        throw err;
      }
      throw new Error("HTTP " + res.status);
    }
    const data = await res.json();
    const sprints = Array.isArray(data.values) ? data.values : [];
    cache.set(boardId, { ts: Date.now(), sprints });
    return sprints;
  }

  /* ---------- push content down ---------- */

  // The banner is placed as a normal in-flow element directly above the board
  // content, so it sits in the gap between the filter toolbar and the board and
  // pushes the board down on its own — no fixed positioning, no overlap.
  function findBoardContent() {
    return (
      document.querySelector(
        '[data-testid="software-board.board-container"]',
      ) ||
      document.querySelector(
        '[data-testid="platform-board-kit.ui.board.scroll.board-scroll"]',
      ) ||
      document.querySelector('[data-testid="software-board.board"]') ||
      document.querySelector(
        '[data-test-id="platform-board-kit.ui.board.scroll.board-scroll"]',
      ) ||
      document.querySelector('[data-vc="page-container-v2-main-wrapper"]') ||
      document.querySelector('[data-vc="business-board-container"]') ||
      null
    );
  }

  // Insert the banner immediately before the board content, within the same
  // parent, so it lands in the toolbar/board gap. Returns true if placed inline.
  function placeBanner(banner) {
    const board = findBoardContent();
    if (board && board.parentNode) {
      banner.dataset.mode = "inline";
      if (
        banner.nextElementSibling !== board ||
        banner.parentNode !== board.parentNode
      ) {
        board.parentNode.insertBefore(banner, board);
      }
      return true;
    }
    // Fallback: keep it in the document until the board renders.
    banner.dataset.mode = "float";
    if (banner.parentNode !== document.documentElement) {
      document.documentElement.appendChild(banner);
    }
    return false;
  }

  /* ---------- rendering ---------- */

  function removeBanner() {
    const el = document.getElementById(BANNER_ID);
    if (el) el.remove();
  }

  function renderBanner(state, payload) {
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement("div");
      banner.id = BANNER_ID;
    }
    placeBanner(banner);
    banner.dataset.state = state;
    banner.dataset.sgbTheme = currentTheme;

    if (state === "loading") {
      banner.innerHTML = `<span class="sgb-label">🎯 Sprint goal</span><span class="sgb-text sgb-muted">Loading…</span>`;
    } else if (state === "note") {
      // Custom label + message (payload = { label, text }).
      banner.innerHTML =
        `<span class="sgb-label">${escapeHtml(payload.label)}</span>` +
        `<span class="sgb-text sgb-muted">${escapeHtml(payload.text)}</span>`;
    } else if (state === "empty") {
      banner.innerHTML = `<span class="sgb-label">Sprint goal</span><span class="sgb-text sgb-muted">${escapeHtml(payload)}</span>`;
    } else {
      // state === "goal": payload is an array of {name, goal}
      const parts = payload.map((s) => {
        const goal =
          s.goal && s.goal.trim()
            ? escapeHtml(s.goal.trim())
            : `<span class="sgb-muted">No goal set for this sprint</span>`;
        const name = escapeHtml(s.name || "Active sprint");
        return `<span class="sgb-sprint"><span class="sgb-name">${name}</span> ${goal}</span>`;
      });
      banner.innerHTML =
        `<span class="sgb-label">🎯 Sprint goal</span>` +
        `<span class="sgb-text">${parts.join('<span class="sgb-sep">•</span>')}</span>` +
        `<button class="sgb-close" title="Hide (use the toolbar icon to turn back on)">✕</button>`;
      banner.querySelector(".sgb-close").addEventListener("click", () => {
        if (lastBoardId) {
          try {
            chrome.storage.local.set({ [storageKey(lastBoardId)]: false });
          } catch (e) {
            /* ignore */
          }
        }
        removeBanner();
      });
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- orchestration ---------- */

  async function update() {
    if (!onBoardPage()) {
      removeBanner();
      lastBoardId = null;
      return;
    }

    const boardId = getBoardId();
    if (!boardId) {
      removeBanner();
      return;
    }

    if (!(await isEnabled(boardId))) {
      removeBanner();
      lastBoardId = boardId;
      return;
    }

    if (!(boardId === lastBoardId && document.getElementById(BANNER_ID))) {
      renderBanner("loading");
    }
    lastBoardId = boardId;

    try {
      const sprints = await fetchActiveSprints(boardId);
      if (!sprints.length)
        renderBanner("empty", "No active sprint on this board.");
      else renderBanner("goal", sprints);
    } catch (err) {
      if (err && err.kanban) {
        renderBanner("note", {
          label: "Kanban board",
          text: "sprint goals don't apply here",
        });
      } else {
        renderBanner("empty", "Couldn't load the sprint goal.");
      }
    }
  }

  /* ---------- react to toggle changes from the popup ---------- */

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[THEME_KEY]) {
        currentTheme = changes[THEME_KEY].newValue || "system";
        const banner = document.getElementById(BANNER_ID);
        if (banner) banner.dataset.sgbTheme = currentTheme;
      }
      const key = lastBoardId ? storageKey(lastBoardId) : null;
      if (key && changes[key]) update();
    });
  } catch (e) {
    /* ignore */
  }

  /* ---------- SPA navigation handling ---------- */

  function onUrlMaybeChanged() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      update();
    }
  }

  ["pushState", "replaceState"].forEach((fn) => {
    const orig = history[fn];
    history[fn] = function () {
      const r = orig.apply(this, arguments);
      window.dispatchEvent(new Event("sgb:locationchange"));
      return r;
    };
  });
  window.addEventListener("popstate", onUrlMaybeChanged);
  window.addEventListener("sgb:locationchange", onUrlMaybeChanged);

  setInterval(() => {
    onUrlMaybeChanged();
    const banner = document.getElementById(BANNER_ID);
    if (onBoardPage() && lastBoardId) {
      if (!banner) {
        update(); // banner got dropped by a Jira re-render — rebuild it
      } else if (banner.dataset.mode !== "inline") {
        placeBanner(banner); // board content finally rendered — move it inline
      }
    }
  }, 1500);

  lastUrl = window.location.href;
  loadTheme();
  update();
})();
