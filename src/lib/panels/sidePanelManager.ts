/**
 * Open the side panel in the current window
 */
export async function openSidePanel(): Promise<void> {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: currentWindow.id });
    console.log("Side panel opened successfully");
  } catch (error) {
    console.error("Error opening side panel:", error);
  }
}

/**
 * Close the side panel in all windows
 */
export async function closeSidePanel(): Promise<void> {
  try {
    const panels = await chrome.sidePanel.getAll();
    await Promise.all(panels.map((panel: chrome.sidePanel.PanelInfo) => 
      chrome.sidePanel.close({ windowId: panel.windowId })
    ));
    console.log("Side panels closed successfully");
  } catch (error) {
    console.error("Error closing side panels:", error);
  }
}

/**
 * Set the side panel properties
 */
export async function setSidePanelProperties(path: string, title: string): Promise<void> {
  try {
    await chrome.sidePanel.setOptions({
      path,
      enabled: true
    });
    console.log("Side panel properties updated");
  } catch (error) {
    console.error("Error setting side panel properties:", error);
  }
} 