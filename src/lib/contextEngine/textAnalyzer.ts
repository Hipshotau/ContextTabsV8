import { StorageData } from "../../api/storageApi";

// Default keyword dictionaries with weights
const DEFAULT_CONTEXT_KEYWORDS: Record<string, Record<string, number>> = {
  "Work": {
    "project": 0.8, "deadline": 0.9, "meeting": 0.7, "task": 0.8, "client": 0.8, 
    "report": 0.7, "presentation": 0.7, "office": 0.6, "business": 0.8, "email": 0.6,
    "colleague": 0.7, "manager": 0.7, "workflow": 0.8, "productivity": 0.7, "professional": 0.7
  },
  "Learning": {
  "course": 0.9, "lesson": 0.8, "tutorial": 0.9, "learn": 0.8, "study": 0.9,
  "education": 0.7, "assignment": 0.9, "homework": 0.9, "university": 0.8, "college": 0.8,
  "school": 0.7, "academy": 0.7, "lecture": 0.9, "professor": 0.8, "student": 0.7,
  "quiz": 0.8, "exam": 0.9, "test": 0.7, "knowledge": 0.6, "textbook": 0.8,
  "admissions": 0.9, "academics": 0.8, "majors": 0.8, "undergraduate": 0.9,
  "graduate": 0.9, "faculty": 0.7, "syllabus": 0.8, "transcript": 0.7,
  "campus": 0.6, "enroll": 0.9
  },
  "Entertainment": {
    "movie": 0.9, "show": 0.7, "stream": 0.7, "watch": 0.6, "video": 0.7,
    "game": 0.8, "play": 0.6, "fun": 0.7, "music": 0.8, "song": 0.8,
    "entertainment": 0.9, "netflix": 0.9, "youtube": 0.8, "hulu": 0.9, "disney": 0.8,
    "hbo": 0.9, "amazon": 0.5, "twitch": 0.9, "gaming": 0.9
  },
  "News": {
    "news": 0.9, "article": 0.7, "report": 0.6, "breaking": 0.8, "headline": 0.9,
    "journalist": 0.8, "media": 0.7, "press": 0.7, "update": 0.6, "current": 0.6,
    "politics": 0.7, "election": 0.7, "government": 0.6, "president": 0.6, "minister": 0.6,
    "cnn": 0.9, "bbc": 0.9, "nyt": 0.9, "reuters": 0.9, "associated": 0.7
  },
  "Shopping": {
    "shop": 0.9, "buy": 0.8, "purchase": 0.8, "order": 0.7, "cart": 0.9,
    "checkout": 0.9, "price": 0.8, "discount": 0.8, "product": 0.8, "item": 0.7,
    "amazon": 0.8, "ebay": 0.9, "etsy": 0.9, "store": 0.8, "mall": 0.8,
    "shipping": 0.8, "delivery": 0.7, "payment": 0.8, "credit": 0.7, "review": 0.6
  },
  "Social": {
    "friend": 0.8, "message": 0.7, "chat": 0.8, "post": 0.7, "share": 0.7,
    "social": 0.9, "network": 0.7, "facebook": 0.9, "twitter": 0.9, "instagram": 0.9,
    "snapchat": 0.9, "tiktok": 0.9, "linkedin": 0.9, "reddit": 0.8, "forum": 0.7,
    "comment": 0.7, "like": 0.6, "follow": 0.6, "connect": 0.7, "profile": 0.8
  },
  "Research": {
    "research": 0.9, "study": 0.8, "analysis": 0.8, "data": 0.7, "information": 0.6,
    "journal": 0.9, "article": 0.8, "paper": 0.7, "science": 0.8, "scientific": 0.8,
    "academic": 0.9, "scholar": 0.9, "experiment": 0.8, "theory": 0.7, "hypothesis": 0.8,
    "methodology": 0.8, "finding": 0.7, "conclude": 0.7, "reference": 0.7, "citation": 0.8
  },
  "Development": {
    "code": 0.9, "programming": 0.9, "developer": 0.9, "software": 0.8, "github": 0.9,
    "git": 0.8, "repository": 0.8, "commit": 0.8, "function": 0.7, "class": 0.7,
    "method": 0.7, "variable": 0.7, "object": 0.7, "array": 0.7, "string": 0.7,
    "stack": 0.8, "overflow": 0.8, "javascript": 0.8, "python": 0.8, "typescript": 0.8
  }
};

// Cache for context keywords to avoid storage hits
let keywordsCache: Record<string, Record<string, number>> | null = null;

// Setup storage change listener to invalidate cache
chrome.storage.onChanged.addListener((changes) => {
  if (changes.contextKeywords) {
    // Clear the cache when keywords are updated
    keywordsCache = null;
  }
});

/**
 * Get context keywords with caching
 */
export async function getContextKeywords(): Promise<Record<string, Record<string, number>>> {
  // Return from cache if available
  if (keywordsCache !== null) {
    // Return a deep clone to prevent mutation
    return structuredClone(keywordsCache);
  }
  
  try {
    const { contextKeywords } = await chrome.storage.local.get("contextKeywords") as Pick<StorageData, "contextKeywords">;
    // Store in cache
    keywordsCache = contextKeywords || DEFAULT_CONTEXT_KEYWORDS;
    // Return a deep clone to prevent mutation
    return structuredClone(keywordsCache);
  } catch (error) {
    console.error("Error loading context keywords:", error);
    keywordsCache = DEFAULT_CONTEXT_KEYWORDS;
    // Return a deep clone to prevent mutation
    return structuredClone(keywordsCache);
  }
}

/**
 * Preprocess text by removing boilerplate and normalizing
 */
function preprocessText(text: string): string {
  // Remove common boilerplate elements
  const boilerplatePatterns = [
    /<header[^>]*>[\s\S]*?<\/header>/gi,
    /<footer[^>]*>[\s\S]*?<\/footer>/gi,
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /<style[^>]*>[\s\S]*?<\/style>/gi,
    /<!--[\s\S]*?-->/g,
    /cookie|privacy|terms|menu|navigation|footer|header|sidebar/gi
  ];
  
  let processedText = text;
  for (const pattern of boilerplatePatterns) {
    processedText = processedText.replace(pattern, ' ');
  }
  
  // Normalize whitespace
  processedText = processedText.replace(/\s+/g, ' ').trim();
  
  // Cap text length to focus on most relevant content
  const MAX_TEXT_LENGTH = 5000;
  if (processedText.length > MAX_TEXT_LENGTH) {
    processedText = processedText.substring(0, MAX_TEXT_LENGTH);
  }
  
  return processedText;
}

/**
 * Calculate TF-IDF scores with normalization
 */
function calculateTFIDF(text: string, keywords: Record<string, Record<string, number>>): Record<string, number> {
  const textLower = text.toLowerCase();
  const scores: Record<string, number> = {};
  
  // Calculate term frequencies
  const termFreq: Record<string, number> = {};
  const words = textLower.split(/\W+/);
  const totalWords = words.length;
  
  for (const word of words) {
    termFreq[word] = (termFreq[word] || 0) + 1;
  }
  
  // Calculate TF-IDF scores for each category
  for (const [category, keywordWeights] of Object.entries(keywords)) {
    let categoryScore = 0;
    let matchedTerms = 0;
    
    for (const [keyword, weight] of Object.entries(keywordWeights)) {
      if (termFreq[keyword]) {
        // TF: term frequency normalized by total words
        const tf = termFreq[keyword] / totalWords;
        
        // IDF: a constant value for weight normalization
        const idf = 1.5;
        
        categoryScore += tf * idf * weight;
        matchedTerms++;
      }
    }
    
    // Normalize score based on number of matched terms
    if (matchedTerms > 0) {
      scores[category] = Math.min(1, categoryScore / (matchedTerms * 0.3));
    } else {
      scores[category] = 0;
    }
  }
  
  return scores;
}

/**
 * Analyze text with improved TF-IDF scoring
 */
export async function analyzeText(text: string): Promise<Record<string, number>> {
  const processedText = preprocessText(text);
  const keywords = await getContextKeywords();
  return calculateTFIDF(processedText, keywords);
}