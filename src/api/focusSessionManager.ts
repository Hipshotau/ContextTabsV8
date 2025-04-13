import { getStorage, setStorage, getFocusState, setFocusState } from "./storageApi";
import { StorageData } from "../types/index";
import { groupTabByContext, ungroupAllTabs } from "./tabsApi";
import { classifyPageContext } from "../lib/contextEngine";
import { extractDomain } from "../lib/contextEngine/urlAnalyzer";
import { launchFocusWindow, closeFocusWindow } from "../lib/windows/focusWindow";
import { openSidePanel, closeSidePanel } from "../lib/panels/sidePanelManager";
import { releaseParkedLinks } from "./parkedLinksApi";

// Set up periodic badge updates
let badgeUpdateInterval: number | undefined;

/**
 * Start a Focus Session with a specified duration (minutes) and a set of blocked categories.
 * Activates all visual, auditory, and spatial cues for maximum ADHD-friendly feedback.
 */
export async function startFocusSession(durationMinutes: number, blockedCategories: string[]): Promise<void> {
  const now = Date.now();
  const endTime = now + durationMinutes * 60_000;

  // Convert blockedCategories to allowedContexts by excluding them from all known contexts
  const knownContexts = [
    "Work", "Development", "Research", "Learning", 
    "Entertainment", "Social", "Shopping", "News"
  ];
  const allowedContexts = knownContexts.filter(ctx => !blockedCategories.includes(ctx));

  // Mark focus session as active using the new focusState object
  await setFocusState({
    active: true,
    allowedContexts,
    endTime
  });

  // Also store blockedCategories for backward compatibility with UI
  await setStorage({ blockedCategories });

  // Open the side panel for persistent timer display
  await openSidePanel();

  // Update the badge and icon to indicate focus mode
  updateBadge(durationMinutes, false);
  
  // Optionally launch a dedicated focus window
  const storage = await getStorage(["focusSettings"]);
  const focusWindowEnabled = storage.focusSettings?.focusWindowEnabled || false;
  if (focusWindowEnabled) {
    await launchFocusWindow();
  }

  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: 'Focus Session Started',
    message: `Focus session started for ${durationMinutes} minutes. Stay focused!`,
  });
}

/**
 * End the current Focus Session.
 * Optionally save the workspace (tab groups) if user requests.
 */
export async function endFocusSession(saveWorkspace: boolean, workspaceName: string = ""): Promise<void> {
  // If user wants to save workspace, store it
  if (saveWorkspace && workspaceName) {
    await saveCurrentWorkspace(workspaceName);
  }

  // Clear focus state using the new API
  await setFocusState({
    active: false,
    endTime: undefined
  });
  
  // Close the side panel
  await closeSidePanel();
  
  // Ungroup all tabs
  await ungroupAllTabs();
  
  // Clear badge and restore icon
  chrome.action.setBadgeText({ text: "" });
  chrome.action.setIcon({ path: chrome.runtime.getURL('icons/icon48.png') });
  
  // Close focus window if it exists
  await closeFocusWindow();
  
  // Show end notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: 'Focus Session Ended',
    message: `Great job! Your focus session has ended.`,
  });
  
  // Release any links that were parked during the session
  await releaseParkedLinks();
}

/**
 * Updates the badge text and color based on session state
 */
function updateBadge(timeLeftMin: number, drifting: boolean) {
  chrome.action.setBadgeBackgroundColor({
    color: drifting ? "#d32f2f" : "#1565c0"  // red if drifting, blue otherwise
  });
  
  chrome.action.setBadgeText({
    text: timeLeftMin > 0 ? Math.ceil(timeLeftMin).toString() : ""
  });
  
  chrome.action.setIcon({
    path: drifting ? 
      chrome.runtime.getURL('icons/icon48.png') : // Would be focus_drift.png if it existed
      chrome.runtime.getURL('icons/icon48.png')   // Would be focus_on.png if it existed
  });
}

/**
 * Check if the user is currently drifting from focus
 */
async function checkIfDrifting(): Promise<boolean> {
  const { focusSettings } = await getStorage(["focusSettings"]);
  if (!focusSettings) return false;
  
  // For now, we'll just use a simple check based on the existing focus API
  const response = await chrome.runtime.sendMessage({ type: "CHECK_FOCUS_STATUS" });
  return response?.isLostFocus || false;
}

/**
 * Check if a focus session is currently active
 */
export async function isFocusSessionActive(): Promise<boolean> {
  const focusState = await getFocusState();
  return focusState.active;
}

/**
 * Returns how many seconds remain in the current focus session (if any)
 */
export async function getFocusSessionTimeLeft(): Promise<number> {
  const focusState = await getFocusState();
  if (!focusState.active || !focusState.endTime) return 0;

  const now = Date.now();
  const diff = focusState.endTime - now;
  return diff > 0 ? diff / 1000 : 0;   // Return seconds, not minutes
}

/**
 * Determine if this URL is blocked under the current Focus Session settings.
 */
export async function isUrlBlocked(url: string, detectedCategory: string): Promise<boolean> {
  const focusState = await getFocusState();

  // If session not active, not blocked
  if (!focusState.active) {
    return false;
  }

  // If the context is not in allowed contexts, block it
  if (detectedCategory && !focusState.allowedContexts.includes(detectedCategory)) {
    return true;
  }

  return false;
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
 * Clean up old workspace entries if needed, or remove a workspace by name, etc.
 */
export async function removeWorkspace(name: string): Promise<void> {
  const { savedWorkspaces } = await getStorage(["savedWorkspaces"]);
  if (!savedWorkspaces) return;

  const updatedWorkspaces = savedWorkspaces.filter(ws => ws.name !== name);
  await setStorage({ savedWorkspaces: updatedWorkspaces });
} 