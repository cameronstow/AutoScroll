chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const tabId = tabs[0].id;

    if (command === "toggle-scroll") {
      chrome.storage.local.get(["speed", "direction"], (data) => {
        const speed = data.speed || 80;
        const direction = data.direction || 1;
        chrome.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          func: (speed, direction) => {
            if (window.__autoScrollInterval) {
              clearInterval(window.__autoScrollInterval);
              window.__autoScrollInterval = null;
              return;
            }

            function findTarget() {
              const before = window.scrollY;
              window.scrollBy(0, 1);
              if (window.scrollY !== before) {
                window.scrollBy(0, -1);
                return null;
              }
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
          args: [speed, direction],
        });
      });
    }

    if (command === "speed-up" || command === "speed-down") {
      chrome.storage.local.get(["speed", "direction"], (data) => {
        let speed = data.speed || 80;
        const direction = data.direction || 1;
        speed =
          command === "speed-up"
            ? Math.min(500, speed + 20)
            : Math.max(10, speed - 20);
        chrome.storage.local.set({ speed });

        chrome.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          func: (newSpeed, dir) => {
            if (!window.__autoScrollInterval) return;
            clearInterval(window.__autoScrollInterval);
            const target = window.__autoScrollTarget;
            const tickMs = 16;
            window.__autoScrollInterval = setInterval(() => {
              const px = (newSpeed * dir * tickMs) / 1000;
              if (target) {
                target.scrollTop += px;
              } else {
                window.scrollBy(0, px);
              }
            }, tickMs);
          },
          args: [speed, direction],
        });
      });
    }
  });
});
