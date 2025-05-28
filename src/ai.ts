import { Config } from './config'; // Added Config import
import { getPrDiff, GitHubContext } from './github'; // Assuming getPrDiff is in github.ts
import { log, logError, logSuccess, logWarning } from './utils';
import fetch from 'node-fetch';

interface ApiCallOptions {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}

async function makeApiCall(
  url: string,
  method: 'POST' | 'GET',
  headers: Record<string, string>,
  body?: Record<string, any>
): Promise<any> {
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API call failed with status ${response.status}: ${errorBody}`);
  }
  return response.json();
}

// --- OpenAI API ---
async function callOpenAiApi(prompt: string, model: string, apiKey: string, options?: ApiCallOptions): Promise<string> {
  let apiModel = model;
  // Ensure model is a known OpenAI model or handle appropriately
  if (!['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4', 'openai/gpt-4o', 'openai/gpt-4-turbo', 'openai/gpt-3.5-turbo', 'openai/gpt-4'].includes(model)) {
    // Default or throw error if model is not supported by this specific function
    // For now, let's assume it might be a custom model name that OpenAI supports
    console.warn(`OpenAI model ${model} not in known list, proceeding anway.`);
  }
  const payload: Record<string, any> = {
    model: apiModel,
    messages: [{ role: 'user', content: prompt }],
    ...options,
  };
  if (['o3', 'o3-mini', 'o4-mini'].includes(apiModel)) {
    payload.temperature = 1;
    payload.top_p = 0;
  }
  const response = await makeApiCall(
    'https://api.openai.com/v1/chat/completions',
    'POST',
    {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    payload
  );
  return response?.choices?.[0]?.message?.content || '';
}

// --- Anthropic API ---
async function callAnthropicApi(prompt: string, model: string, apiKey: string, options?: ApiCallOptions): Promise<string> {
  let apiModel = model;
  // Add model validation or mapping if necessary for Anthropic
  // e.g., if (model === 'claude-2') apiModel = 'claude-2';
  const payload = {
    model: apiModel,
    prompt: `\\n\\nHuman: ${prompt}\\n\\nAssistant:`,
    max_tokens_to_sample: options?.max_tokens || 200000, // Anthropic specific
    temperature: options?.temperature,
    top_p: options?.top_p,
  };
  const response = await makeApiCall(
    'https://api.anthropic.com/v1/complete',
    'POST',
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    payload
  );
  return response?.completion || '';
}

// --- OpenRouter API ---
async function callOpenRouterApi(prompt: string, model: string, apiKey: string, options?: ApiCallOptions): Promise<string> {
  const siteUrl = 'https://github.com/nimishchaudhari/swe-agent-resolver'; // Replace with your actual site URL
  const payload = {
    model: model, // Model name as understood by OpenRouter
    messages: [{ role: 'user', content: prompt }],
    ...options,
  };
  const response = await makeApiCall(
    'https://openrouter.ai/api/v1/chat/completions',
    'POST',
    {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl, // Required by some models on OpenRouter
      'X-Title': 'SWE-Agent Resolver', // Optional, but good practice
    },
    payload
  );
  return response?.choices?.[0]?.message?.content || '';
}

// --- Gemini API ---
async function callGeminiApi(prompt: string, model: string, apiKey: string, options?: ApiCallOptions): Promise<string> {
  // Model name for Gemini might need stripping of prefix, e.g., 'gemini/gemini-pro' -> 'gemini-pro'
  const apiModel = model.startsWith('gemini/') ? model.split('/')[1] : model;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature,
      topP: options?.top_p,
      maxOutputTokens: options?.max_tokens,
    },
  };
  const response = await makeApiCall(
    `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`,
    'POST',
    { 'Content-Type': 'application/json' },
    payload
  );
  return response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// --- DeepSeek API ---
async function callDeepSeekApi(prompt: string, model: string, apiKey: string, options?: ApiCallOptions): Promise<string> {
  const payload: Record<string, any> = {
    model: model, // Model name as understood by DeepSeek
    messages: [{ role: 'user', content: prompt }],
    ...options,
  };
  const response = await makeApiCall(
    'https://api.deepseek.com/chat/completions',
    'POST',
    {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    payload
  );
  return response?.choices?.[0]?.message?.content || '';
}


export type ApiProvider = 'openai' | 'anthropic' | 'openrouter' | 'gemini' | 'deepseek';

export function getAvailableApiProviders(config: Config): ApiProvider[] {
  const providers: ApiProvider[] = [];
  if (config.openAiApiKey) providers.push('openai');
  if (config.anthropicApiKey) providers.push('anthropic');
  if (config.deepseekApiKey) providers.push('deepseek');
  if (config.openRouterApiKey) providers.push('openrouter');
  if (config.geminiApiKey) providers.push('gemini');
  return providers;
}

export function selectApiProviderForModel(model: string, config: Config): ApiProvider | undefined {
  if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-') || model.startsWith('o4-')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('deepseek') || model.includes('coder')) return 'deepseek';
  if (model.startsWith('gemini')) return 'gemini';
  
  // If model doesn't give a hint, try OpenRouter if available, then first available
  const available = getAvailableApiProviders(config);
  if (config.openRouterApiKey && available.includes('openrouter')) return 'openrouter';
  return available[0]; 
}

// --- Universal AI API Caller ---
export async function callAiApi(
  prompt: string,
  model: string,
  config: Config,
  _githubContext: GitHubContext, // githubContext is available but marked as unused if not directly needed here
  preferred_provider?: string
): Promise<string> {
  const provider = preferred_provider as ApiProvider || selectApiProviderForModel(model, config);
  const apiCallOptions: ApiCallOptions = {}; // Define it here
  if (config.modelTemperature !== undefined) apiCallOptions.temperature = config.modelTemperature;
  if (config.modelTopP !== undefined) apiCallOptions.top_p = config.modelTopP;
  if (config.modelMaxTokens !== undefined) apiCallOptions.max_tokens = config.modelMaxTokens;

  if (!provider) {
    throw new Error(`Could not determine API provider for model ${model}`);
  }

  // Ensure API keys are present before calling
  switch (provider) {
    case 'openai':
      if (!config.openAiApiKey) throw new Error('OpenAI API key is not configured.');
      return callOpenAiApi(prompt, model, config.openAiApiKey, apiCallOptions);
    case 'anthropic':
      if (!config.anthropicApiKey) throw new Error('Anthropic API key is not configured.');
      return callAnthropicApi(prompt, model, config.anthropicApiKey, apiCallOptions);
    case 'deepseek':
      if (!config.deepseekApiKey) throw new Error('DeepSeek API key is not configured.');
      return callDeepSeekApi(prompt, model, config.deepseekApiKey, apiCallOptions);
    case 'openrouter':
      if (!config.openRouterApiKey) throw new Error('OpenRouter API key is not configured.');
      return callOpenRouterApi(prompt, model, config.openRouterApiKey, apiCallOptions);
    case 'gemini':
      if (!config.geminiApiKey) throw new Error('Gemini API key is not configured.');
      return callGeminiApi(prompt, model, config.geminiApiKey, apiCallOptions);
    default:
      throw new Error(`Unsupported API provider: ${provider}`);
  }
}

// --- High-Level AI Functions (Examples) ---
// These functions demonstrate how to use callAiApi with more specific prompts or contexts.

export async function getRepositoryAnalysis(config: Config, githubContext: GitHubContext): Promise<string> {
  const prompt = "Analyze this repository structure and provide insights about its architecture, technologies used, and potential improvements.";
  // Pass githubContext if needed by callAiApi or its sub-functions, otherwise it can be omitted if not used
  return callAiApi(prompt, config.modelName, config, githubContext);
}

export async function getAiOpinion(comment: string, config: Config, githubContext: GitHubContext): Promise<string> {
  const prompt = `Provide an expert opinion and recommendations for: ${comment}`;
  return callAiApi(prompt, config.modelName, config, githubContext);
}

export async function generateVisualContentFromPrompt(request: string, config: Config, githubContext: GitHubContext): Promise<string> {
  const prompt = `Create visual content (mermaid diagram, ASCII art, or markdown visualization) for: ${request}`;
  return callAiApi(prompt, config.modelName, config, githubContext);
}

export async function generatePrReview(
  prNumber: number,
  reviewRequest: string,
  config: Config,
  githubContext: GitHubContext
): Promise<string> {
  log(`🤖 Generating PR review for PR #${prNumber}...`);
  const diffContent = await getPrDiff(prNumber); // getPrDiff now correctly called
  if (!diffContent) {
    return "Error: Could not fetch PR diff.";
  }
  const prompt = `Review this pull request diff and provide feedback:

Diff:
${diffContent}

Review request: ${reviewRequest}

Please provide a thorough code review with specific suggestions.`;
  return callAiApi(prompt, config.codeReviewModel || config.modelName, config, githubContext);
}

// --- Connectivity Test ---
export async function testApiConnectivity(config: Config, githubContext: GitHubContext): Promise<boolean> {
  const providers = getAvailableApiProviders(config);
  const testPrompt = "Hello, this is a connectivity test.";
  // Determine a generic model that's likely to work for testing, or use a specific test model from config
  const testModel = config.modelName || "gpt-3.5-turbo"; // Fallback to a common model
  let workingProviders: string[] = [];

  log("🔍 Testing API connectivity...");

  for (const provider of providers) {
    log(`  Testing ${provider}...`);
    try {
      // Pass githubContext here
      const response = await callAiApi(testPrompt, testModel, config, githubContext, provider);
      if (response && !response.startsWith("Error:")) {
        workingProviders.push(provider);
        logSuccess(`  ✅ ${provider}: Connected`);
      } else {
        logWarning(`  ⚠️ ${provider}: Connected but got error response: ${response}`);
      }
    } catch (error) {
      logError(`  ❌ ${provider}: Failed - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (workingProviders.length > 0) {
    logSuccess(`✅ Working API providers: ${workingProviders.join(', ')}`);
    return true;
  } else {
    logError("No working API providers found after testing.");
    return false;
  }
}