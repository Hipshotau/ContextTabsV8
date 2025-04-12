import { getStorage, setStorage } from "./storageApi";
import { FocusStatus, FocusSettings, ContextSwitch } from "../types/index";

const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  enabled: true,
  notificationsEnabled: true,
  switchThreshold: 5,
  timeWindowMinutes: 15
};

/**
 * Get the current focus settings
 */
export async function getFocusSettings(): Promise<FocusSettings> {
  const { focusSettings } = await getStorage(["focusSettings"]);
  return { ...DEFAULT_FOCUS_SETTINGS, ...focusSettings };
}

/**
 * Update focus settings
 */
export async function updateFocusSettings(settings: Partial<FocusSettings>): Promise<void> {
  const currentSettings = await getFocusSettings();
  await setStorage({ 
    focusSettings: { ...currentSettings, ...settings } 
  });
}

/**
 * Get context switches in a time window
 */
export async function getContextSwitches(timeWindowMinutes: number = 15): Promise<ContextSwitch[]> {
  const { contextHistory } = await getStorage(["contextHistory"]);
  if (!contextHistory || contextHistory.length < 2) {
    return [];
  }
  
  const switches: ContextSwitch[] = [];
  const now = Date.now();
  const timeWindow = timeWindowMinutes * 60 * 1000;
  
  // Filter history to time window
  const relevantHistory = contextHistory.filter(
    entry => (now - entry.timestamp) < timeWindow
  );
  
  // Find context switches
  for (let i = 1; i < relevantHistory.length; i++) {
    if (relevantHistory[i].context !== relevantHistory[i-1].context) {
      switches.push({
        from: relevantHistory[i-1].context,
        to: relevantHistory[i].context,
        timestamp: relevantHistory[i].timestamp,
        fromUrl: relevantHistory[i-1].url,
        toUrl: relevantHistory[i].url
      });
    }
  }
  
  return switches;
}

/**
 * Check if focus is lost based on context switching
 */
export async function checkFocusStatus(): Promise<FocusStatus> {
  const settings = await getFocusSettings();
  const switches = await getContextSwitches(settings.timeWindowMinutes);
  
  let currentContext = "Unknown";
  let currentStreak = 1;
  
  // Get most recent context and streak
  const { contextHistory } = await getStorage(["contextHistory"]);
  if (contextHistory && contextHistory.length > 0) {
    currentContext = contextHistory[contextHistory.length - 1].context;
    
    // Count consecutive entries with same context
    let i = contextHistory.length - 1;
    while (i > 0 && contextHistory[i].context === currentContext) {
      currentStreak++;
      i--;
    }
  }
  
  // Determine if focus is lost
  const isLostFocus = switches.length >= settings.switchThreshold;
  
  return {
    isLostFocus,
    contextSwitches: switches,
    currentStreak,
    currentContext
  };
}

/**
 * Show focus notification
 */
export function showFocusNotification(contextSwitches: ContextSwitch[]): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: 'Focus Alert',
    message: `You've switched contexts ${contextSwitches.length} times recently. Try to maintain focus.`,
    buttons: [
      { title: 'View Details' }
    ]
  });
}