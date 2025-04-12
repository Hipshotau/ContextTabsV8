import { PageData, ContextResult } from "../../types/index";
import { analyzeText } from "./textAnalyzer";
import { analyzeUrl, getDomainCategory, extractDomain } from "./urlAnalyzer";
import { TextClassifier } from "./embeddingClassifier";
import { ContextTracker } from "./contextHistory";

// Singleton instances
const textClassifier = new TextClassifier();
const contextTracker = new ContextTracker();

// Initialize the engine
let initialized = false;

/**
 * Initialize the context engine
 */
export async function initializeContextEngine(): Promise<void> {
  if (initialized) return;
  
  try {
    // Initialize text classifier
    await textClassifier.initialize();
    console.log("[Context] Context engine initialized successfully");
    initialized = true;
  } catch (error) {
    console.error("[Context] Failed to initialize context engine:", error);
    // Continue anyway, will use fallback methods
  }
}

/**
 * Extract metadata from the document
 */
export function extractMetadata(): { description: string, keywords: string[] } {
  let description = "";
  let keywords: string[] = [];
  
  // Get meta description
  const descEl = document.querySelector('meta[name="description"]');
  if (descEl) {
    description = descEl.getAttribute('content') || "";
  }
  
  // Get meta keywords
  const keywordsEl = document.querySelector('meta[name="keywords"]');
  if (keywordsEl) {
    const keywordText = keywordsEl.getAttribute('content') || "";
    keywords = keywordText.split(',').map(k => k.trim());
  }
  
  return { description, keywords };
}

/**
 * Extract page data for context analysis
 */
export function extractPageData(): PageData {
  const metadata = extractMetadata();
  const domain = extractDomain(window.location.href);
  
  return {
    url: window.location.href,
    title: document.title,
    fullText: document.body.innerText || "",
    metaDescription: metadata.description,
    metaKeywords: metadata.keywords,
    domainCategory: getDomainCategory(domain)
  };
}

/**
 * Combine scores with weights
 */
function combineScores(
  textScores: Record<string, number>,
  urlScores: Record<string, number>,
  domainCategory?: string
): Record<string, number> {
  const combinedScores: Record<string, number> = { ...textScores };
  
  // Add URL scores with lower weight
  for (const [context, score] of Object.entries(urlScores)) {
    combinedScores[context] = (combinedScores[context] || 0) + (score * 0.3);
  }
  
  // Boost domain category if available
  if (domainCategory && combinedScores[domainCategory]) {
    combinedScores[domainCategory] = combinedScores[domainCategory] * 1.3;
  }
  
  return combinedScores;
}

/**
 * Convert scores to final result
 */
function formatResult(scores: Record<string, number>): ContextResult {
  // Sort contexts by score
  const sortedContexts = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);
  
  if (sortedContexts.length === 0) {
    return {
      primaryContext: "General",
      confidence: 1,
      secondaryContexts: []
    };
  }
  
  // Get primary and secondary contexts
  const [primaryContext, primaryScore] = sortedContexts[0];
  const secondaryContexts = sortedContexts.slice(1, 4).map(([context, score]) => ({
    context,
    confidence: score
  }));
  
  return {
    primaryContext,
    confidence: primaryScore,
    secondaryContexts,
    features: scores
  };
}

/**
 * Classify page context
 */
export async function classifyPageContext(pageData: PageData): Promise<ContextResult> {
  // Ensure engine is initialized
  if (!initialized) {
    await initializeContextEngine();
  }
  
  // Get scores from different sources
  const textScores = await textClassifier.classify(pageData.fullText);
  const urlScores = analyzeUrl(pageData.url);
  
  // Combine scores
  const combinedScores = combineScores(textScores, urlScores, pageData.domainCategory);
  
  // Format result
  const result = formatResult(combinedScores);
  
  // Enable context tracking
  await contextTracker.addContext(
    result.primaryContext, 
    pageData.url, 
    result.confidence
  );
  
  return result;
}

/**
 * Get context tracker instance
 */
export function getContextTracker(): ContextTracker {
  return contextTracker;
}