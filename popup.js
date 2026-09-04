/* Popup: toggle the banner on/off for the board in the current tab. */

const boardEl = document.getElementById("board");
const toggleEl = document.getElementById("toggle");
const noteEl = document.getElementById("note");

function boardIdFromUrl(url) {
  if (!url) return null;
  let m = url.match(/\/boards\/(\d+)/);
  if (m) return m[1];
  m = url.match(/[?&]rapidView=(\d+)/);
  if (m) return m[1];
  return null;
}

function storageKey(boardId) {
  return "sgb:enabled:" + boardId;
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url;
  const onJira = url && /^https:\/\/[^/]+\.atlassian\.net\//.test(url);
  const boardId = onJira ? boardIdFromUrl(url) : null;

  if (!boardId) {
    boardEl.innerHTML = onJira
      ? "You're on Jira, but not on a board view."
      : "This tab isn't a Jira board.";
    noteEl.textContent = "Open a board (…/boards/123) to toggle its banner.";
    return;
  }

  boardEl.innerHTML = `Board <b>#${boardId}</b>`;
  const key = storageKey(boardId);
  const stored = await chrome.storage.local.get(key);
  const enabled = stored[key] !== false; // default ON

  toggleEl.checked = enabled;
  toggleEl.disabled = false;
  noteEl.textContent = enabled
    ? "Banner is on for this board."
    : "Banner is hidden for this board.";

  toggleEl.addEventListener("change", async () => {
    const on = toggleEl.checked;
    await chrome.storage.local.set({ [key]: on });
    noteEl.textContent = on
      ? "Banner is on for this board."
      : "Banner is hidden for this board.";
  });
}

init().catch((e) => {
  boardEl.textContent = "Something went wrong.";
  noteEl.textContent = String(e);
});

/* Banner theme (global): System / Light / Dark */
const THEME_KEY = "sgb:theme";
const themeEl = document.getElementById("theme");

function paintTheme(value) {
  themeEl.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", b.dataset.theme === value);
  });
}

async function initTheme() {
  const stored = await chrome.storage.local.get(THEME_KEY);
  paintTheme(stored[THEME_KEY] || "system");
  themeEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-theme]");
    if (!btn) return;
    paintTheme(btn.dataset.theme);
    await chrome.storage.local.set({ [THEME_KEY]: btn.dataset.theme });
  });
}

initTheme();
