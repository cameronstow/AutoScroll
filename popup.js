const speedSlider = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const toggleBtn = document.getElementById("toggle");
const dirUpBtn = document.getElementById("dir-up");
const dirDownBtn = document.getElementById("dir-down");

let activeTabId = null;
let isScrolling = false;
let currentSpeed = 80;
let currentDirection = 1;

// Load saved settings
chrome.storage.local.get(["speed", "direction"], (data) => {
  if (data.speed != null) {
    currentSpeed = data.speed;
    speedSlider.value = currentSpeed;
    speedValue.textContent = currentSpeed;
  }
  if (data.direction != null) {
    currentDirection = data.direction;
    if (currentDirection === -1) {
      dirUpBtn.classList.add("active");
      dirDownBtn.classList.remove("active");
    }
  }
});

function getTabId(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) cb(tabs[0].id);
  });
}

function startScrolling() {
  getTabId((tabId) => {
    activeTabId = tabId;
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (speed, direction) => {
        // Stop any previous AutoScroll
        if (window.__autoScrollInterval) {
          clearInterval(window.__autoScrollInterval);
          window.__autoScrollInterval = null;
        }

        // Find scroll target
        function findTarget() {
          // Try window
          const before = window.scrollY;
          window.scrollBy(0, 1);
          if (window.scrollY !== before) {
            window.scrollBy(0, -1);
            return null;
          }

          // Walk up from center element
          let el = document.elementFromPoint(
            window.innerWidth / 2,
            window.innerHeight / 2
          );
          while (el && el !== document.documentElement) {
            if (el.scrollHeight > el.clientHeight) {
              const b = el.scrollTop;
              el.scrollTop = b + 1;
              if (el.scrollTop !== b) {
                el.scrollTop = b;
                return el;
              }
            }
            el = el.parentElement;
          }

          // Brute force — largest scrollable element
          let best = null;
          let bestArea = 0;
          for (const c of document.querySelectorAll("*")) {
            if (c.scrollHeight <= c.clientHeight) continue;
            const b = c.scrollTop;
            c.scrollTop = b + 1;
            if (c.scrollTop !== b) {
              c.scrollTop = b;
              const area = c.clientWidth * c.clientHeight;
              if (area > bestArea) {
                bestArea = area;
                best = c;
              }
            }
          }
          return best;
        }

        const target = findTarget();
        const tickMs = 16;
        window.__autoScrollTarget = target;
        window.__autoScrollInterval = setInterval(() => {
          const px = (speed * direction * tickMs) / 1000;
          if (target) {
            target.scrollTop += px;
          } else {
            window.scrollBy(0, px);
          }
        }, tickMs);
      },
      args: [currentSpeed, currentDirection],
    }, (results) => {
      const errEl = document.getElementById("error");
      if (chrome.runtime.lastError) {
        errEl.textContent = "Restricted page — paste snippet in console (Cmd+Option+J). Run again to stop.";
        errEl.style.display = "block";
        showSnippet();
        return;
      }
      errEl.style.display = "none";
      isScrolling = true;
      toggleBtn.textContent = "Stop";
      toggleBtn.classList.add("active");
      chrome.storage.local.set({ speed: currentSpeed, direction: currentDirection });
    });
  });
}

function stopScrolling() {
  getTabId((tabId) => {
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        if (window.__autoScrollInterval) {
          clearInterval(window.__autoScrollInterval);
          window.__autoScrollInterval = null;
        }
      },
    });
    isScrolling = false;
    toggleBtn.textContent = "Start";
    toggleBtn.classList.remove("active");
  });
}

function updateSpeed() {
  if (!isScrolling || activeTabId == null) return;
  // Restart with new speed
  startScrolling();
}

// Check if already scrolling on this tab
getTabId((tabId) => {
  activeTabId = tabId;
  chrome.scripting.executeScript(
    {
      target: { tabId },
      world: "MAIN",
      func: () => !!window.__autoScrollInterval,
    },
    (results) => {
      if (results && results[0] && results[0].result) {
        isScrolling = true;
        toggleBtn.textContent = "Stop";
        toggleBtn.classList.add("active");
      }
    }
  );
});

function buildSnippet() {
  const s = currentSpeed;
  const d = currentDirection;
  return `(()=>{if(window.__as){clearInterval(window.__as);window.__as=null;return}let t=null,e=document.elementFromPoint(innerWidth/2,innerHeight/2);while(e&&e!==document.documentElement){if(e.scrollHeight>e.clientHeight){let b=e.scrollTop;e.scrollTop=b+1;if(e.scrollTop!==b){e.scrollTop=b;t=e;break}}e=e.parentElement}if(!t){let best=null,ba=0;for(let c of document.querySelectorAll("*")){if(c.scrollHeight<=c.clientHeight)continue;let b=c.scrollTop;c.scrollTop=b+1;if(c.scrollTop!==b){c.scrollTop=b;let a=c.clientWidth*c.clientHeight;if(a>ba){ba=a;best=c}}}t=best}window.__as=setInterval(()=>{let px=${s}*${d}*16/1000;if(t)t.scrollTop+=px;else scrollBy(0,px)},16)})()`;
}

function showSnippet() {
  const tip = document.getElementById("snippet-tip");
  const code = document.getElementById("snippet-code");
  code.textContent = buildSnippet();
  tip.style.display = "block";

  document.getElementById("copy-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(buildSnippet()).then(() => {
      document.getElementById("copy-btn").textContent = "Copied!";
      setTimeout(() => {
        document.getElementById("copy-btn").textContent = "Copy";
      }, 1500);
    });
  });
}

function updateSnippet() {
  const tip = document.getElementById("snippet-tip");
  if (tip && tip.style.display !== "none") {
    document.getElementById("snippet-code").textContent = buildSnippet();
  }
}

toggleBtn.addEventListener("click", () => {
  if (isScrolling) {
    stopScrolling();
  } else {
    startScrolling();
  }
});

speedSlider.addEventListener("input", () => {
  currentSpeed = Number(speedSlider.value);
  speedValue.textContent = currentSpeed;
  chrome.storage.local.set({ speed: currentSpeed });
  updateSpeed();
  updateSnippet();
});

dirUpBtn.addEventListener("click", () => {
  currentDirection = -1;
  dirUpBtn.classList.add("active");
  dirDownBtn.classList.remove("active");
  chrome.storage.local.set({ direction: currentDirection });
  updateSpeed();
  updateSnippet();
});

dirDownBtn.addEventListener("click", () => {
  currentDirection = 1;
  dirDownBtn.classList.add("active");
  dirUpBtn.classList.remove("active");
  chrome.storage.local.set({ direction: currentDirection });
  updateSpeed();
  updateSnippet();
});
