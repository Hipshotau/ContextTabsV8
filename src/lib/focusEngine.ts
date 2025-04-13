/**
 * Focus Engine - Core logic for the Focus feature
 * 
 * This module implements the state machine for focus mode, following the principle
 * of "block by exclusion" - where user picks ALLOWED contexts and everything else is blocked.
 */

import { getFocusState, setFocusState, getStorage, setStorage } from "../api/storageApi";
import { FocusState } from "../types/index";
import { openSidePanel, closeSidePanel } from "../lib/panels/sidePanelManager";
import { launchFocusWindow, closeFocusWindow } from "../lib/windows/focusWindow";
import { releaseParkedLinks } from "../api/parkedLinksApi";
import { ungroupAllTabs } from "../api/tabsApi";

// State for tracking if a navigation was blocked recently (for badge alert)
let recentlyBlocked = false;
let blockClearTimer: NodeJS.Timeout | undefined;

/**
 * Start a focus session
 * 
 * @param allowed - Array of context categories that are allowed during focus
 * @param durationMin - Optional duration in minutes after which focus will automatically end
 */
export async function start(allowed: string[], durationMin?: number): Promise<void> {
  // Safety check for allowed contexts
  const safeAllowed = Array.isArray(allowed) ? allowed : [];
  
  // Calculate end time if duration is provided
  const endTime = durationMin ? Date.now() + durationMin * 60 * 1000 : undefined;
  
  // Save focus state
  await setFocusState({
    active: true,
    allowedContexts: safeAllowed,
    endTime
  });
  
  // Store blockedCategories for backward compatibility
  const knownContexts = [
    "Work", "Development", "Research", "Learning", 
    "Entertainment", "Social", "Shopping", "News"
  ];
  const blockedCategories = knownContexts.filter(ctx => !safeAllowed.includes(ctx));
  await setStorage({ blockedCategories });
  
  // Open the side panel for persistent timer display
  await openSidePanel();
  
  // Check if focus window is enabled and launch if needed
  const storage = await getStorage(["focusSettings"]);
  const focusWindowEnabled = storage.focusSettings?.focusWindowEnabled || false;
  if (focusWindowEnabled) {
    await launchFocusWindow();
  }
  
  // Set badge to show focus is active
  chrome.action.setBadgeText({ text: "•" });
  chrome.action.setBadgeBackgroundColor({ color: "#1565c0" }); // Blue
  
  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: 'Focus Session Started',
    message: durationMin ? 
      `Focus session started for ${durationMin} minutes. Stay focused!` :
      'Focus session started. Stay focused!',
    priority: 2
  });
}

/**
 * End a focus session
 * @param saveWorkspaceName - Optional workspace name to save current tab groups
 */
export async function end(saveWorkspaceName?: string): Promise<void> {
  // If user wants to save workspace, store it
  if (saveWorkspaceName) {
    try {
      // Get all tab groups
      const groups = await chrome.tabGroups.query({});
      // For each group, gather tab URLs
      const workspaceGroups = await Promise.all(
        groups.map(async (grp) => {
          const tabs = await chrome.tabs.query({ groupId: grp.id });
          return {
            groupId: grp.id,
            title: grp.title || "",
            color: grp.color,
            tabUrls: tabs.map(t => t.url || "")
          };
        })
      );

      // Store in savedWorkspaces
      const { savedWorkspaces } = await getStorage(["savedWorkspaces"]);
      const newWorkspaceEntry = {
        name: saveWorkspaceName,
        tabGroups: workspaceGroups,
        timestamp: Date.now()
      };

      const updatedWorkspaces = Array.isArray(savedWorkspaces) 
        ? [...savedWorkspaces, newWorkspaceEntry]
        : [newWorkspaceEntry];

      await setStorage({ savedWorkspaces: updatedWorkspaces });
    } catch (error) {
      console.error("Error saving workspace:", error);
    }
  }
  
  // Clear focus state
  await setFocusState({
    active: false,
    endTime: undefined
  });
  
  // Close UI components
  await closeSidePanel();
  await closeFocusWindow();
  await ungroupAllTabs();
  
  // Clear badge
  chrome.action.setBadgeText({ text: "" });
  
  // Reset block indicator
  recentlyBlocked = false;
  if (blockClearTimer) {
    clearTimeout(blockClearTimer);
    blockClearTimer = undefined;
  }
  
  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: 'Focus Session Ended',
    message: 'Your focus session has ended. Great job!',
    priority: 2
  });
  
  // Release any links that were parked during the session
  await releaseParkedLinks();
}

/**
 * Check if a context should be blocked
 * 
 * @param context - The context category to check
 * @returns true if the context should be blocked, false otherwise
 */
export async function isBlocked(context: string): Promise<boolean> {
  const focusState = await getFocusState();
  
  // If focus is not active, nothing is blocked
  if (!focusState.active) {
    return false;
  }
  
  // Safety check: ensure allowedContexts is an array before using includes
  if (!Array.isArray(focusState.allowedContexts)) {
    console.error("[FocusEngine] allowedContexts is not an array:", focusState.allowedContexts);
    return false; // Fail open rather than blocking everything
  }
  
  // Add logging to help debug
  console.log("[FocusEngine] allowed:", focusState.allowedContexts, "context:", context);
  
  // If context is in allowed list, it's not blocked
  if (focusState.allowedContexts.includes(context)) {
    return false;
  }
  
  // Context is not in allowed list, so it's blocked
  // Update the "recently blocked" state for badge
  recentlyBlocked = true;
  
  // Show red "!" badge
  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#d32f2f" }); // Red
  
  // Clear the blocked indicator after 30 seconds
  if (blockClearTimer) {
    clearTimeout(blockClearTimer);
  }
  
  blockClearTimer = setTimeout(() => {
    if (recentlyBlocked) {
      recentlyBlocked = false;
      // Restore the normal focus badge
      chrome.action.setBadgeText({ text: "•" });
      chrome.action.setBadgeBackgroundColor({ color: "#1565c0" }); // Blue
    }
  }, 30000);
  
  return true;
}

/**
 * Check if a focus session is currently active
 * 
 * @returns true if a focus session is active, false otherwise
 */
export async function isActive(): Promise<boolean> {
  const focusState = await getFocusState();
  return focusState.active;
}

/**
 * Get the time left in the current focus session in seconds
 * 
 * @returns Seconds left in the focus session, or -1 if no timer (unlimited session)
 */
export async function getTimeLeft(): Promise<number> {
  const { active, endTime } = await getFocusState();
  if (!active) return 0; // Not active, no time
  if (!endTime) return -1; // -1 = unlimited/indefinite session
  return Math.max(0, endTime - Date.now()) / 1000; // seconds
}

/**
 * Restore a saved workspace by name. 
 * Re-open tabs and re-create groups (approximation).
 */
export async function restoreWorkspace(name: string): Promise<void> {
  const { savedWorkspaces } = await getStorage(["savedWorkspaces"]);
  if (!savedWorkspaces) return;

  const workspace = savedWorkspaces.find(ws => ws.name === name);
  if (!workspace) return;

  // For each group, re-create tabs
  for (const grp of workspace.tabGroups) {
    // Open each tab
    const tabIds = [];
    for (const url of grp.tabUrls) {
      const createdTab = await chrome.tabs.create({ url, active: false });
      tabIds.push(createdTab.id as number);
    }
    // Create or update tab group
    if (tabIds.length > 0) {
      const newGroupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(newGroupId, {
        title: grp.title || "",
        color: grp.color
      });
    }
  }
}

/**
 * Save current window's tab groups (workspace).
 * This can be called at the end of a Focus Session or on demand.
 */
export async function saveCurrentWorkspace(name: string): Promise<void> {
  // Get all tab groups
  const groups = await chrome.tabGroups.query({});
  // For each group, gather tab URLs
  const workspaceGroups = await Promise.all(
    groups.map(async (grp) => {
      const tabs = await chrome.tabs.query({ groupId: grp.id });
      return {
        groupId: grp.id,
        title: grp.title || "",
        color: grp.color,
        tabUrls: tabs.map(t => t.url || "")
      };
    })
  );

  // Store in savedWorkspaces
  const { savedWorkspaces } = await getStorage(["savedWorkspaces"]);
  const newWorkspaceEntry = {
    name,
    tabGroups: workspaceGroups,
    timestamp: Date.now()
  };

  const updatedWorkspaces = Array.isArray(savedWorkspaces) 
    ? [...savedWorkspaces, newWorkspaceEntry]
    : [newWorkspaceEntry];

  await setStorage({ savedWorkspaces: updatedWorkspaces });
}

/**
 * Clean up old workspace entries if needed, or remove a workspace by name, etc.
 */
export async function removeWorkspace(name: string): Promise<void> {
  const { savedWorkspaces } = await getStorage(["savedWorkspaces"]);
  if (!savedWorkspaces) return;

  const updatedWorkspaces = savedWorkspaces.filter(ws => ws.name !== name);
  await setStorage({ savedWorkspaces: updatedWorkspaces });
} 