/**
 * Validates and migrates model names to ensure compatibility with local Ollama.
 * This prevents stale '4b' names from previous versions from being sent to the API.
 */
export function validateModel(model: string | null | undefined): string {
  if (!model || model === 'auto') return 'auto';
  // Migration: 4b (old/incorrect) -> e4b (correct)
  if (model === 'gemma4:4b') return 'gemma4:e4b';
  // Allow list of valid models
  const validModels = ['gemma4:e4b', 'gemma4:26b'];
  return validModels.includes(model) ? model : 'auto';
}

/**
 * Normalizes the Ollama URL.
 * Following your environment requirement: The URL MUST include the /api suffix.
 */
export function normalizeOllamaUrl(url: string | undefined): string {
  const defaultUrl = "http://localhost:11434/api";
  if (!url) return defaultUrl;
  
  let normalized = url.trim();
  // Remove trailing slashes only
  normalized = normalized.replace(/\/+$/, "");
  
  // Ensure it ends with /api if it's missing, but definitely don't remove it.
  if (!normalized.endsWith("/api")) {
    normalized = `${normalized}/api`;
  }
  
  return normalized;
}
