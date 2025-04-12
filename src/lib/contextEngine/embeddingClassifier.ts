// This is a simplified version that can work without TensorFlow.js
// In production, you'd use the Universal Sentence Encoder model

/**
 * Simple context classifier that doesn't rely on TensorFlow
 * This is a fallback for when TensorFlow.js can't be used
 */
export class TextClassifier {
  private initialized: boolean = false;
  private categoryKeywords: Record<string, string[]> = {
    "Work": [
      "project deadline meeting task client report presentation office business email colleague manager workflow productivity professional",
    ],
    "Learning": [
      "course lesson tutorial learn study education assignment homework university college school academy lecture professor student quiz exam test knowledge textbook",
    ],
    "Entertainment": [
      "movie show stream watch video game play fun music song entertainment netflix youtube hulu disney hbo amazon twitch gaming",
    ],
    "News": [
      "news article report breaking headline journalist media press update current politics election government president minister cnn bbc nyt reuters associated",
    ],
    "Shopping": [
      "shop buy purchase order cart checkout price discount product item amazon ebay etsy store mall shipping delivery payment credit review",
    ],
    "Social": [
      "friend message chat post share social network facebook twitter instagram snapchat tiktok linkedin reddit forum comment like follow connect profile",
    ],
    "Research": [
      "research study analysis data information journal article paper science scientific academic scholar experiment theory hypothesis methodology finding conclude reference citation",
    ],
    "Development": [
      "code programming developer software github git repository commit function class method variable object array string stack overflow javascript python typescript",
    ]
  };
  
  /**
   * Initialize the classifier
   */
  async initialize(): Promise<void> {
    this.initialized = true;
  }
  
  /**
   * Classify text into context categories
   */
  async classify(text: string): Promise<Record<string, number>> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const textLower = text.toLowerCase();
    const scores: Record<string, number> = {};
    
    // Simple scoring based on keyword presence
    for (const [category, keywordLists] of Object.entries(this.categoryKeywords)) {
      let categoryScore = 0;
      
      for (const keywordList of keywordLists) {
        const keywords = keywordList.split(" ");
        let keywordsFound = 0;
        
        for (const keyword of keywords) {
          if (textLower.includes(keyword)) {
            keywordsFound++;
            categoryScore += 1;
          }
        }
        
        // Normalize score
        if (keywordsFound > 0) {
          categoryScore = categoryScore / (keywords.length * 0.3);
        }
      }
      
      scores[category] = Math.min(1, categoryScore);
    }
    
    return scores;
  }
}