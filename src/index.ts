import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Config, loadConfig } from './config';
import { RequestIntent, detectIntentFromComment, routeRequestByIntent } from './intent';
import {
  createProblemStatement,
  executeSweAgent,
  processSweAgentResults,
  SWE_AGENT_OUTPUT_DIR_NAME
} from './sweAgent';
import { getGitHubContext, postComment, addReaction, GitHubContext, Reaction } from './github'; // Added Reaction type
import { formatResponse } from './responseFormatter'; // Import formatResponse
// import { runSweAgentDiagnostics } from './sweAgent'; // Still commented out as per summary

async function run(): Promise<void> {
  const startTime = Date.now();
  let config: Config | undefined;
  let githubContext: GitHubContext | undefined;

  try {
    core.info('🚀 SWE-Agent Issue Resolver (TypeScript) - Starting...');

    // 1. Load Configuration
    core.info('⚙️ Loading configuration...');
    config = loadConfig();
    core.info(`Trigger phrase: ${config.triggerPhrase}`);
    core.info(`Model name: ${config.modelName}`);

    // 2. Get GitHub Context (using our wrapper)
    githubContext = await getGitHubContext(); // Use our wrapper

    if (!githubContext.commentBody) {
      core.warning('No comment payload found or comment body is empty. Exiting.');
      return;
    }
    // Corrected: Use githubContext.actor instead of githubContext.commenter
    core.info(`Issue #${githubContext.issueNumber}, Comment by ${githubContext.actor}`);
    core.info(`Comment body: ${githubContext.commentBody}`);

    // 3. Check for Trigger Phrase
    if (!githubContext.commentBody.includes(config.triggerPhrase)) {
      core.info('Trigger phrase not found in comment. Exiting.');
      return;
    }
    core.info('🎯 Trigger phrase found!');

    // 4. Add Initial Reaction
    core.info('👍 Adding initial reaction...');
    if (githubContext.commentId) {
      // Corrected: addReaction now gets octokit and repo details internally
      await addReaction('eyes' as Reaction, githubContext.commentId);
    }

    // 5. Detect Intent
    core.info('🤔 Detecting intent from comment...');
    // Corrected: detectIntentFromComment takes no arguments and is async
    const intent: RequestIntent = await detectIntentFromComment();
    core.info(`Detected intent: ${intent}`);

    // 6. Route Request by Intent
    core.info('🚦 Routing request based on intent...');
    // Pass the already fetched githubContext
    const nonPatchResponse = await routeRequestByIntent(intent, config, githubContext);

    if (nonPatchResponse) {
      core.info(`💬 Posting ${intent} response to GitHub...`);
      const formattedResponse = formatResponse({
        intent,
        content: nonPatchResponse,
        githubContext,
        executionTime: `${(Date.now() - startTime) / 1000}s`,
        modelName: config.modelName,
      });
      await postComment(formattedResponse);
      core.info('✅ Non-patch request processed and response posted.');
      if (githubContext.commentId) {
        // Corrected: addReaction call
        await addReaction('rocket' as Reaction, githubContext.commentId);
      }
    } else if (intent === RequestIntent.Patch) {
      core.info('🔧 Processing patch intent with SWE-Agent...');

      const baseOutputDir = path.join(process.cwd(), 'swe_agent_runs');
      await fs.mkdir(baseOutputDir, { recursive: true });
      const instanceId = `${new Date().toISOString().replace(/:/g, '-')}-${githubContext.issueNumber}`;
      const instanceOutputDir = path.join(baseOutputDir, SWE_AGENT_OUTPUT_DIR_NAME, instanceId);
      await fs.mkdir(instanceOutputDir, { recursive: true });
      core.info(`📁 SWE-Agent instance output directory: ${instanceOutputDir}`);

      const problemStatementFile = await createProblemStatement(
        instanceOutputDir,
        githubContext.issueTitle || 'N/A', 
        githubContext.issueBody || '',   
        githubContext.commentBody
      );

      core.info('🤖 Executing SWE-Agent...');
      const repoDir = process.env.GITHUB_WORKSPACE || '/github/workspace';
      core.info(`Using repository directory: ${repoDir}`);
      
      const sweAgentStartTime = Date.now();
      const sweAgentResult = await executeSweAgent(
        config,
        repoDir,
        problemStatementFile,
        instanceOutputDir
      );
      const sweAgentEndTime = Date.now();
      const sweAgentExecutionTime = (sweAgentEndTime - sweAgentStartTime) / 1000;

      core.info('📝 Processing SWE-Agent results...');
      const finalReport = await processSweAgentResults(
        sweAgentResult,
        githubContext.issueNumber, // issueNumber can be undefined, handle in processSweAgentResults if necessary
        githubContext.issueTitle || 'N/A'
      );

      core.info('💬 Posting SWE-Agent report to GitHub...');
      const formattedPatchResponse = formatResponse({
        intent: RequestIntent.Patch, // Explicitly set intent for patch
        content: finalReport.patch || '', // Use finalReport.patch
        githubContext,
        executionTime: `${sweAgentExecutionTime}s`,
        modelName: config.modelName,
        patchStatistics: finalReport.stats, // Pass stats from sweAgentResult
        wasTruncated: finalReport.wasTruncated, // Pass truncation status
      });
      await postComment(formattedPatchResponse);

      if (finalReport.success) {
        core.info('✅ SWE-Agent completed successfully.');
        if (githubContext.commentId) {
          // Corrected: addReaction call
          await addReaction('rocket' as Reaction, githubContext.commentId);
        }
      } else {
        core.setFailed('SWE-Agent processing failed.');
        if (githubContext.commentId) {
          // Corrected: addReaction call
          await addReaction('confused' as Reaction, githubContext.commentId);
        }
      }
    } else {
      core.warning(`Intent "${intent}" was not processed by routing. Defaulting to no action.`);
      const fallbackResponse = formatResponse({
        intent: RequestIntent.Unknown, // Or a more specific fallback intent
        content: `I received your request with intent "${intent}", but I am not configured to handle it at this moment.`,
        githubContext,
        executionTime: `${(Date.now() - startTime) / 1000}s`,
        modelName: config.modelName,
      });
      await postComment(fallbackResponse);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    core.error(`Error in run: ${errorMessage}`); // Log error before attempting to post comment

    if (config && githubContext) { // Check if config and githubContext are defined
        try {
            const errMessageToPost = `The action failed with an error: ${errorMessage}`;
            core.info(`Attempting to post error to GitHub: ${errMessageToPost}`);
            const formattedErrorResponse = formatResponse({
              intent: RequestIntent.Unknown, // Or a specific error intent if defined
              content: errMessageToPost,
              githubContext,
              executionTime: `${(Date.now() - startTime) / 1000}s`, // Or a more relevant time
              modelName: config?.modelName || 'N/A',
            });
            await postComment(formattedErrorResponse);
            if (githubContext.commentId) {
            // Corrected: addReaction call
            await addReaction('confused' as Reaction, githubContext.commentId);
            }
        } catch (notificationError) {
            const notifErrMsg = notificationError instanceof Error ? notificationError.message : String(notificationError);
            core.error(`Failed to send error notification to GitHub: ${notifErrMsg}`);
        }
    } else {
        core.warning('Config or GitHub context not available to post error comment.');
    }

    core.setFailed(errorMessage);
  } finally {
    const endTime = Date.now();
    const totalExecutionTime = (endTime - startTime) / 1000;
    core.info(`🏁 SWE-Agent Issue Resolver finished in ${totalExecutionTime}s`);
  }
}

run();
