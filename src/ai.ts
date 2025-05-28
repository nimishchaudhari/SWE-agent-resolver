import { Config } from './config';
import { getPrDiff, GitHubContext } from './github';
import { log, logError, logSuccess, logWarning } from './utils';
import fetch from 'node-fetch';

interface ApiCallOptions {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  // Add other common options if needed, e.g., stream, stop sequences
}

async function makeApiCall(
  url: string,
  method: 'POST' | 'GET',
  headers: Record<string, string>,
  body?: Record<string, any>
): Promise<any> {
  log(`📞 Making API call: ${method} ${url}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal as any, // AbortSignal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      logError(`API call failed: ${response.status} ${response.statusText} - ${errorBody}`);
      throw new Error(`API call to ${url} failed with status ${response.status}: ${errorBody}`);
    }
    const responseData = await response.json();
    logSuccess(`API call successful: ${method} ${url}`);
    return responseData;
  } catch (error) {
    logError(`Error during API call to ${url}: ${error instanceof Error ? error.message : String(error)}`);
    throw error; // Re-throw to be caught by the caller
  }
}

// --- OpenAI API ---
async function callOpenAiApi(prompt: string, model: string, apiKey: string, options?: ApiCallOptions): Promise<string> {
  let apiModel = model;
  // Strip "openai/" prefix if present
  if (model.startsWith('openai/')) {
    apiModel = model.substring('openai/'.length);
  }

  // Validate model or use a default if necessary
  const knownOpenAiModels = ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview', 'gpt-4-0125-preview', 'gpt-4-1106-preview'];
  if (!knownOpenAiModels.includes(apiModel) && !apiModel.startsWith('ft:gpt-3.5-turbo')) { // Allow fine-tuned models
    logWarning(`OpenAI model '${apiModel}' not in known list. Proceeding, but check compatibility.`);
  }

  const payload: Record<string, any> = {
    model: apiModel,
    messages: [{ role: 'user', content: prompt }],
    ...options,
  };

  // Specific OpenAI model family adjustments (example from legacy)
  if (['o3', 'o3-mini', 'o4-mini'].includes(apiModel)) { // These seem like custom aliases, ensure they map to actual OpenAI models
    payload.temperature = 1;
    payload.top_p = 0;
    logWarning(`Applying specific temperature/top_p for legacy model alias '${apiModel}'. Ensure this maps to a valid OpenAI model.`);
  }
  
  log(`✉️ OpenAI Request Payload: ${JSON.stringify(payload, null, 2)}`);
  const response = await makeApiCall(
    'https://api.openai.com/v1/chat/completions',
    'POST',
    {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    payload
  );
  const content = response?.choices?.[0]?.message?.content || '';
  if (!content) {
    logWarning('OpenAI API returned an empty content response.');
  }
  return content;
}

// --- Anthropic API ---
async function callAnthropicApi(prompt: string, model: string, apiKey: string, options?: ApiCallOptions): Promise<string> {
  let apiModel = model;
  if (model.startsWith('anthropic/')) {
    apiModel = model.substring('anthropic/'.length);
  }
  // Add model validation or mapping if necessary for Anthropic
  const knownAnthropicModels = ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-2.1', 'claude-2.0', 'claude-instant-1.2'];
  if (!knownAnthropicModels.includes(apiModel)) {
      logWarning(`Anthropic model '${apiModel}' not in known list. Proceeding, but check compatibility.`);
  }

  const payload = {
    model: apiModel,
    messages: [{ role: 'user', content: prompt }], // Using messages API for newer models
    max_tokens: options?.max_tokens || 4096, // Anthropic specific, ensure it's appropriate
    temperature: options?.temperature,
    top_p: options?.top_p,
  };
  log(`✉️ Anthropic Request Payload: ${JSON.stringify(payload, null, 2)}`);

  const response = await makeApiCall(
    'https://api.anthropic.com/v1/messages', // Updated to messages API
    'POST',
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    payload
  );
  // The response structure for messages API is different
  const content = response?.content?.[0]?.text || '';
   if (!content) {
    logWarning('Anthropic API returned an empty content response.');
  }
  return content;
}

// --- OpenRouter API ---
async function callOpenRouterApi(prompt: string, model: string, apiKey: string, options?: ApiCallOptions): Promise<string> {
  const siteUrl = 'https://github.com/swe-agent/swe-agent-resolver'; // Updated to the actual repo
  const payload = {
    model: model, // Model name as understood by OpenRouter (e.g., "anthropic/claude-3-haiku")
    messages: [{ role: 'user', content: prompt }],
    ...options,
  };
  log(`✉️ OpenRouter Request Payload: ${JSON.stringify(payload, null, 2)}`);
  const response = await makeApiCall(
    'https://openrouter.ai/api/v1/chat/completions',
    'POST',
    {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl, 
      'X-Title': 'SWE Agent Resolver', 
    },
    payload
  );
  const content = response?.choices?.[0]?.message?.content || '';
  if (!content) {
    logWarning('OpenRouter API returned an empty content response.');
  }
  return content;
}

// --- Gemini API ---
async function callGeminiApi(prompt: string, model: string, apiKey: string, options?: ApiCallOptions): Promise<string> {
  const apiModel = model.startsWith('gemini/') ? model.split('/')[1] : model;
  // Validate model
  const knownGeminiModels = ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-1.0-pro', 'gemini-pro-vision'];
   if (!knownGeminiModels.includes(apiModel)) {
      logWarning(`Gemini model '${apiModel}' not in known list. Proceeding, but check compatibility.`);
  }

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature,
      topP: options?.top_p,
      maxOutputTokens: options?.max_tokens || 8192, // Default for Gemini 1.5 Pro
    },
  };
  log(`✉️ Gemini Request Payload: ${JSON.stringify(payload, null, 2)}`);
  const response = await makeApiCall(
    `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`,
    'POST',
    { 'Content-Type': 'application/json' },
    payload
  );
  const content = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!content) {
    logWarning('Gemini API returned an empty content response.');
  }
  return content;
}

// --- DeepSeek API ---
async function callDeepSeekApi(prompt: string, model: string, apiKey: string, options?: ApiCallOptions): Promise<string> {
  let apiModel = model;
  if (model.startsWith('deepseek/')) {
    apiModel = model.substring('deepseek/'.length);
  }
  const knownDeepSeekModels = ['deepseek-coder', 'deepseek-chat']; // Add more as they become known
  if (!knownDeepSeekModels.includes(apiModel)) {
      logWarning(`DeepSeek model '${apiModel}' not in known list. Proceeding, but check compatibility.`);
  }

  const payload: Record<string, any> = {
    model: apiModel, 
    messages: [{ role: 'user', content: prompt }],
    ...options,
  };
  log(`✉️ DeepSeek Request Payload: ${JSON.stringify(payload, null, 2)}`);
  const response = await makeApiCall(
    'https://api.deepseek.com/chat/completions',
    'POST',
    {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    payload
  );
  const content = response?.choices?.[0]?.message?.content || '';
  if (!content) {
    logWarning('DeepSeek API returned an empty content response.');
  }
  return content;
}


export type ApiProvider = 'openai' | 'anthropic' | 'openrouter' | 'gemini' | 'deepseek';

export function getAvailableApiProviders(config: Config): ApiProvider[] {
  const providers: ApiProvider[] = [];
  if (config.openAiApiKey) providers.push('openai');
  if (config.anthropicApiKey) providers.push('anthropic');
  if (config.deepseekApiKey) providers.push('deepseek');
  if (config.openRouterApiKey) providers.push('openrouter');
  if (config.geminiApiKey) providers.push('gemini');
  log(`Available API providers based on keys: ${providers.join(', ')}`);
  return providers;
}

export function selectApiProviderForModel(model: string, config: Config): ApiProvider | undefined {
  const modelLower = model.toLowerCase();
  
  // Direct provider checks based on model prefix
  if (modelLower.startsWith('gpt-') || modelLower.startsWith('openai/gpt-') || modelLower.startsWith('o1-') || modelLower.startsWith('o3-') || modelLower.startsWith('o4-')) {
    if (config.openAiApiKey) return 'openai';
  }
  if (modelLower.startsWith('claude-') || modelLower.startsWith('anthropic/claude-')) {
    if (config.anthropicApiKey) return 'anthropic';
  }
  if (modelLower.startsWith('deepseek') || modelLower.includes('coder') || modelLower.startsWith('deepseek/')) {
    if (config.deepseekApiKey) return 'deepseek';
  }
  if (modelLower.startsWith('gemini') || modelLower.startsWith('google/gemini')) {
    if (config.geminiApiKey) return 'gemini';
  }

  // If model doesn't give a clear hint, or the preferred provider key is missing,
  // try OpenRouter if its key is available, as it supports many models.
  const available = getAvailableApiProviders(config);
  if (config.openRouterApiKey && available.includes('openrouter')) {
    log(`Model '${model}' did not match a specific provider or key was missing; attempting OpenRouter.`);
    return 'openrouter';
  }
  
  // Fallback to the first available provider if OpenRouter is not an option
  if (available.length > 0) {
    log(`Model '${model}' did not match a specific provider or key was missing, and OpenRouter not available/configured. Falling back to first available: ${available[0]}.`);
    return available[0];
  }
  
  logWarning(`Could not select an API provider for model: ${model}. No API keys configured or model not recognized.`);
  return undefined;
}

// --- Universal AI API Caller ---
export async function callAiApi(
  prompt: string,
  model: string,
  config: Config,
  _githubContext: GitHubContext, // Mark as unused if not directly needed
  preferred_provider?: string // This can be ApiProvider or any string from config
): Promise<string> {
  // Use preferred_provider from config if available and valid, otherwise determine by model
  const providerKeyFromConfig = config.apiProvider?.toLowerCase();
  let provider: ApiProvider | undefined;

  if (preferred_provider && getAvailableApiProviders(config).includes(preferred_provider as ApiProvider)) {
    provider = preferred_provider as ApiProvider;
    log(`Using explicitly preferred provider: ${provider}`);
  } else if (providerKeyFromConfig && getAvailableApiProviders(config).includes(providerKeyFromConfig as ApiProvider)) {
    provider = providerKeyFromConfig as ApiProvider;
    log(`Using provider from config.apiProvider: ${provider}`);
  } else {
    provider = selectApiProviderForModel(model, config);
    log(`Selected provider based on model '${model}': ${provider}`);
  }

  if (!provider) {
    const errorMsg = `No suitable API provider could be determined or configured for model '${model}'. Check API keys and model name.`;
    logError(errorMsg);
    // Post a comment to GitHub if possible
    // This part is tricky as callAiApi is used by intent.ts which is used by index.ts which posts comments. Avoid circular dependencies or duplicate error messages.
    // For now, just throw, and let the top-level error handler in index.ts deal with user notification.
    throw new Error(errorMsg);
  }

  const apiCallOptions: ApiCallOptions = {};
  if (config.modelTemperature !== undefined) apiCallOptions.temperature = config.modelTemperature;
  if (config.modelTopP !== undefined) apiCallOptions.top_p = config.modelTopP;
  if (config.modelMaxTokens !== undefined) apiCallOptions.max_tokens = config.modelMaxTokens;

  log(`Attempting to call AI with provider: ${provider}, model: ${model}`);

  try {
    switch (provider) {
      case 'openai':
        if (!config.openAiApiKey) throw new Error('OpenAI API key is not configured.');
        return await callOpenAiApi(prompt, model, config.openAiApiKey, apiCallOptions);
      case 'anthropic':
        if (!config.anthropicApiKey) throw new Error('Anthropic API key is not configured.');
        // Anthropic models might be passed with provider prefix by OpenRouter, strip it.
        const anthropicModel = model.startsWith('anthropic/') ? model.substring('anthropic/'.length) : model;
        return await callAnthropicApi(prompt, anthropicModel, config.anthropicApiKey, apiCallOptions);
      case 'deepseek':
        if (!config.deepseekApiKey) throw new Error('DeepSeek API key is not configured.');
        const deepseekModel = model.startsWith('deepseek/') ? model.substring('deepseek/'.length) : model;
        return await callDeepSeekApi(prompt, deepseekModel, config.deepseekApiKey, apiCallOptions);
      case 'openrouter':
        if (!config.openRouterApiKey) throw new Error('OpenRouter API key is not configured.');
        // OpenRouter expects model names with prefixes, e.g., "anthropic/claude-3-haiku"
        return await callOpenRouterApi(prompt, model, config.openRouterApiKey, apiCallOptions);
      case 'gemini':
        if (!config.geminiApiKey) throw new Error('Gemini API key is not configured.');
        const geminiModel = model.startsWith('google/') ? model.substring('google/'.length) : model; // OpenRouter might use google/gemini...
        return await callGeminiApi(prompt, geminiModel, config.geminiApiKey, apiCallOptions);
      default:
        // This should not be reached if provider selection is correct
        const exhaustiveCheck: never = provider; 
        throw new Error(`Unsupported API provider: ${exhaustiveCheck}`);
    }
  } catch (error) {
    logError(`Error calling AI API via ${provider} for model ${model}: ${error instanceof Error ? error.message : String(error)}`);
    // Consider if a fallback to another provider is desired here, or just rethrow.
    // For now, rethrow to be handled by the caller.
    throw error;
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
  // Use githubContext.octokit for API calls if getPrDiff needs it, or pass necessary details.
  // Assuming getPrDiff is self-contained or uses its own context.
  const diffContent = await getPrDiff(prNumber); 
  if (!diffContent) {
    logError("Could not fetch PR diff for review generation.");
    return "Error: Could not fetch PR diff. Unable to generate review.";
  }
  const prompt = `Review this pull request diff and provide feedback:\n\nDiff:\n${diffContent}\n\nReview request: ${reviewRequest}\n\nPlease provide a thorough code review with specific suggestions. Focus on code quality, potential bugs, security vulnerabilities, performance, and adherence to best practices.`;
  // Use a specific code review model if configured, otherwise fallback to the general model.
  const modelForReview = config.codeReviewModel || config.modelName;
  log(`Using model for PR review: ${modelForReview}`);
  return callAiApi(prompt, modelForReview, config, githubContext);
}

// --- Connectivity Test ---
export async function testApiConnectivity(config: Config, githubContext: GitHubContext): Promise<boolean> {
  const providersToTest = getAvailableApiProviders(config);
  if (providersToTest.length === 0) {
    logWarning("No API providers configured with API keys. Skipping connectivity test.");
    return false;
  }

  const testPrompt = "Hello, this is a connectivity test. Please respond with 'Success'.";
  // Determine a generic model that's likely to work for testing for each provider
  // Or use a specific test model from config if available
  
  let workingProviders: string[] = [];
  log("🔍 Testing API connectivity for configured providers...");

  for (const provider of providersToTest) {
    log(`  Testing ${provider}...`);
    let testModelForProvider = config.modelName; // Default to general model

    // Select a common/default model for each provider for testing
    // This ensures the test uses a model likely to be supported by that provider
    // and doesn't rely on the main 'modelName' which might be specific to one provider or OpenRouter
    switch(provider) {
        case 'openai': testModelForProvider = 'gpt-3.5-turbo'; break;
        case 'anthropic': testModelForProvider = 'claude-3-haiku-20240307'; break;
        case 'deepseek': testModelForProvider = 'deepseek-chat'; break;
        case 'gemini': testModelForProvider = 'gemini-1.5-flash-latest'; break;
        case 'openrouter': 
            // For OpenRouter, a bit trickier. We need a model OpenRouter itself knows.
            // Let's try a commonly available one. If config.modelName is an OpenRouter model, use that.
            if (config.modelName.includes('/')) { // Heuristic for OpenRouter model format
                testModelForProvider = config.modelName;
            } else {
                testModelForProvider = 'openai/gpt-3.5-turbo'; // A safe bet on OpenRouter
            }
            break;
    }
    log(`    Using test model for ${provider}: ${testModelForProvider}`);

    try {
      // Pass githubContext and the specific provider to test
      const response = await callAiApi(testPrompt, testModelForProvider, config, githubContext, provider);
      if (response && response.toLowerCase().includes("success")) { // Check for "Success" in response
        workingProviders.push(provider);
        logSuccess(`  ✅ ${provider}: Connected and received expected response.`);
      } else if (response) {
        logWarning(`  ⚠️ ${provider}: Connected but got unexpected response: "${response.substring(0,100)}..."`);
      } else {
         logWarning(`  ⚠️ ${provider}: Connected but got an empty response.`);
      }
    } catch (error) {
      logError(`  ❌ ${provider}: Failed - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (workingProviders.length > 0) {
    logSuccess(`✅ Working API providers: ${workingProviders.join(', ')}`);
    return true;
  } else {
    logError("❌ No working API providers found after testing all configured providers.");
    return false;
  }
}