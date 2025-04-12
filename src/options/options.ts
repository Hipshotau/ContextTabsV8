import { getStorage, setStorage } from "../api/storageApi";
import { FocusSettings } from "../types/index";
import { getParkedLinks, releaseParkedLinks, clearParkedLinks } from "../api/parkedLinksApi";

// DOM Elements
const extensionEnabledCheckbox = document.getElementById("extensionEnabledCheckbox") as HTMLInputElement;
const notificationsCheckbox = document.getElementById("notificationsCheckbox") as HTMLInputElement;
const switchThresholdInput = document.getElementById("switchThresholdInput") as HTMLInputElement;
const timeWindowInput = document.getElementById("timeWindowInput") as HTMLInputElement;
const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
const resetBtn = document.getElementById("resetBtn") as HTMLButtonElement;
const subUrlOverridesList = document.getElementById("subUrlOverridesList") as HTMLDivElement;
const overrideUrlInput = document.getElementById("overrideUrlInput") as HTMLInputElement;
const overrideContextSelect = document.getElementById("overrideContextSelect") as HTMLSelectElement;
const addOverrideBtn = document.getElementById("addOverrideBtn") as HTMLButtonElement;

// Parked Links UI Elements
const parkedLinksList = document.getElementById("parkedLinksList") as HTMLDivElement;
const releaseParkedBtn = document.getElementById("releaseParkedBtn") as HTMLButtonElement;
const clearParkedBtn = document.getElementById("clearParkedBtn") as HTMLButtonElement;

// Default focus settings
const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  enabled: true,
  notificationsEnabled: true,
  switchThreshold: 3,
  timeWindowMinutes: 30
};

// Initialize UI
document.addEventListener("DOMContentLoaded", initializeOptions);

async function initializeOptions() {
  const storage = await getStorage([
    "extensionEnabled", 
    "focusSettings",
    "subUrlOverrides",
    "parkedLinks"
  ]);
  
  // Extension enabled/disabled
  extensionEnabledCheckbox.checked = storage.extensionEnabled ?? true;
  
  // Focus Settings
  const focusSettings = storage.focusSettings || DEFAULT_FOCUS_SETTINGS;
  notificationsCheckbox.checked = focusSettings.notificationsEnabled ?? true;
  switchThresholdInput.value = focusSettings.switchThreshold?.toString() || "3";
  timeWindowInput.value = focusSettings.timeWindowMinutes?.toString() || "30";
  
  // Add event listeners
  saveBtn.addEventListener("click", saveOptions);
  resetBtn.addEventListener("click", resetOptions);
  
  // Load URL overrides
  displayUrlOverrides(storage.subUrlOverrides || {});
  addOverrideBtn.addEventListener("click", addNewOverride);
  
  // Load parked links
  await displayParkedLinks(storage.parkedLinks || []);
  
  // Setup parked links actions
  if (releaseParkedBtn) {
    releaseParkedBtn.addEventListener("click", handleReleaseParkedLinks);
  }
  
  if (clearParkedBtn) {
    clearParkedBtn.addEventListener("click", handleClearParkedLinks);
  }
}

function getDefaultFocusSettings(): FocusSettings {
  return {
    enabled: true,
    notificationsEnabled: true,
    switchThreshold: 3,
    timeWindowMinutes: 30
  };
}

async function saveOptions() {
  const focusSettings: FocusSettings = {
    enabled: true,
    notificationsEnabled: notificationsCheckbox.checked,
    switchThreshold: parseInt(switchThresholdInput.value) || 3,
    timeWindowMinutes: parseInt(timeWindowInput.value) || 30
  };
  
  // Collect URL Overrides from UI
  const subUrlOverrides: Record<string, string> = {};
  const overrideItems = subUrlOverridesList.querySelectorAll(".override-item");
  overrideItems.forEach(item => {
    const urlSpan = item.querySelector(".override-url") as HTMLSpanElement;
    const contextSpan = item.querySelector(".override-context") as HTMLSpanElement;
    if (urlSpan && contextSpan) {
      subUrlOverrides[urlSpan.textContent || ""] = contextSpan.textContent || "";
    }
  });
  
  // Update storage with new settings
  await setStorage({
    extensionEnabled: extensionEnabledCheckbox.checked,
    focusSettings,
    subUrlOverrides
  });
  
  // Show success notification
  showNotification("Options saved!");
}

function showNotification(message: string, duration = 2000) {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.bottom = "20px";
  notification.style.right = "20px";
  notification.style.backgroundColor = "#4CAF50";
  notification.style.color = "white";
  notification.style.padding = "10px 20px";
  notification.style.borderRadius = "4px";
  notification.style.zIndex = "1000";
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, duration);
}

async function resetOptions() {
  // Reset UI to defaults
  extensionEnabledCheckbox.checked = true;
  const defaultSettings = getDefaultFocusSettings();
  notificationsCheckbox.checked = defaultSettings.notificationsEnabled;
  switchThresholdInput.value = defaultSettings.switchThreshold.toString();
  timeWindowInput.value = defaultSettings.timeWindowMinutes.toString();
  
  // Clear URL overrides
  subUrlOverridesList.innerHTML = '';
  
  // Save defaults
  await setStorage({
    extensionEnabled: true,
    focusSettings: defaultSettings,
    subUrlOverrides: {}
  });
  
  showNotification("Options reset to defaults");
}

// URL Overrides UI Functions
function displayUrlOverrides(overrides: Record<string, string>) {
  subUrlOverridesList.innerHTML = '';
  
  if (Object.keys(overrides).length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'empty-state';
    emptyMsg.textContent = 'No URL overrides configured yet.';
    subUrlOverridesList.appendChild(emptyMsg);
    return;
  }
  
  Object.entries(overrides).forEach(([url, context]) => {
    addOverrideItem(url, context);
  });
}

function addNewOverride() {
  const url = overrideUrlInput.value.trim();
  const context = overrideContextSelect.value;
  
  if (!url) {
    showNotification("Please enter a URL", 3000);
    return;
  }
  
  addOverrideItem(url, context);
  overrideUrlInput.value = '';
}

function addOverrideItem(url: string, context: string) {
  const item = document.createElement('div');
  item.className = 'override-item';
  
  const urlSpan = document.createElement('span');
  urlSpan.className = 'override-url';
  urlSpan.textContent = url;
  
  const contextSpan = document.createElement('span');
  contextSpan.className = 'override-context';
  contextSpan.textContent = context;
  
  const deleteButton = document.createElement('button');
  deleteButton.innerHTML = '&times;';
  deleteButton.className = 'link-remove';
  deleteButton.addEventListener('click', () => {
    item.remove();
  });
  
  item.appendChild(urlSpan);
  item.appendChild(contextSpan);
  item.appendChild(deleteButton);
  
  subUrlOverridesList.appendChild(item);
}

// Parked Links UI Functions
async function displayParkedLinks(parkedLinks: Array<{url: string, title?: string, timestamp: number}>) {
  if (!parkedLinksList) return;
  
  parkedLinksList.innerHTML = '';
  
  if (!parkedLinks || parkedLinks.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'empty-state';
    emptyMsg.textContent = 'No links have been parked yet.';
    parkedLinksList.appendChild(emptyMsg);
    return;
  }
  
  parkedLinks.forEach(link => {
    const linkItem = document.createElement('div');
    linkItem.className = 'parked-link-item';
    
    const linkInfo = document.createElement('div');
    
    const title = document.createElement('div');
    title.className = 'link-title';
    title.textContent = link.title || 'Untitled';
    
    const url = document.createElement('div');
    url.className = 'link-url';
    url.textContent = link.url;
    
    linkInfo.appendChild(title);
    linkInfo.appendChild(url);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'link-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', async () => {
      await removeParkedLink(link.url);
      linkItem.remove();
      
      // If this was the last item, show empty state
      if (parkedLinksList.children.length === 0) {
        await displayParkedLinks([]);
      }
    });
    
    linkItem.appendChild(linkInfo);
    linkItem.appendChild(removeBtn);
    
    parkedLinksList.appendChild(linkItem);
  });
}

async function removeParkedLink(url: string) {
  const { parkedLinks } = await getStorage(['parkedLinks']);
  
  if (parkedLinks) {
    const updatedLinks = parkedLinks.filter(link => link.url !== url);
    await setStorage({ parkedLinks: updatedLinks });
  }
}

async function handleReleaseParkedLinks() {
  try {
    await releaseParkedLinks();
    await displayParkedLinks([]);
    showNotification("All links have been opened in new tabs");
  } catch (error) {
    console.error("Error releasing parked links:", error);
    showNotification("Error opening links", 3000);
  }
}

async function handleClearParkedLinks() {
  if (confirm("Are you sure you want to clear all parked links?")) {
    await clearParkedLinks();
    await displayParkedLinks([]);
    showNotification("All parked links have been cleared");
  }
}