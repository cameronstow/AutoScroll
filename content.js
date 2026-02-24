(() => {
  // Prevent double injection
  if (window.__scrollToolInjected) return;
  window.__scrollToolInjected = true;

  const SPEED_MIN = 10;
  const SPEED_MAX = 500;
  const SPEED_STEP = 20;
  const SPEED_DEFAULT = 80;

  let scrolling = false;
  let speed = SPEED_DEFAULT; // pixels per second
  let direction = 1; // 1 = down, -1 = up
  let intervalId = null;

  const TICK_MS = 16; // ~60fps

  function doScroll() {
    const px = (speed * direction * TICK_MS) / 1000;
    // Try multiple scroll targets for maximum compatibility
    const before = window.scrollY;
    window.scrollBy(0, px);
    if (window.scrollY === before) {
      // Fallback: directly set scrollTop on documentElement and body
      document.documentElement.scrollTop += px;
      document.body.scrollTop += px;
    }
  }

  function startScrolling() {
    if (scrolling) return;
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
    saveState();
  }

  function setSpeed(newSpeed) {
    speed = Math.max(SPEED_MIN, Math.min(SPEED_MAX, newSpeed));
    // Restart interval with new speed if scrolling
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
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
  });
})();
