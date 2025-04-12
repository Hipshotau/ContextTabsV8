/**
 * Content script for Context Focus
 * 
 * This script runs on each page and does only one thing:
 * 1. Classify the current page context
 * 2. Send the classification to the background script
 */

import { classifyPageContext } from "../lib/contextEngine";

// Keep track of last context (to avoid sending duplicate messages)
let lastContext: string | null = null;

// Initialize context detection
async function initContextDetection(): Promise<void> {
  // Register for future DOM changes
  setupMutationObserver();
  
  // Initial classification
  await detectAndSendContext();
}

/**
 * Set up a mutation observer to detect and send context when content changes
 */
function setupMutationObserver(): void {
  // Observe changes to the page content
  const observer = new MutationObserver(() => {
    // Avoid excessive classifications by debouncing
    if (!contextDetectionTimer) {
      scheduleContextCheck();
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

// Timer for debouncing context detection
let contextDetectionTimer: number | null = null;

/**
 * Schedule a context check after a short delay (debouncing)
 */
function scheduleContextCheck(): void {
  // Clear any existing timer
  if (contextDetectionTimer) {
    window.clearTimeout(contextDetectionTimer);
    contextDetectionTimer = null;
  }

  // Set a new timer
  contextDetectionTimer = window.setTimeout(async () => {
    await detectAndSendContext();
  }, 1000);
}

/**
 * Extract useful data from the current page
 */
function extractPageData() {
  // Get basic page info
  const url = window.location.href;
  const title = document.title;
  
  // Extract metadata
  const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content')?.split(',').map(k => k.trim()) || [];
  
  // Extract visible text
  const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, span, div, li');
  let visibleText = '';
  
  // Get text from the first 100 elements (for performance)
  const maxElements = Math.min(textElements.length, 100);
  for (let i = 0; i < maxElements; i++) {
    const el = textElements[i];
    const style = window.getComputedStyle(el);
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      visibleText += el.textContent + ' ';
      if (visibleText.length > 5000) break; // Limit text length
    }
  }
  
  return {
    url,
    title,
    fullText: visibleText.trim(),
    metaDescription,
    metaKeywords
  };
}

/**
 * Detect the context of the current page and send it to the background script
 */
async function detectAndSendContext(): Promise<void> {
  try {
    // Extract page data
    const pageData = extractPageData();
    
    // Classify context
    const contextResult = await classifyPageContext(pageData);
    
    // Only send if context has changed
    if (contextResult.primaryContext !== lastContext) {
      lastContext = contextResult.primaryContext;
      
      // Simple message with just the context and confidence
      chrome.runtime.sendMessage({
        type: "CONTEXT_DETECTED",
        context: contextResult.primaryContext,
        confidence: contextResult.confidence,
        url: pageData.url
      });
    }
  } catch (error) {
    console.error("Error detecting context:", error);
  }
}

// Start context detection when the page is loaded
(function() {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initContextDetection();
  } else {
    document.addEventListener('DOMContentLoaded', initContextDetection);
  }
})();

// Add listener for DRIFT_WARNING messages from background script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "DRIFT_WARNING") return;

  // remove any previous overlay
  const old = document.getElementById("__cf_drift_overlay");
  old?.remove();

  // build a full‑screen overlay
  const ov = document.createElement("div");
  ov.id = "__cf_drift_overlay";
  ov.style.cssText = `
    position:fixed;inset:0;z-index:2147483647;
    background:rgba(0,0,0,.85);color:#fff;display:flex;
    flex-direction:column;align-items:center;justify-content:center;
    font:700 32px/1.4 system-ui, sans-serif;text-align:center;
  `;
  ov.textContent = msg.message || "You're drifting!";
  
  // optional "Return" button
  const btn = document.createElement("button");
  btn.textContent = "Back to focus";
  btn.style.cssText = `
    margin-top:24px;padding:12px 24px;font-size:18px;font-weight:700;
    border:none;border-radius:6px;cursor:pointer;background:#d32f2f;color:#fff;
  `;
  btn.onclick = () => ov.remove();
  ov.appendChild(btn);

  document.documentElement.appendChild(ov);

  // let background know we handled it (optional)
  return true;  // keeps the sendResponse channel open
});