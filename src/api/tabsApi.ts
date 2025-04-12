import { pickColorForContext } from "../lib/pickColor";

export async function groupTabByContext(tabId: number, context: string): Promise<void> {
  const groups = await chrome.tabGroups.query({});
  let existingGroup = groups.find((grp) => grp.title === context);

  if (!existingGroup) {
    // Create new group if none match
    const newGroupId = await chrome.tabs.group({ tabIds: [tabId] });
    existingGroup = await chrome.tabGroups.update(newGroupId, {
      title: context,
      color: pickColorForContext(context),
    });
  } else {
    // Add to existing group
    await chrome.tabs.group({ groupId: existingGroup.id, tabIds: [tabId] });
  }
}

export function onTabRemoved(callback: (tabId: number) => void): void {
  chrome.tabs.onRemoved.addListener(callback);
}

/** Ungroup every tab in every window */
export async function ungroupAllTabs(): Promise<void> {
  const groups = await chrome.tabGroups.query({});
  for (const g of groups) {
    const tabs = await chrome.tabs.query({ groupId: g.id });
    if (tabs.length) {
      await chrome.tabs.ungroup(tabs.map(t => t.id!));
    }
  }
}