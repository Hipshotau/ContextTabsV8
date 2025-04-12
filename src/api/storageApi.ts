import { FocusSettings, StorageData as TypesStorageData, FocusState } from "../types/index";

// Re-export the StorageData interface from types/index.d.ts
export type StorageData = TypesStorageData;

/**
 * Get an object containing the requested keys.
 */
export function getStorage<T extends keyof StorageData>(
  keys: T[]
): Promise<Pick<StorageData, T>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(result as Pick<StorageData, T>);
    });
  });
}

/**
 * Set or update the given keys in storage.
 */
export function setStorage(data: Partial<StorageData>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve();
    });
  });
}

/**
 * Add a context entry to history
 */
export async function addContextToHistory(
  context: string,
  url: string,
  confidence: number
): Promise<void> {
  const { contextHistory } = await getStorage(["contextHistory"]);
  const newHistory = contextHistory || [];
  
  // Add new entry
  newHistory.push({
    context,
    url,
    timestamp: Date.now(),
    confidence
  });
  
  // Limit history size
  if (newHistory.length > 100) {
    newHistory.shift();
  }
  
  await setStorage({ contextHistory: newHistory });
}

/**
 * Get the current focus state
 */
export async function getFocusState(): Promise<FocusState> {
  const { focusState } = await getStorage(["focusState"]);
  
  // Default state if none exists
  const defaultState: FocusState = {
    active: false,
    allowedContexts: []
  };
  
  return { ...defaultState, ...focusState };
}

/**
 * Update the focus state
 */
export async function setFocusState(partialState: Partial<FocusState>): Promise<void> {
  const currentState = await getFocusState();
  await setStorage({ 
    focusState: { ...currentState, ...partialState }
  });
}