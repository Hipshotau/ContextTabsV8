// DOM element references
const timerEl = document.getElementById("timer") as HTMLElement;
const endBtn = document.getElementById("endBtn") as HTMLButtonElement;
const blockedList = document.getElementById("blockedList") as HTMLElement;

interface FocusTimeResponse {
  seconds: number;
}

/**
 * Update timer display every second
 */
async function updateTimer(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage<any, FocusTimeResponse>({ 
      type: "GET_FOCUS_TIME_LEFT" 
    });
    
    const seconds = response?.seconds || 0;
    
    if (seconds <= 0) {
      timerEl.textContent = "COMPLETE";
      timerEl.style.color = "#4caf50"; // Green
      return;
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    // Visual warning when time is low
    if (seconds < 300) { // Less than 5 minutes (300 seconds)
      timerEl.style.color = "#ff9800"; // Orange
    }
  } catch (error) {
    console.error("Error fetching time left:", error);
    timerEl.textContent = "ERROR";
    timerEl.style.color = "#f44336"; // Red
  }
}

/**
 * Load blocked categories from storage
 */
async function loadBlockedCategories(): Promise<void> {
  try {
    const { blockedCategories } = await chrome.storage.local.get("blockedCategories");
    
    if (!blockedList) return;
    
    if (blockedCategories && blockedCategories.length > 0) {
      blockedList.innerHTML = '';
      
      blockedCategories.forEach((category: string) => {
        const div = document.createElement('div');
        div.className = 'context-item blocked';
        div.textContent = category;
        blockedList.appendChild(div);
      });
    } else {
      blockedList.innerHTML = '<div class="context-item">No categories blocked</div>';
    }
  } catch (error) {
    console.error("Error loading blocked categories:", error);
    if (blockedList) {
      blockedList.innerHTML = '<div class="context-item">Error loading categories</div>';
    }
  }
}

/**
 * Handle ending the focus session
 */
async function handleEndSession(): Promise<void> {
  try {
    const saveWorkspace = confirm("Save current workspace before ending?");
    let workspaceName = '';
    
    if (saveWorkspace) {
      workspaceName = prompt("Enter workspace name:", `Workspace_${new Date().toLocaleDateString()}`) || '';
      if (!workspaceName) return; // User cancelled
    }
    
    await chrome.runtime.sendMessage({
      type: "END_FOCUS_SESSION",
      payload: {
        saveWorkspace,
        workspaceName
      }
    });
    
    timerEl.textContent = "ENDED";
    timerEl.style.color = "#f44336"; // Red
    endBtn.disabled = true;
    endBtn.textContent = "Session Ended";
  } catch (error) {
    console.error("Error ending session:", error);
    alert("Error ending session. Please try again.");
  }
}

/**
 * Initialize the sidepanel
 */
function initialize(): void {
  // Add event listener to end button
  endBtn?.addEventListener("click", handleEndSession);
  
  // Load initial data
  loadBlockedCategories().catch(console.error);
  updateTimer().catch(console.error);
  
  // Set up timer interval
  setInterval(() => {
    updateTimer().catch(console.error);
  }, 1000);
}

// Start everything when page loads
document.addEventListener("DOMContentLoaded", initialize); 