const speedSlider = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const toggleBtn = document.getElementById("toggle");
const dirUpBtn = document.getElementById("dir-up");
const dirDownBtn = document.getElementById("dir-down");

function sendMessage(msg, cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const tabId = tabs[0].id;
    chrome.tabs.sendMessage(tabId, msg, (response) => {
      if (chrome.runtime.lastError) {
        // Content script not injected yet — inject it, then retry
        chrome.scripting.executeScript(
          { target: { tabId }, files: ["content.js"] },
          () => {
            chrome.tabs.sendMessage(tabId, msg, cb);
          }
        );
      } else if (cb) {
        cb(response);
      }
    });
  });
}

function updateUI(state) {
  if (!state) return;
  speedSlider.value = state.speed;
  speedValue.textContent = state.speed;

  if (state.direction === -1) {
    dirUpBtn.classList.add("active");
    dirDownBtn.classList.remove("active");
  } else {
    dirDownBtn.classList.add("active");
    dirUpBtn.classList.remove("active");
  }

  if (state.scrolling) {
    toggleBtn.textContent = "Stop";
    toggleBtn.classList.add("active");
  } else {
    toggleBtn.textContent = "Start";
    toggleBtn.classList.remove("active");
  }
}

// Sync UI with current content script state
sendMessage({ type: "get-state" }, updateUI);

speedSlider.addEventListener("input", () => {
  const val = Number(speedSlider.value);
  speedValue.textContent = val;
  sendMessage({ type: "set-speed", speed: val }, updateUI);
});

toggleBtn.addEventListener("click", () => {
  sendMessage({ type: "toggle-scroll" }, updateUI);
});

dirUpBtn.addEventListener("click", () => {
  sendMessage({ type: "set-direction", direction: -1 }, updateUI);
});

dirDownBtn.addEventListener("click", () => {
  sendMessage({ type: "set-direction", direction: 1 }, updateUI);
});
