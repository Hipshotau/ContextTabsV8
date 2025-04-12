export interface TabContextMap {
  [tabId: number]: string;
}

export interface PageData {
  url: string;
  title: string;
  fullText: string;
  metaDescription: string;
  metaKeywords: string[];
  domainCategory?: string;
}

export interface ContextResult {
  primaryContext: string;
  confidence: number;
  secondaryContexts: Array<{context: string, confidence: number}>;
  features?: Record<string, number>;
}

export interface ContextSwitch {
  from: string;
  to: string;
  timestamp: number;
  fromUrl: string;
  toUrl: string;
}

export interface FocusStatus {
  isLostFocus: boolean;
  contextSwitches: ContextSwitch[];
  currentStreak: number;
  currentContext: string;
}

export interface ParkedLink {
  url: string;
  title?: string;
  context: string;      // Entertainment, Social, …
  timestamp: number;    // when it was parked
}

export interface FocusSettings {
  enabled: boolean;
  notificationsEnabled: boolean;
  switchThreshold: number;
  timeWindowMinutes: number;
  focusWindowEnabled?: boolean;
}

export interface FocusState {
  active: boolean;            // true while a focus session is running
  allowedContexts: string[];  // the contexts the user *wants* to stay in
  endTime?: number;           // optional timer
}

export interface StorageData {
  extensionEnabled?: boolean;
  autoGroupEnabled?: boolean;
  focusSettings?: FocusSettings;
  contextHistory?: Array<{context: string, url: string, timestamp: number, confidence: number}>;
  domainCategories?: Record<string, string>;
  contextKeywords?: Record<string, Record<string, number>>;
  
  /** New single focus state object */
  focusState?: FocusState;
  
  /** Categories blocked in focus mode (for backward compatibility) */
  blockedCategories?: string[];
  
  /** Per-URL or sub-URL overrides so users can reclassify them as allowed/disallowed */
  subUrlOverrides?: Record<string, string>;

  /** Links parked for later viewing */
  parkedLinks?: ParkedLink[];

  /**
   * Saved tab groups for workspace restoration. 
   * Each workspace can have an ID or name plus list of tabs, etc.
   */
  savedWorkspaces?: Array<{
    name: string;
    tabGroups: Array<{
      groupId: number;
      title: string;
      color: chrome.tabGroups.ColorEnum;
      tabUrls: string[];
    }>;
    timestamp: number;
  }>;
}