import { groupTabByContext, onTabRemoved, ungroupAllTabs } from "../api/tabsApi";
import { getStorage, setStorage, getFocusState, setFocusState } from "../api/storageApi";
import { checkFocusStatus, showFocusNotification } from "../api/focusApi";
import { restoreWorkspace } from "../api/focusSessionManager";
import { classifyPageContext } from "../lib/contextEngine";
import { extractDomain } from "../lib/contextEngine/urlAnalyzer";
import { saveForLater, releaseParkedLinks, goBackOrClose } from "../api/parkedLinksApi";
import * as focusEngine from "../lib/focusEngine";

const tabContextMap: Record<number, string> = {};
const BLOCKED_PAGE_URL = chrome.runtime.getURL("blocked.html");

/**
 * Initialize the extension with proper default settings
 */
async function initExtension(): Promise<void> {
  // Always enable the extension
  await setStorage({ extensionEnabled: true });
  
  console.log("[Background] Extension enabled.");
  
  // Check for active sessions - now using the new focusState
  const focusState = await getFocusState();
  if (focusState.active) {
    console.log("[Background] Focus session was active at shutdown, verifying...");
    // Verify session is still valid (not expired)
    if (!focusState.endTime || focusState.endTime <= Date.now()) {
      console.log("[Background] Focus session expired during shutdown, cleaning up");
      await setFocusState({ active: false, endTime: undefined });
    } else {
      console.log(`[Background] Focus session continues until ${new Date(focusState.endTime).toLocaleTimeString()}`);
    }
  }
  
  // Setup URL blocking for Focus Session - always setup the handler
  setupFocusSessionUrlBlocking();
  
  // Set up periodic checks
  setupPeriodicChecks();
}

/**
 * Set up all periodic checks needed for the extension
 */
function setupPeriodicChecks() {
  // Periodic check for session end
  setInterval(checkFocusSessionStatus, 30000); // check every 30s
  
  // More frequent check for focus loss during active sessions
  setInterval(async () => {
    try {
      const isSessionActive = await focusEngine.isActive();
      if (isSessionActive) {
        const focusStatus = await checkFocusStatus();
        if (focusStatus.isLostFocus) {
          // Immediately send a drift warning if focus is lost
          await sendDriftWarning(focusStatus);
        }
        // Update badge regardless
        updateBadge();
      }
    } catch (err) {
      console.error("Error in focus check interval:", err);
    }
  }, 10000); // Check every 10 seconds during active sessions
}

/**
 * Handle messages from content scripts and the UI
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CONTEXT_UPDATE" || request.type === "CONTEXT_DETECTED") {
    const context = request.context as string;
    const tabId = sender.tab?.id;
    
    if (tabId != null) {
      // Check if context has changed
      const previousContext = tabContextMap[tabId];
      if (previousContext !== context) {
        // Notify focus mode about context change
        // handleContextChange(context);
      }
      
      tabContextMap[tabId] = context;
      
      // Store additional context data if available
      const contextData = {
        context,
        confidence: request.confidence,
        secondaryContexts: request.secondaryContexts,
        url: request.url
      };
      
      // Save context data to storage for URL blocking functionality
      chrome.storage.local.set({
        [request.url]: { context: request.context, confidence: request.confidence }
      });
      
      // Handle the context update
      handleContextUpdate(tabId, context, contextData).catch((err) => console.error(err));
    }
    
    return false; // No response needed
  } 
  else if (request.type === "FOCUS_TOGGLE") {
    toggleFocusMode(request.enabled).catch((err) => console.error(err));
    return false; // No response needed
  }
  else if (request.type === "START_FOCUS_SESSION") {
    const { durationMinutes, blockedCategories } = request.payload || {};
    
    const KNOWN_CONTEXTS = [
      "Work", "Development", "Research", "Learning",
      "Entertainment", "Social", "Shopping", "News"
    ];
    const allowedContexts = KNOWN_CONTEXTS.filter(
      ctx => !blockedCategories?.includes(ctx)
    );
    
    focusEngine.start(allowedContexts, durationMinutes)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error(err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Indicates async response
  }
  else if (request.type === "END_FOCUS_SESSION") {
    focusEngine.end()
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error("Error ending focus session:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Required for async response
  }
  else if (request.type === "GET_FOCUS_TIME_LEFT") {
    getFocusState()
      .then(focusState => {
        const seconds = focusState.endTime
          ? Math.max(0, (focusState.endTime - Date.now()) / 1000)
          : 0;
        sendResponse({ seconds });
      })
      .catch(error => {
        console.error("Error getting focus time left:", error);
        sendResponse({ seconds: 0 });
      });
    return true; // Required for async response
  }
  else if (request.type === "OVERRIDE_BLOCK") {
    // Allow explicit override
    // Just respond with success, this would unblock the tab 
    // if we had a temporary block list
    sendResponse({ success: true });
    return true;
  }
  else if (request.type === "RESTORE_WORKSPACE") {
    const { name } = request.payload || {};
    restoreWorkspace(name)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error(err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Indicates async response
  }
  else if (request.type === "CHECK_FOCUS_STATUS") {
    checkFocusStatus()
      .then(result => sendResponse(result))
      .catch(error => {
        console.error("Error checking focus status:", error);
        sendResponse(null);
      });
    return true; // Required for async response
  }
  else if (request.type === "CONTENT_SCRIPT_READY") {
    // Content script is ready to receive messages
    const tabId = sender.tab?.id;
    // if (tabId && activeTimer && activeTimer.active && activeTimer.endTime > Date.now()) {
    //   console.log(`Tab ${tabId} is ready, sending active timer`);
    //   // Send the timer right away
    //   chrome.tabs.sendMessage(tabId, {
    //     type: "RESTORE_FOCUS_TIMER",
    //     timerState: activeTimer
    //   }).catch(err => {
    //     console.log('Tab not fully ready, will retry');
    //     // Try again after a short delay
    //     setTimeout(() => {
    //       chrome.tabs.sendMessage(tabId, {
    //         type: 'RESTORE_FOCUS_TIMER',
    //         timerState: activeTimer
    //       }).catch(err => console.error('Failed to restore timer after content script ready retry:', err));
    //     }, 500);
    //   });
    // }
    sendResponse({ success: true });
    return true;
  }
  else if (request.type === "TIMER_EXPIRED") {
    // Handle timer expiration from the side panel
    // endFocusTimer();
    // Show a drift warning on the current page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "DRIFT_WARNING",
          message: "Time's up! Return to your primary task now."
        }, (resp) => {
          if (chrome.runtime.lastError || resp === undefined) {
            // Nobody listened - fall back to the blocked page
            chrome.tabs.update(tabs[0].id!, {url: BLOCKED_PAGE_URL});
          }
        });
      }
    });
    sendResponse({ success: true });
    return true;
  }
  else if (request.type === "PARK_LINK") {
    const { url, context, title } = request;
    
    // Handle the parked link asynchronously
    (async () => {
      try {
        await saveForLater(url, context, title);
        console.log(`[Parked Links] Saved for later: ${title || url} (${context})`);
      } catch (error) {
        console.error("Error parking link:", error);
      }
    })();
    
    return false; // No response needed
  }
  else if (request.type === "RELEASE_PARKED_LINKS") {
    // Handle the release of parked links asynchronously
    (async () => {
      try {
        await releaseParkedLinks();
        sendResponse({ success: true });
      } catch (error) {
        console.error("Error releasing parked links:", error);
        sendResponse({ success: false, error: String(error) });
      }
    })();
    
    return true; // Indicates async response
  }
  else if (request.type === "TRAIN_CONTEXT") {
    (async () => {
      const { url, title, actualContext, predictedContext, isFalsePositive } = request;
      
      // Get or create context data for this URL
      const contextData = await getContextData(url);
      
      // Update training data
      if (!contextData.training) {
        contextData.training = {
          falsePositives: [],
          truePositives: []
        };
      }
      
      if (isFalsePositive) {
        contextData.training.falsePositives.push({
          timestamp: Date.now(),
          actualContext,
          predictedContext
        });
      } else {
        contextData.training.truePositives.push({
          timestamp: Date.now(),
          actualContext,
          predictedContext
        });
      }
      
      // Save updated context data
      await saveContextData(url, contextData);
      
      // Recalculate context weights based on training data
      await updateContextWeights(url);
      
      sendResponse({ success: true });
    })();
    return true; // Required for async response
  }
  else if (request.type === "STAY_FOCUSED_ACTION") {
    (async () => {
      const { url, context, title } = request.payload;
      try {
        await saveForLater(url, context, title);
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) await goBackOrClose(tab.id);
        sendResponse({ success: true });
      } catch (e: unknown) {
        console.error("Stay‑focused flow failed:", e);
        sendResponse({ 
          success: false, 
          error: e instanceof Error ? e.message : String(e)
        });
      }
    })();
    return true;
  }
  else if (request.type === "FOCUS_STATUS") {
    // Return the current focus state to the popup
    getFocusState()
      .then(focusState => sendResponse(focusState))
      .catch(error => {
        console.error("Error getting focus status:", error);
        sendResponse(null);
      });
    return true; // Required for async response
  }
  
  return false; // No response needed for other messages
});

/**
 * Toggle focus mode on/off
 */
async function toggleFocusMode(enabled: boolean): Promise<void> {
  if (enabled) {
    // Just update badge in the new approach
    updateBadge();
  } else {
    // Ungroup all tabs when focus mode is disabled
    await ungroupAllTabs();
    // Clear badge when focus mode is disabled
    chrome.action.setBadgeText({ text: "" });
  }
}

/**
 * Handle context update with enhanced data
 */
async function handleContextUpdate(
  tabId: number, 
  context: string, 
  contextData?: any
): Promise<void> {
  // Get current settings
  const { autoGroupEnabled = true } = await getStorage([
    "autoGroupEnabled",
  ]);

  // If auto-group is off, do nothing
  if (autoGroupEnabled === false) {
    return;
  }

  // Group tab by context
  await groupTabByContext(tabId, context);
  
  // Update badge when context changes
  updateBadge();
}

/**
 * Updates the badge with current context switch count
 */
async function updateBadge(): Promise<void> {
  try {
    // Update to use the new focusState instead of focusModeEnabled
    const focusState = await getFocusState();
    
    // If focus mode is not active, don't show badge
    if (!focusState.active) {
      chrome.action.setBadgeText({ text: "" });
      return;
    }
    
    // Check if we're showing focus time or context switches
    const focusTimeLeft = await focusEngine.getTimeLeft();
    
    if (focusTimeLeft > 0) {
      // Convert seconds to minutes for badge
      const minutesLeft = Math.ceil(focusTimeLeft / 60);
      chrome.action.setBadgeText({ text: minutesLeft.toString() });
      
      // Get focus status to determine color
      const focusStatus = await checkFocusStatus();
      if (focusStatus.isLostFocus) {
        chrome.action.setBadgeBackgroundColor({ color: "#d32f2f" }); // Red for lost focus
      } else {
        chrome.action.setBadgeBackgroundColor({ color: "#1565c0" }); // Blue for focused
      }
    } else {
      // Show context switch count if no timer active
      const focusStatus = await checkFocusStatus();
      const switchCount = focusStatus.contextSwitches.length;
      
      // Set badge with context switch count
      chrome.action.setBadgeText({ text: switchCount.toString() });
      
      // Change color if focus is lost
      if (focusStatus.isLostFocus) {
        chrome.action.setBadgeBackgroundColor({ color: "#d32f2f" }); // Red for lost focus
      } else {
        chrome.action.setBadgeBackgroundColor({ color: "#1565c0" }); // Blue for focused
      }
    }
  } catch (error) {
    console.error("Error updating badge:", error);
  }
}

/**
 * Send a high-visibility drift warning to the active tab
 */
async function sendDriftWarning(focusStatus: any): Promise<void> {
  try {
    // Always show warnings during focus sessions regardless of notification settings
    // This is critical - users need to be alerted when drifting
    
    // Check if a focus session is active
    const isSessionActive = await focusEngine.isActive();
    if (!isSessionActive) {
      return; // Only show drift warnings during active focus sessions
    }
    
    console.log("[Focus] Sending drift warning to active tab", focusStatus);
    
    // Get the active tab
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs.length || !tabs[0].id) return;

    const activeTab = tabs[0];
    const tabId = activeTab.id as number;
    
    // Skip chrome:// pages and extension pages
    if (
      activeTab.url?.startsWith("chrome://") || 
      activeTab.url?.startsWith("chrome-extension://")
    ) {
      return;
    }
    
    // Create a useful message about why focus was lost
    let message = "YOU'RE DRIFTING FROM YOUR FOCUS TASK!";
    
    // If we have context switches, mention the last switch
    if (focusStatus.contextSwitches.length > 0) {
      const lastSwitch = focusStatus.contextSwitches[focusStatus.contextSwitches.length - 1];
      message = `FOCUS LOST: Switched from ${lastSwitch.from} to ${lastSwitch.to}`;
    }
    
    // Send the warning with callback to check if handled
    chrome.tabs.sendMessage(tabId, {
      type: "DRIFT_WARNING",
      message
    }, (resp) => {
      if (chrome.runtime.lastError || resp === undefined) {
        // Nobody listened - fall back to the blocked page
        chrome.tabs.update(tabId, {url: BLOCKED_PAGE_URL});
      }
    });
      
    // Also show a system notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: 'FOCUS ALERT!',
      message: message,
      priority: 2,
      requireInteraction: true
    });
      
    console.log("[Focus] Drift warning sent successfully");
  } catch (error) {
    console.error("Error sending drift warning:", error);
  }
}

/**
 * Sets up URL blocking based on focus session
 */
function setupFocusSessionUrlBlocking(): void {
  // Listen for tab updates (URL changes)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only check for URL changes
    if (changeInfo.url && tab.url) {
      try {
        // Check if this URL should be blocked
        const shouldBlock = await checkIfUrlShouldBeBlocked(tab.url);
        if (shouldBlock) {
          console.log(`[Focus] Blocking URL: ${tab.url}`);
          
          // Use standard BLOCKED_PAGE_URL for consistency with drift warnings
          chrome.tabs.update(tabId, { url: BLOCKED_PAGE_URL });
        }
      } catch (error) {
        console.error("Error checking URL:", error);
      }
    }
  });
}

/**
 * Check if URL should be blocked according to focus state and context
 */
async function checkIfUrlShouldBeBlocked(url: string): Promise<boolean> {
  // Get the focus state
  const focusState = await getFocusState();
  
  // If focus is not active, nothing is blocked
  if (!focusState.active) {
    return false;
  }
  
  try {
    // Classify the URL's context
    const contextData = await getContextData(url);
    const context = contextData?.context;
    
    if (!context) {
      // If we can't determine the context, don't block
      return false;
    }
    
    // Use focusEngine to check if this context is blocked
    return focusEngine.isBlocked(context);
  } catch (error) {
    console.error("Error classifying URL:", error);
    return false;
  }
}

/**
 * Periodically check if a focus session should be ended
 */
async function checkFocusSessionStatus(): Promise<void> {
  const timeLeft = await focusEngine.getTimeLeft();
  if (timeLeft <= 0) {
    const active = await focusEngine.isActive();
    if (active) {
      // Focus session time is up
      await focusEngine.end();
      console.log("[Focus] Session ended automatically due to timeout");
      
      // Show notification to user
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: 'Focus Session Complete',
        message: `Your timed focus session has ended.`,
      });
    }
  }
}

/**
 * Cleanup in-memory reference on tab removal
 */
onTabRemoved((removedTabId) => {
  delete tabContextMap[removedTabId];
});

// Function to get context data for a URL
async function getContextData(url: string): Promise<any> {
  const result = await chrome.storage.local.get([url]);
  return result[url] || { contexts: [], training: { falsePositives: [], truePositives: [] } };
}

// Function to save context data for a URL
async function saveContextData(url: string, data: any): Promise<void> {
  await chrome.storage.local.set({ [url]: data });
}

// Function to update context weights based on training data
async function updateContextWeights(url: string): Promise<void> {
  const contextData = await getContextData(url);
  const { training } = contextData;
  
  if (!training) return;
  
  // Calculate weights based on false positives and true positives
  const weights: { [key: string]: number } = {};
  
  // Decrease weight for contexts that frequently cause false positives
  training.falsePositives.forEach((fp: any) => {
    weights[fp.predictedContext] = (weights[fp.predictedContext] || 1) * 0.9;
  });
  
  // Increase weight for contexts that are frequently true positives
  training.truePositives.forEach((tp: any) => {
    weights[tp.predictedContext] = (weights[tp.predictedContext] || 1) * 1.1;
  });
  
  // Update context weights
  contextData.weights = weights;
  await saveContextData(url, contextData);
}

// Modify the tabs.onUpdated handler to remove timer-related code
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the tab has completed loading
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // Start a short delay to allow any content scripts to initialize
    setTimeout(() => {
      // Remove timer-related code
      // if (activeTimer && activeTimer.active && activeTimer.endTime > Date.now()) {
      //   // Target just this specific tab
      //   chrome.scripting.executeScript({
      //     target: { tabId },
      //     func: () => {
      //       // Force content script to re-check for timer
      //       chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" });
      //     }
      //   }).catch(err => {
      //     // Ignore errors for restricted pages
      //   });
      //   
      //   // Send the timer state to the newly loaded tab
      //   chrome.tabs.sendMessage(tabId, {
      //     type: 'RESTORE_FOCUS_TIMER',
      //     timerState: activeTimer
      //   }).catch(err => {
      //     console.log('Tab not ready yet, will use script injection instead');
      //     // Use script injection as fallback
      //     ensureTimerVisibility();
      //   });
      // }
    }, 500);
  }
});

// Set default settings on installation/update
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === "install") {
    // First-time install: set defaults
    chrome.storage.local.set({
      extensionEnabled: true,
      autoGroupEnabled: true, // Set auto grouping enabled by default
      focusState: {
        active: false,
        allowedContexts: []
      },
      firstRunComplete: false
    });
    
    // Show onboarding page
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  } else if (details.reason === "update") {
    // Handle migration from old storage format to new
    chrome.storage.local.get([
      "autoGroupEnabled", // Check for this setting
      "focusSessionActive", 
      "focusSessionEndTime",
      "blockedCategories",
      "focusState"
    ], result => {
      // Always set extension to enabled
      const update: Record<string, any> = {
        extensionEnabled: true
      };
      
      // Migration: If we have old format data but no new focusState yet, convert it
      if (!result.focusState && (result.focusSessionActive || result.blockedCategories)) {
        console.log("Migrating from old focus session format to new focusState format");
        
        // Convert to new FocusState format (invert the block logic to allowedContexts)
        const knownContexts = [
          "Work", "Development", "Research", "Learning", 
          "Entertainment", "Social", "Shopping", "News"
        ];
        
        // Calculate allowed contexts by excluding blocked ones
        const blockedCategories = result.blockedCategories || [];
        const allowedContexts = knownContexts.filter(ctx => !blockedCategories.includes(ctx));
        
        update.focusState = {
          active: result.focusSessionActive === true,
          allowedContexts,
          endTime: result.focusSessionEndTime || undefined
        };
        
        // Remove old keys after migration
        chrome.storage.local.remove([
          "focusSessionActive", 
          "focusSessionEndTime", 
          "blockedCategories"
        ]);
      }
      
      // Ensure we have explicit boolean values, not undefined  
      if (result.autoGroupEnabled === undefined) update.autoGroupEnabled = true;
      
      // Apply all updates
      chrome.storage.local.set(update);
    });
  }
});

// Kick off on load
initExtension().catch(console.error);