import { log, logWarning, logSuccess } from './utils';
import { getGitHubContext, GitHubContext } from './github';
import { callAiApi } from './ai';
import { Config } from './config';

export enum RequestIntent {
  Patch = 'PATCH',
  Analysis = 'ANALYSIS',
  Opinion = 'OPINION',
  Visual = 'VISUAL',
  PRReview = 'PR_REVIEW',
  Unknown = 'UNKNOWN',
}

export function detectRequestIntent(comment: string | undefined, contextMode: string): RequestIntent {
  if (!comment) {
    return RequestIntent.Patch; // Default intent if no comment
  }

  const lowerComment = comment.toLowerCase();

  // PR Review specific keywords (highest priority for PR contexts)
  if (contextMode.startsWith('pr_') && /(review|lgtm|approve|request.*change|block|nitpick|style|lint|test.*coverage|security.*check|performance.*review|code.*quality|merge.*safe|breaking.*change|backward.*compat)/.test(lowerComment)) {
    return RequestIntent.PRReview;
  }
  // Visual content keywords
  if (/(chart|plot|graph|diagram|visualize|visualization|picture|image|screenshot|draw|show.*me.*visual)/.test(lowerComment)) {
    return RequestIntent.Visual;
  }
  // Analysis keywords
  if (/(analyze|analysis|explain|understand|investigate|examine|review|assess|evaluate|why|how.*work|what.*happen)/.test(lowerComment)) {
    return RequestIntent.Analysis;
  }
  // Opinion/advice keywords
  if (/(opinion|advice|suggest|recommend|think|thoughts|what.*do.*you|should.*i|best.*practice|approach|strategy)/.test(lowerComment)) {
    return RequestIntent.Opinion;
  }
  // Code fix keywords (default when explicit or if nothing else matches and comment is present)
  if (/(fix|patch|solve|resolve|implement|code|bug|error|issue)/.test(lowerComment) || comment.trim().length > 0) {
    return RequestIntent.Patch;
  }

  return RequestIntent.Patch; // Fallback to patch if specific keywords are not found but comment exists
}


export async function generateVisualContent(contentType: 'mermaid' | 'ascii' | 'code', description: string, _format?: string): Promise<string> {
  // This function might call a specialized AI model or use templates.
  // For now, let's format it simply as in the shell script.
  switch (contentType) {
    case 'mermaid':
      return `\`\`\`mermaid\n${description}\n\`\`\``;
    case 'ascii':
      return `\`\`\`\n${description}\n\`\`\``;
    case 'code':
      return `\`\`\`python
# Generated visualization code by SWE-Agent
${description}
\`\`\``; // Assuming python, adjust if needed
    default:
      return `Unsupported visual content type: ${contentType}`;
  }
}

interface NonPatchRequestParams {
  intent: RequestIntent;
  commentBody?: string;
  issueTitle?: string;
  issueBody?: string;
  prNumber?: number;
  prTitle?: string;
  prBody?: string;
  modelName: string;
  config: Config;
  githubContext: GitHubContext;
}

export async function handleNonPatchRequest(params: NonPatchRequestParams): Promise<string | null> {
  const { intent, commentBody, issueTitle, issueBody, prNumber, prTitle, prBody, modelName, config, githubContext } = params;

  let analysisPrompt = '';
  const commonContext = githubContext.isPullRequest
    ? `Pull Request #${prNumber}: ${prTitle}\nDescription: ${prBody}`
    : `Issue #${githubContext.issueNumber}: ${issueTitle}\nDescription: ${issueBody}`;

  switch (intent) {
    case RequestIntent.Opinion:
      analysisPrompt = `As an experienced software engineer, provide your opinion and recommendations for this:\n\n${commonContext}\nUser Request: ${commentBody}\n\nPlease provide thoughtful advice, best practices, and recommendations. Focus on practical guidance rather than code generation.`;
      break;
    case RequestIntent.Analysis:
      analysisPrompt = `As an expert code analyst, analyze this software issue/PR:\n\n${commonContext}\nUser Request: ${commentBody}\n\nPlease provide a technical analysis covering architecture, performance, security, and maintainability aspects. Explain the underlying causes and implications.`;
      break;
    case RequestIntent.Visual:
      analysisPrompt = `Create visual content to help explain this software issue/PR:\n\n${commonContext}\nUser Request: ${commentBody}\n\nGenerate diagrams, charts, or visual representations using Mermaid syntax, ASCII art, or code examples that would help visualize the problem or solution.`;
      break;
    case RequestIntent.PRReview:
      // For PR Review, we might want to fetch the diff separately and include it.
      // This is a simplified version based on the shell script's prompt.
      analysisPrompt = `As an expert code reviewer, conduct a comprehensive pull request review:\n\nPull Request: ${prTitle} (#${prNumber})\nDescription: ${prBody}\nReview Request: ${commentBody}\n\nPlease provide a thorough code review covering:\n1. **Code Quality**: Architecture, design patterns, readability, maintainability\n2. **Security**: Potential vulnerabilities, input validation, error handling\n3. **Performance**: Efficiency, resource usage, scalability considerations\n4. **Testing**: Test coverage, edge cases, integration testing\n5. **Best Practices**: Coding standards, documentation, style consistency\n6. **Merge Safety**: Breaking changes, backward compatibility, deployment impact\n\nProvide specific recommendations and an overall merge recommendation (Approved/Approved with Suggestions/Changes Requested).`;
      break;
    default:
      logWarning(`handleNonPatchRequest called with invalid intent: ${intent}`);
      return null;
  }

  log(`🔗 Calling AI API for ${intent} response...`);
  try {
    // Corrected: Pass githubContext directly
    const responseContent = await callAiApi(analysisPrompt, modelName, config, githubContext);
    if (responseContent && responseContent.trim().length > 10) {
      logSuccess(`Successfully generated ${intent} response (${responseContent.length} characters)`);
      return responseContent;
    } else {
      logWarning(`AI API returned empty or too short response for ${intent}.`);
      return "I apologize, but I couldn't generate a meaningful response for your request at this time.";
    }
  } catch (error) {
    logWarning(`Error calling AI API for ${intent}: ${error instanceof Error ? error.message : String(error)}`);
    return `I apologize, but I encountered an error while trying to process your ${intent} request. Please try again later.`;
  }
}

export async function detectIntentFromComment(): Promise<RequestIntent> {
  const { commentBody, detectedContextType } = await getGitHubContext();
  const intent = detectRequestIntent(commentBody, detectedContextType);
  log(`Detected intent: ${intent}`);
  return intent;
}

/**
 * Routes the request based on intent.
 * @returns A string if a non-patch request was handled (contains the AI response), 
 *          null if it's a patch request (to proceed with SWE-Agent), 
 *          or an error message string if non-patch handling failed.
 */
export async function routeRequestByIntent(
    intent: RequestIntent,
    config: Config,
    githubContext: GitHubContext
  ): Promise<string | null> {

  switch (intent) {
    case RequestIntent.Patch:
      log('🔧 Routing to full SWE-Agent patch generation...');
      return null; // Indicates to continue with SWE-Agent execution

    case RequestIntent.Opinion:
    case RequestIntent.Analysis:
    case RequestIntent.Visual:
    case RequestIntent.PRReview:
      log(`🚀 Using lightweight AI processing for ${intent} request`);
      const result = await handleNonPatchRequest({
        intent,
        commentBody: githubContext.commentBody,
        issueTitle: githubContext.issueTitle,
        issueBody: githubContext.issueBody,
        prNumber: githubContext.prNumber,
        prTitle: githubContext.prTitle,
        prBody: githubContext.prBody,
        modelName: config.modelName, // Assuming modelName is part of Config
        config,
        githubContext
      });
      
      if (result) {
        return result; // Return the AI-generated content
      } else {
        logWarning(`Failed to generate ${intent} response through lightweight processing.`);
        return `I tried to handle your ${intent} request, but an issue occurred. You might want to try rephrasing or I can attempt a patch.`; 
      }

    default:
      logWarning(`Unknown intent in routeRequestByIntent: ${intent} - defaulting to patch generation`);
      return null; // Default to SWE-Agent execution for unknown intents
  }
}
