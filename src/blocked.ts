// blocked.ts (CSP-compliant external script for blocked.html)

const urlParams = new URLSearchParams(window.location.search);
const detectedContext = urlParams.get("context") || "Unknown";
const originalUrl = urlParams.get("url") || "";
const domain = originalUrl ? new URL(originalUrl).hostname : "";

document.addEventListener("DOMContentLoaded", () => {
  const detectedEl = document.getElementById("detected-context");
  if (detectedEl) {
    detectedEl.textContent = detectedContext;
  }

  updateCountdown();
  setInterval(updateCountdown, 5000);

  const selector = document.getElementById("context-selector") as HTMLSelectElement;
  if (selector && detectedContext !== "Unknown") {
    for (let i = 0; i < selector.options.length; i++) {
      if (selector.options[i].value === detectedContext) {
        selector.selectedIndex = i;
        break;
      }
    }
  }

  const saveBtn = document.getElementById("save-continue") as HTMLButtonElement;
  const backBtn = document.getElementById("back-button") as HTMLButtonElement;

  saveBtn?.addEventListener("click", async () => {
    if (!selector.value) {
      alert("Please select a context category first");
      return;
    }

    try {
      const focusState = await chrome.runtime.sendMessage({ type: "FOCUS_STATUS" });
      if (focusState?.allowedContexts && !focusState.allowedContexts.includes(selector.value)) {
        document.body.classList.add("off-track");
        alert(`${selector.value} context is not allowed during your current focus session`);
        return;
      }

      document.body.classList.add("on-track");
      if (domain) await saveContextOverride(domain, selector.value);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.runtime.sendMessage({ type: "OVERRIDE_BLOCK", tabId: tab?.id });

      // Add delay to let background script register unblock
      setTimeout(() => {
        window.location.href = originalUrl || navigateToContextSite(selector.value);
      }, 300);
    } catch (err) {
      console.error("Error saving context:", err);
      alert("There was an error saving your selection. Please try again.");
    }
  });

  backBtn?.addEventListener("click", async () => {
    try {
      await chrome.runtime.sendMessage({
        type: "STAY_FOCUSED_ACTION",
        payload: {
          url: originalUrl,
          context: detectedContext,
          title: domain
        }
      });
    } catch (err) {
      console.error("Error going back:", err);
      window.location.href = "https://google.com";
    }
  });
});

async function safeGetTimeLeft(): Promise<{ seconds: number }> {
  try {
    return await chrome.runtime.sendMessage({ type: "GET_FOCUS_TIME_LEFT" });
  } catch {
    await new Promise((res) => setTimeout(res, 100));
    return chrome.runtime.sendMessage({ type: "GET_FOCUS_TIME_LEFT" });
  }
}

async function updateCountdown(): Promise<void> {
  const resp = await safeGetTimeLeft();
  const secs = Math.floor(resp?.seconds ?? 0);
  const countdown = document.getElementById("countdown");
  if (!countdown) return;

  if (secs === -1) {
    countdown.textContent = "∞ (unlimited)";
  } else if (secs > 0) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    countdown.textContent = `${m}:${s.toString().padStart(2, "0")}`;
  } else {
    window.location.href = "about:blank";
  }
}

function navigateToContextSite(context: string): string {
  const contextSites: Record<string, string> = {
    Work: "https://docs.google.com",
    Development: "https://github.com",
    Research: "https://scholar.google.com",
    Learning: "https://coursera.org",
    News: "https://news.google.com",
    Social: "https://linkedin.com",
    Shopping: "https://google.com",
    Entertainment: "https://google.com",
  };
  return contextSites[context] || "https://google.com";
}

async function saveContextOverride(domain: string, context: string): Promise<void> {
  try {
    const storage = await chrome.storage.local.get("domainContextMap");
    const domainContextMap = storage.domainContextMap || {};
    domainContextMap[domain] = context;
    await chrome.storage.local.set({ domainContextMap });
    await chrome.runtime.sendMessage({
      type: "CONTEXT_OVERRIDE",
      domain,
      originalContext: detectedContext,
      newContext: context,
    });
  } catch (err) {
    console.error("Failed to save context override:", err);
    throw err;
  }
}
