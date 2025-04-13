/**
 * Simplified popup for the Focus extension
 * 
 * This popup allows users to select which contexts they want to focus on
 * and optionally set a timer duration. Everything else is blocked.
 */

import { getFocusState } from "../api/storageApi";

// DOM Elements
const inactiveUI = document.getElementById('inactiveUI') as HTMLElement;
const activeUI = document.getElementById('activeUI') as HTMLElement;
const contextList = document.getElementById('contextList') as HTMLElement;
const durationInput = document.getElementById('duration') as HTMLInputElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const endBtn = document.getElementById('endBtn') as HTMLButtonElement;
const allowedTags = document.getElementById('allowedTags') as HTMLElement;
const countdown = document.getElementById('countdown') as HTMLElement;

// Available contexts
const AVAILABLE_CONTEXTS = [
  'Work',
  'Development',
  'Research',
  'Learning',
  'Entertainment',
  'Social', 
  'Shopping',
  'News'
];

// Initialize the popup
async function initPopup() {
  // Render context checkboxes
  renderContextList();
  
  // Check current focus state
  const focusState = await getFocusState();
  
  if (focusState.active) {
    // Show active UI
    renderActive(focusState);
  } else {
    // Show inactive UI
    renderInactive();
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Start polling for updates (to update the countdown)
  startPolling();
}

// Render the list of contexts as checkboxes
function renderContextList() {
  contextList.innerHTML = '';
  
  AVAILABLE_CONTEXTS.forEach(context => {
    const wrapper = document.createElement('div');
    wrapper.className = 'context-checkbox';
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = context;
    input.id = `context-${context}`;
    input.className = 'context-checkbox-input';
    
    const label = document.createElement('label');
    label.textContent = context;
    label.htmlFor = `context-${context}`;
    
    wrapper.appendChild(input);
    wrapper.appendChild(label);
    contextList.appendChild(wrapper);
  });
}

// Show the inactive UI (start focus)
function renderInactive() {
  inactiveUI.hidden = false;
  activeUI.hidden = true;
}

// Show the active UI (end focus)
function renderActive(focusState: any) {
  inactiveUI.hidden = true;
  activeUI.hidden = false;
  
  // Show allowed contexts
  allowedTags.textContent = focusState.allowedContexts.join(', ');
  
  // Show countdown if there's a timer
  updateCountdown(focusState);
}

// Update the countdown timer
function updateCountdown(focusState: any) {
  if (!focusState.endTime) {
    countdown.textContent = 'No time limit';
    return;
  }
  
  const now = Date.now();
  const timeLeft = Math.max(0, focusState.endTime - now);
  
  if (timeLeft <= 0) {
    countdown.textContent = 'Time expired';
    return;
  }
  
  // Format as MM:SS
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  
  countdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
}

// Setup event listeners
function setupEventListeners() {
  // Start Focus button
  startBtn.addEventListener('click', () => {
    // Get selected contexts
    const selectedCheckboxes = document.querySelectorAll<HTMLInputElement>('.context-checkbox-input:checked');
    const allowedContexts = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (allowedContexts.length === 0) {
      alert('Please select at least one context to focus on');
      return;
    }
    
    // Get duration (if any)
    const duration = durationInput.value ? parseInt(durationInput.value, 10) : undefined;
    
    // Start focus session with allowed contexts directly
    chrome.runtime.sendMessage({
      type: 'START_FOCUS_SESSION',
      payload: {
        allowedContexts: allowedContexts,
        durationMinutes: duration
      }
    }, () => {
      // Refresh the popup after starting
      window.location.reload();
    });
  });
  
  // End Focus button
  endBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'END_FOCUS_SESSION'
    }, () => {
      // Refresh the popup after ending
      window.location.reload();
    });
  });
}

// Poll for updates (for countdown)
function startPolling() {
  setInterval(async () => {
    const focusState = await getFocusState();
    
    if (focusState.active && !activeUI.hidden) {
      updateCountdown(focusState);
    }
  }, 1000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initPopup);