import { addContextToHistory, getStorage } from "../../api/storageApi";
import { ContextSwitch } from "../../types/index";

/**
 * Class to track context history and detect focus issues
 */
export class ContextTracker {
  private latestContext: string = "Unknown";
  private latestUrl: string = "";
  
  /**
   * Add context to history
   */
  async addContext(context: string, url: string, confidence: number): Promise<void> {
    this.latestContext = context;
    this.latestUrl = url;
    
    // Store in persistent storage
    await addContextToHistory(context, url, confidence);
  }
  
  /**
   * Get context switches in a time window
   */
  async getContextSwitches(timeWindowMinutes: number = 15): Promise<ContextSwitch[]> {
    const { contextHistory } = await getStorage(["contextHistory"]);
    if (!contextHistory || contextHistory.length < 2) {
      return [];
    }
    
    const switches: ContextSwitch[] = [];
    const now = Date.now();
    const timeWindow = timeWindowMinutes * 60 * 1000;
    
    // Filter history to time window
    const relevantHistory = contextHistory.filter(
      entry => (now - entry.timestamp) < timeWindow
    );
    
    // Find context switches
    for (let i = 1; i < relevantHistory.length; i++) {
      if (relevantHistory[i].context !== relevantHistory[i-1].context) {
        switches.push({
          from: relevantHistory[i-1].context,
          to: relevantHistory[i].context,
          timestamp: relevantHistory[i].timestamp,
          fromUrl: relevantHistory[i-1].url,
          toUrl: relevantHistory[i].url
        });
      }
    }
    
    return switches;
  }
  
  /**
   * Get current context streak (consecutive entries with same context)
   */
  async getCurrentContextStreak(): Promise<number> {
    const { contextHistory } = await getStorage(["contextHistory"]);
    if (!contextHistory || contextHistory.length === 0) {
      return 0;
    }
    
    const currentContext = contextHistory[contextHistory.length - 1].context;
    let streak = 1;
    
    // Count backwards from most recent
    for (let i = contextHistory.length - 2; i >= 0; i--) {
      if (contextHistory[i].context === currentContext) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }
  
  /**
   * Check if focus is lost based on context switches
   */
  async isLostFocus(switchThreshold: number = 5, timeWindowMinutes: number = 15): Promise<boolean> {
    const switches = await this.getContextSwitches(timeWindowMinutes);
    
    // Check number of switches
    if (switches.length >= switchThreshold) {
      // Check if switching between different contexts
      const contexts = new Set(switches.map(s => s.to));
      if (contexts.size >= 3) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get latest context
   */
  getLatestContext(): string {
    return this.latestContext;
  }
  
  /**
   * Get latest URL
   */
  getLatestUrl(): string {
    return this.latestUrl;
  }
}