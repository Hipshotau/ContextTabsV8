import { getStorage, setStorage } from "./storageApi";
import { ParkedLink } from "../types/index";

/**
 * Save a link for later viewing
 */
export async function saveForLater(url: string, context: string, title?: string): Promise<void> {
  const { parkedLinks = [] } = await getStorage(["parkedLinks"]);
  
  // Check if the URL is already parked to avoid duplicates
  const isDuplicate = parkedLinks.some(link => link.url === url);
  
  if (!isDuplicate) {
    const newLink: ParkedLink = {
      url,
      title,
      context,
      timestamp: Date.now()
    };
    
    await setStorage({
      parkedLinks: [...parkedLinks, newLink]
    });
  }
}

/**
 * Get all parked links
 */
export async function getParkedLinks(): Promise<ParkedLink[]> {
  const { parkedLinks = [] } = await getStorage(["parkedLinks"]);
  return parkedLinks;
}

/**
 * Open all parked links in new tabs and clear the list
 */
export async function releaseParkedLinks(): Promise<void> {
  const parkedLinks = await getParkedLinks();
  
  if (parkedLinks.length === 0) {
    return;
  }
  
  // Create a new tab group for the parked links
  const currentWindow = await chrome.windows.getCurrent();
  let groupId: number | undefined;
  
  try {
    // Open all the links in new tabs
    const openedTabIds: number[] = [];
    
    for (const link of parkedLinks) {
      const tab = await chrome.tabs.create({
        url: link.url,
        active: false
      });
      
      if (tab.id) {
        openedTabIds.push(tab.id);
      }
    }
    
    // Group the tabs if we have any
    if (openedTabIds.length > 0) {
      try {
        groupId = await chrome.tabs.group({
          tabIds: openedTabIds
        });
        
        if (groupId) {
          await chrome.tabGroups.update(groupId, {
            title: "Parked Links",
            color: "blue"
          });
        }
      } catch (groupError) {
        console.error("Error creating tab group:", groupError);
      }
    }
    
    // Clear the parked links list
    await setStorage({ parkedLinks: [] });
    
    // Show a notification
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon48.png"),
      title: "Parked Links Opened",
      message: `Opened ${parkedLinks.length} links that were saved during your focus session.`
    });
  } catch (error) {
    console.error("Error opening parked links:", error);
  }
}

/**
 * More robust function to navigate back or close the current tab
 */
export async function goBackOrClose(tabId: number): Promise<void> {
  try {
    // Get tab info first to confirm it exists
    const tab = await chrome.tabs.get(tabId);
    
    // First try to determine if we can go back using script injection
    try {
      const historyResults = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          canGoBack: window.history.length > 1,
          url: window.location.href
        })
      });
      
      const { canGoBack } = historyResults[0].result;
      
      if (canGoBack) {
        // Navigate back if possible using script injection
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.history.back()
        });
        
        // Success, we're done
        return;
      }
      
      // Can't go back, use fallback approach
      await handleNavigationFallback(tabId, tab);
    } catch (err) {
      console.error("Script execution error:", err);
      
      // Fallback to simpler chrome.tabs.goBack API
      try {
        await chrome.tabs.goBack(tabId);
      } catch (backError) {
        // If that fails too, use final fallback
        await handleNavigationFallback(tabId, tab);
      }
    }
  } catch (err) {
    console.error("Tab lookup error:", err);
    // Tab might no longer exist, nothing to do
  }
}

/**
 * Fallback navigation handler when going back isn't possible
 */
async function handleNavigationFallback(tabId: number, tab: chrome.tabs.Tab): Promise<void> {
  try {
    // Get all tabs in the window
    const allTabs = await chrome.tabs.query({ windowId: tab.windowId });
    
    if (allTabs.length > 1) {
      // More than one tab, find one to focus
      const currentIndex = allTabs.findIndex(t => t.id === tabId);
      const targetIndex = currentIndex > 0 ? currentIndex - 1 : (currentIndex + 1) % allTabs.length;
      const targetTab = allTabs[targetIndex];
      
      // Focus the other tab first
      if (targetTab.id) {
        await chrome.tabs.update(targetTab.id, { active: true });
        
        // Then remove the current tab
        setTimeout(() => {
          chrome.tabs.remove(tabId).catch(e => {
            console.error("Tab removal failed:", e);
          });
        }, 100);
      }
    } else {
      // Last tab, navigate to blank page instead
      await chrome.tabs.update(tabId, { url: "about:blank" });
    }
  } catch (e) {
    console.error("Navigation fallback failed:", e);
    // Last resort - try basic navigation
    try {
      await chrome.tabs.update(tabId, { url: "about:blank" });
    } catch (finalError) {
      console.error("Final fallback failed:", finalError);
    }
  }
}

/**
 * Show a toast notification in the current tab
 */
export async function showToast(tabId: number, message: string, duration = 3000): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg: string, dur: number) => {
        const toast = document.createElement("div");
        toast.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background-color: rgba(0, 102, 204, 0.9);
          color: white;
          padding: 12px 20px;
          border-radius: 4px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          font-family: Arial, sans-serif;
          z-index: 2147483647;
          max-width: 300px;
          transition: opacity 0.3s ease-in-out;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        
        // Fade out and remove
        setTimeout(() => {
          toast.style.opacity = "0";
          setTimeout(() => toast.remove(), 300);
        }, dur - 300);
      },
      args: [message, duration]
    });
  } catch (error) {
    console.error("Error showing toast:", error);
  }
}

/**
 * Clear all parked links without opening them
 */
export async function clearParkedLinks(): Promise<void> {
  await setStorage({ parkedLinks: [] });
} 