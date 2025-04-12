let focusWindowId: number | undefined;

/**
 * Create a dedicated window for the focus session
 * This creates a new window that can be populated with productive tabs
 */
export async function launchFocusWindow(): Promise<number | undefined> {
  try {
    // Check if focus window already exists
    if (focusWindowId !== undefined) {
      try {
        // Try to get window to verify it still exists
        await chrome.windows.get(focusWindowId);
        return focusWindowId; // Window already exists
      } catch (error) {
        // Window doesn't exist anymore, reset the ID
        focusWindowId = undefined;
      }
    }

    // Create a new window
    const { id } = await chrome.windows.create({
      url: "about:blank",
      type: "normal",
      state: "maximized"
    });
    
    focusWindowId = id;
    
    // Create a welcoming tab
    if (id) {
      const tabs = await chrome.tabs.query({ windowId: id });
      
      // If there's at least one tab (the default about:blank), update it
      if (tabs.length > 0 && tabs[0].id) {
        await chrome.tabs.update(tabs[0].id, { 
          url: chrome.runtime.getURL("blocked.html") + "?mode=welcome" 
        });
      }
    }
    
    return focusWindowId;
  } catch (error) {
    console.error("Error launching focus window:", error);
    return undefined;
  }
}

/**
 * Close the dedicated focus window
 */
export async function closeFocusWindow(): Promise<void> {
  if (focusWindowId === undefined) return;
  
  try {
    await chrome.windows.remove(focusWindowId);
    focusWindowId = undefined;
  } catch (error) {
    console.error("Error closing focus window:", error);
    // Reset the ID even if there was an error
    focusWindowId = undefined;
  }
}

/**
 * Check if the focus window is active
 */
export function getFocusWindowId(): number | undefined {
  return focusWindowId;
}

/**
 * Move a tab to the focus window
 */
export async function moveTabToFocusWindow(tabId: number): Promise<boolean> {
  if (focusWindowId === undefined) {
    const windowId = await launchFocusWindow();
    if (windowId === undefined) return false;
  }
  
  try {
    await chrome.tabs.move(tabId, { windowId: focusWindowId!, index: -1 });
    return true;
  } catch (error) {
    console.error("Error moving tab to focus window:", error);
    return false;
  }
} 