/**
 * Focus Engine - Core logic for the Focus feature
 * 
 * This module implements the state machine for focus mode, following the principle
 * of "block by exclusion" - where user picks ALLOWED contexts and everything else is blocked.
 */

import { getFocusState, setFocusState } from "../api/storageApi";
import { FocusState } from "../types/index";

// State for tracking if a navigation was blocked recently (for badge alert)
let recentlyBlocked = false;
let blockClearTimer: NodeJS.Timeout | undefined;
let endTimeCheckInterval: NodeJS.Timeout | undefined;

/**
 * Start a focus session
 * 
 * @param allowed - Array of context categories that are allowed during focus
 * @param durationMin - Optional duration in minutes after which focus will automatically end
 */
export async function start(allowed: string[], durationMin?: number): Promise<void> {
  // Calculate end time if duration is provided
  const endTime = durationMin ? Date.now() + durationMin * 60 * 1000 : undefined;
  
  // Save focus state
  await setFocusState({
    active: true,
    allowedContexts: allowed,
    endTime
  });
  
  // Set badge to show focus is active
  chrome.action.setBadgeText({ text: "•" });
  chrome.action.setBadgeBackgroundColor({ color: "#1565c0" }); // Blue
  
  // Setup interval to check for timer expiration
  if (endTime) {
    if (endTimeCheckInterval) {
      clearInterval(endTimeCheckInterval);
    }
    
    endTimeCheckInterval = setInterval(async () => {
      const focusState = await getFocusState();
      
      if (focusState.active && focusState.endTime && focusState.endTime <= Date.now()) {
        // Timer expired, end focus session
        console.log("Focus timer expired automatically");
        end();
        
        // Show a notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: 'Focus Session Ended',
          message: 'Your focus session has ended. Great job!',
          priority: 2
        });
      }
    }, 15000); // Check every 15 seconds
  }
}

/**
 * End a focus session
 */
export async function end(): Promise<void> {
  // Clear focus state
  await setFocusState({
    active: false,
    endTime: undefined
  });
  
  // Clear badge
  chrome.action.setBadgeText({ text: "" });
  
  // Clear timer interval
  if (endTimeCheckInterval) {
    clearInterval(endTimeCheckInterval);
    endTimeCheckInterval = undefined;
  }
  
  // Reset block indicator
  recentlyBlocked = false;
  if (blockClearTimer) {
    clearTimeout(blockClearTimer);
    blockClearTimer = undefined;
  }
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
 * Get the time left in the current focus session in minutes
 * 
 * @returns Minutes left in the focus session, or 0 if no session or no timer
 */
export async function getTimeLeft(): Promise<number> {
  const focusState = await getFocusState();
  
  if (!focusState.active || !focusState.endTime) {
    return 0;
  }
  
  const timeLeftMs = Math.max(0, focusState.endTime - Date.now());
  return Math.floor(timeLeftMs / 60000); // Convert to minutes
} 