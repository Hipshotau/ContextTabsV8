// Get DOM elements
const timeRemainingElement = document.getElementById('time-remaining');
const contextNameElement = document.getElementById('context-name');
const endTimerButton = document.getElementById('end-timer');
const warningMessage = document.getElementById('warning-message');

// Timer variables
let timerInterval;
let endTime = 0;
let fromContext = '';
let toContext = '';

// Initialize the timer
function initializeTimer() {
  // Get timer data from storage
  chrome.storage.local.get(['activeGlobalTimer'], (result) => {
    if (result.activeGlobalTimer && result.activeGlobalTimer.active) {
      const { endTime: storedEndTime, fromContext: from, toContext: to } = result.activeGlobalTimer;
      
      // Set timer data
      endTime = storedEndTime;
      fromContext = from;
      toContext = to;
      
      // Update UI
      contextNameElement.textContent = `Switched from "${fromContext}" to "${toContext}"`;
      
      // Start timer
      startTimerDisplay();
    } else {
      // No active timer
      timeRemainingElement.textContent = 'No active timer';
      contextNameElement.textContent = 'N/A';
      warningMessage.style.display = 'none';
    }
  });
}

// Start timer display
function startTimerDisplay() {
  // Clear any existing interval
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Update immediately
  updateTimerDisplay();
  
  // Update every second
  timerInterval = setInterval(() => {
    updateTimerDisplay();
  }, 1000);
}

// Update timer display
function updateTimerDisplay() {
  const now = Date.now();
  const timeLeft = Math.max(0, endTime - now);
  
  if (timeLeft <= 0) {
    // Timer expired
    timeRemainingElement.textContent = 'Expired';
    clearInterval(timerInterval);
    
    // Show warning
    warningMessage.textContent = 'Timer has expired. Return to your focus now!';
    warningMessage.style.display = 'block';
    warningMessage.classList.add('pulsing');
    
    // Notify background
    chrome.runtime.sendMessage({ type: 'TIMER_EXPIRED' });
    return;
  }
  
  // Format time remaining
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  timeRemainingElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Add visual indication when time is running low
  if (timeLeft < 60000) {
    timeRemainingElement.style.color = '#f44336';
    timeRemainingElement.classList.add('pulsing');
    
    // Show warning message
    warningMessage.style.display = 'block';
  } else {
    timeRemainingElement.style.color = '';
    timeRemainingElement.classList.remove('pulsing');
    warningMessage.style.display = 'none';
  }
}

// End timer handler
endTimerButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'END_FOCUS_TIMER' });
  timeRemainingElement.textContent = 'Timer ended';
  clearInterval(timerInterval);
  warningMessage.style.display = 'none';
  
  // Update UI to show timer ended
  contextNameElement.textContent = 'Timer ended - returned to focus';
});

// Listen for timer updates from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TIMER_UPDATED') {
    initializeTimer();
  } else if (message.type === 'TIMER_ENDED') {
    timeRemainingElement.textContent = 'Timer ended';
    contextNameElement.textContent = 'N/A';
    warningMessage.style.display = 'none';
    clearInterval(timerInterval);
  }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', initializeTimer);

// Poll for timer updates (backup mechanism)
setInterval(initializeTimer, 5000); 