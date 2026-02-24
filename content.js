(() => {
  // Clean up any previous injection
  if (window.__scrollToolCleanup) {
    window.__scrollToolCleanup();
  }

  const SPEED_MIN = 10;
  const SPEED_MAX = 500;
  const SPEED_STEP = 20;
  const SPEED_DEFAULT = 80;

  let scrolling = false;
  let speed = SPEED_DEFAULT; // pixels per second
  let direction = 1; // 1 = down, -1 = up
  let intervalId = null;
  let scrollTarget = null; // null = window, otherwise an element

  const TICK_MS = 16; // ~60fps

  function findScrollTarget() {
    // Try window first
    const beforeWin = window.scrollY;
    window.scrollBy(0, 1);
    if (window.scrollY !== beforeWin) {
      window.scrollBy(0, -1);
      return null;
    }

    // Get element at center of viewport and walk up ancestors
    const centerEl = document.elementFromPoint(
      window.innerWidth / 2,
      window.innerHeight / 2
    );

    let el = centerEl;
    while (el && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight) {
        const before = el.scrollTop;
        el.scrollTop = before + 1;
        if (el.scrollTop !== before) {
          el.scrollTop = before;
          return el;
        }
      }
      el = el.parentElement;
    }

    // Brute force: scan ALL elements, pick the largest scrollable one
    let best = null;
    let bestArea = 0;
    for (const candidate of document.querySelectorAll("*")) {
      if (candidate.scrollHeight <= candidate.clientHeight) continue;
      const before = candidate.scrollTop;
      candidate.scrollTop = before + 1;
      if (candidate.scrollTop !== before) {
        candidate.scrollTop = before;
        const area = candidate.clientWidth * candidate.clientHeight;
        if (area > bestArea) {
          bestArea = area;
          best = candidate;
        }
      }
    }

    return best;
  }

  function doScroll() {
    const px = (speed * direction * TICK_MS) / 1000;

    if (scrollTarget) {
      scrollTarget.scrollTop += px;
    } else {
      window.scrollBy(0, px);
    }
  }

  function startScrolling() {
    if (scrolling) return;
    scrollTarget = findScrollTarget();
    console.log("[AutoScroll] target:", scrollTarget, "| scrollHeight:", scrollTarget?.scrollHeight, "clientHeight:", scrollTarget?.clientHeight);
    scrolling = true;
    intervalId = setInterval(doScroll, TICK_MS);
    saveState();
  }

  function stopScrolling() {
    scrolling = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    scrollTarget = null;
    saveState();
  }

  function setSpeed(newSpeed) {
    speed = Math.max(SPEED_MIN, Math.min(SPEED_MAX, newSpeed));
    if (scrolling) {
      clearInterval(intervalId);
      intervalId = setInterval(doScroll, TICK_MS);
    }
    saveState();
  }

  function setDirection(newDir) {
    direction = newDir;
    saveState();
  }

  function toggleScroll() {
    if (scrolling) {
      stopScrolling();
    } else {
      startScrolling();
    }
  }

  function saveState() {
    chrome.storage.local.set({ speed, direction });
  }

  function getState() {
    return { scrolling, speed, direction };
  }

  // Load saved settings on init
  chrome.storage.local.get(["speed", "direction"], (data) => {
    if (data.speed != null) speed = data.speed;
    if (data.direction != null) direction = data.direction;
  });

  // Listen for messages from popup and background
  const messageListener = (msg, sender, sendResponse) => {
    switch (msg.type) {
      case "start":
        startScrolling();
        break;
      case "stop":
        stopScrolling();
        break;
      case "toggle-scroll":
        toggleScroll();
        break;
      case "set-speed":
        setSpeed(msg.speed);
        break;
      case "set-direction":
        setDirection(msg.direction);
        break;
      case "speed-up":
        setSpeed(speed + SPEED_STEP);
        break;
      case "speed-down":
        setSpeed(speed - SPEED_STEP);
        break;
      case "get-state":
        break;
    }
    sendResponse(getState());
    return true;
  };
  chrome.runtime.onMessage.addListener(messageListener);

  // Allow future injections to clean up this instance
  window.__scrollToolCleanup = () => {
    stopScrolling();
    chrome.runtime.onMessage.removeListener(messageListener);
  };

  console.log("[AutoScroll] content script loaded");
})();
