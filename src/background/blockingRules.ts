/**
 * Declarative Net Request rules for efficient content blocking
 */
import { getFocusState } from "../api/storageApi";

// Constants
const RULE_ID_OFFSET = 100;
const MAX_DNR_RULES = 5000;
const BLOCKED_PAGE_URL = chrome.runtime.getURL("blocked.html");

/**
 * Apply allowed contexts as declarative blocking rules
 * 
 * This function takes the current allowed contexts and creates dynamic DNR rules
 * to block all requests to domains that are categorized outside those contexts.
 */
export async function applyAllowedContexts(): Promise<void> {
  try {
    // Get the current focus state
    const focusState = await getFocusState();
    
    // If focus is not active, remove all rules
    if (!focusState.active) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: await getCurrentRuleIds()
      });
      return;
    }
    
    // Get domains classified by context
    const { domainContextMap } = await chrome.storage.local.get('domainContextMap') as { 
      domainContextMap: Record<string, string> 
    };
    
    if (!domainContextMap) {
      console.warn("No domain context map found, cannot create blocking rules");
      return;
    }
    
    // Group domains by context
    const domainsByContext: Record<string, string[]> = {};
    for (const [domain, context] of Object.entries(domainContextMap)) {
      if (!domainsByContext[context]) {
        domainsByContext[context] = [];
      }
      domainsByContext[context].push(domain);
    }
    
    // Create rules for each blocked context
    const rules: chrome.declarativeNetRequest.Rule[] = [];
    const blockedContexts = getAllKnownContexts().filter(
      ctx => !focusState.allowedContexts.includes(ctx)
    );
    
    let ruleId = RULE_ID_OFFSET;
    
    for (const context of blockedContexts) {
      const domains = domainsByContext[context] || [];
      
      // Skip if no domains in this context
      if (domains.length === 0) continue;
      
      // Add a rule for this context
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
          redirect: { url: BLOCKED_PAGE_URL }
        },
        condition: {
          urlFilter: domains.join('|'),
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
        }
      });
      
      // DNR has a rule limit, so break if we hit it
      if (rules.length >= MAX_DNR_RULES) {
        console.warn(`Hit DNR rule limit of ${MAX_DNR_RULES}`);
        break;
      }
    }
    
    // Apply the rules
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: await getCurrentRuleIds(),
      addRules: rules
    });
    
    console.log(`[DNR] Applied ${rules.length} blocking rules for ${blockedContexts.length} contexts`);
  } catch (error) {
    console.error("Error applying DNR rules:", error);
  }
}

/**
 * Get current active rule IDs
 */
async function getCurrentRuleIds(): Promise<number[]> {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.map(rule => rule.id);
}

/**
 * Get all known context categories
 */
function getAllKnownContexts(): string[] {
  return [
    "Work", "Development", "Research", "Learning", 
    "Entertainment", "Social", "Shopping", "News"
  ];
} 