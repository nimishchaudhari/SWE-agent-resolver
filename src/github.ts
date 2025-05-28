import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/core';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import { log, logError, logWarning, logSuccess, runShellCommand } from './utils';

const MyOctokit = Octokit.plugin(restEndpointMethods);

export interface GitHubContext {
  octokit: InstanceType<typeof MyOctokit>;
  token: string;
  apiUrl: string;
  repoOwner: string;
  repoName: string;
  issueNumber?: number;
  commentId?: number;
  eventName: string;
  payload: typeof github.context.payload;
  sha: string;
  ref: string;
  actor: string;
  runId: number;
  // Enhanced context fields
  detectedContextType: DetectedContextType;
  commentBody?: string;
  issueTitle?: string;
  issueBody?: string;
  prNumber?: number;
  prTitle?: string;
  prBody?: string;
  prHeadSha?: string;
  prBaseSha?: string;
  prHeadRef?: string;
  prBaseRef?: string;
  isPullRequest: boolean;
}

export type DetectedContextType =
  | 'pr_comment'
  | 'issue_comment'
  | 'pr_review_comment'
  | 'pr_review'
  | 'pr_description' // When the trigger is a PR itself (e.g. its description)
  | 'pull_request' // General PR event
  | 'issue' // General issue event
  | 'unknown';

let memoizedContext: GitHubContext | null = null;

export async function getGitHubContext(): Promise<GitHubContext> {
  if (memoizedContext) {
    return memoizedContext;
  }

  const token = core.getInput('GITHUB_TOKEN', { required: true });
  const octokit = new MyOctokit({ auth: token });

  const { repo: { owner: repoOwner, repo: repoName }, issue, payload, eventName, sha, ref, actor, runId } = github.context;
  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';

  let detectedContextType: DetectedContextType = 'unknown';
  let commentBody = payload.comment?.body;
  let commentId = payload.comment?.id;
  let issueNumber = issue?.number; // This can be undefined
  let issueTitle = payload.issue?.title;
  let issueBody = payload.issue?.body;
  // Ensure prNumber is explicitly typed as number | undefined initially
  let prNumber: number | undefined = payload.pull_request?.number || issue?.number; 
  let prTitle = payload.pull_request?.title;
  let prBody = payload.pull_request?.body;
  let prHeadSha = payload.pull_request?.head.sha;
  let prBaseSha = payload.pull_request?.base.sha;
  let prHeadRef = payload.pull_request?.head.ref;
  let prBaseRef = payload.pull_request?.base.ref;
  const isPullRequest = eventName.startsWith('pull_request');

  // Refine context detection based on eventName and payload
  switch (eventName) {
    case 'issue_comment':
      if (payload.issue?.pull_request) {
        detectedContextType = 'pr_comment';
        // issue.number is guaranteed if payload.issue.pull_request exists
        prNumber = payload.issue!.number; 
      } else {
        detectedContextType = 'issue_comment';
      }
      // issueNumber is already set from github.context.issue.number
      // No change needed for issueNumber here, it remains number | undefined
      break;
    case 'pull_request_review_comment':
      detectedContextType = 'pr_review_comment';
      // payload.pull_request.number is guaranteed in this event context
      prNumber = payload.pull_request!.number;
      commentBody = payload.comment?.body;
      commentId = payload.comment?.id;
      break;
    case 'pull_request_review':
      detectedContextType = 'pr_review';
      // payload.pull_request.number is guaranteed in this event context
      prNumber = payload.pull_request!.number;
      commentBody = payload.review?.body; 
      commentId = payload.review?.id;
      break;
    case 'pull_request':
    case 'pull_request_target':
      detectedContextType = payload.action === 'opened' || payload.action === 'edited' ? 'pr_description' : 'pull_request';
      // payload.pull_request.number is guaranteed in this event context
      prNumber = payload.pull_request!.number;
      if (detectedContextType === 'pr_description') {
        commentBody = payload.pull_request?.body;
      }
      break;
    case 'issues':
      detectedContextType = 'issue';
      // payload.issue.number is guaranteed in this event context
      issueNumber = payload.issue!.number;
      break;
    default:
      logWarning(`Unknown event name: ${eventName}. Context detection may be inaccurate.`);
      detectedContextType = 'unknown';
  }

  // Ensure issueNumber is set if prNumber is available, and prNumber is now correctly number | undefined
  if (prNumber && !issueNumber) {
    issueNumber = prNumber; 
  }

  // When assigning to memoizedContext, types must match.
  // GitHubContext defines issueNumber and prNumber as optional (number | undefined)
  // So, direct assignment is fine now.
  memoizedContext = {
    octokit,
    token,
    apiUrl,
    repoOwner,
    repoName,
    issueNumber, // Now correctly number | undefined
    commentId,
    eventName,
    payload,
    sha,
    ref,
    actor,
    runId,
    detectedContextType,
    commentBody,
    issueTitle,
    issueBody,
    prNumber, // Now correctly number | undefined
    prTitle,
    prBody,
    prHeadSha,
    prBaseSha,
    prHeadRef,
    prBaseRef,
    isPullRequest,
  };
  logContextInfo(memoizedContext);
  return memoizedContext;
}

// --- GitHub API Functions ---
export async function postComment(message: string): Promise<number | undefined> {
  const { octokit, repoOwner, repoName, issueNumber } = await getGitHubContext();
  if (!issueNumber) {
    logError('Cannot post comment: Issue number is undefined.');
    return undefined;
  }
  try {
    const response = await octokit.rest.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
      body: message,
    });
    logSuccess(`Comment posted successfully. Comment ID: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    logError(`Failed to post comment: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

export async function updateComment(commentIdToUpdate: number, message: string): Promise<void> {
  const { octokit, repoOwner, repoName } = await getGitHubContext();
  try {
    await octokit.rest.issues.updateComment({
      owner: repoOwner,
      repo: repoName,
      comment_id: commentIdToUpdate,
      body: message,
    });
    logSuccess(`Comment ${commentIdToUpdate} updated successfully.`);
  } catch (error) {
    logWarning(`Failed to update comment ${commentIdToUpdate}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export type Reaction =
  | '+1'
  | '-1'
  | 'laugh'
  | 'confused'
  | 'heart'
  | 'hooray'
  | 'rocket'
  | 'eyes';

export async function addReaction(reaction: Reaction, commentIdToReact?: number): Promise<void> {
  const { octokit, repoOwner, repoName, commentId: currentCommentId } = await getGitHubContext();
  const targetCommentId = commentIdToReact || currentCommentId;

  if (!targetCommentId) {
    logWarning('Cannot add reaction: Comment ID is undefined.');
    return;
  }
  try {
    await octokit.rest.reactions.createForIssueComment({
      owner: repoOwner,
      repo: repoName,
      comment_id: targetCommentId,
      content: reaction,
    });
    // logSuccess(`Reaction '${reaction}' added to comment ${targetCommentId}.`); // Often too verbose
  } catch (error) {
    logWarning(`Failed to add reaction '${reaction}' to comment ${targetCommentId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export type ContextualReactionType =
  | 'success_patch'
  | 'success_analysis'
  | 'success_opinion'
  | 'success_visual'
  | 'success_pr_review'
  | 'pr_review_approved'
  | 'pr_review_changes_requested'
  | 'pr_review_suggestions'
  | 'timeout'
  | 'killed'
  | 'api_error'
  | 'general_error'
  | 'processing'
  | 'analyzing'
  | 'pr_reviewing';

export async function addContextualReaction(context: ContextualReactionType, commentIdToReact?: number): Promise<void> {
  let reaction: Reaction;
  switch (context) {
    case 'success_patch': reaction = 'rocket'; break;
    case 'success_analysis': reaction = 'hooray'; break; // Using hooray as a general success
    case 'success_opinion': reaction = 'heart'; break;
    case 'success_visual': reaction = '+1'; break;
    case 'success_pr_review': reaction = 'rocket'; break;
    case 'pr_review_approved': reaction = '+1'; break;
    case 'pr_review_changes_requested': reaction = '-1'; break;
    case 'pr_review_suggestions': reaction = 'eyes'; break;
    case 'timeout': reaction = 'confused'; break; // No hourglass_flowing_sand in standard reactions
    case 'killed': reaction = 'confused'; break; // No skull_and_crossbones
    case 'api_error': reaction = 'confused'; break;
    case 'general_error': reaction = 'confused'; break;
    case 'processing': reaction = 'eyes'; break;
    case 'analyzing': reaction = 'eyes'; break;
    case 'pr_reviewing': reaction = 'eyes'; break;
    default: reaction = 'confused';
  }
  await addReaction(reaction, commentIdToReact);
}

// --- Context Determination Functions ---
export type GitReferenceMode = 'auto' | 'pr_head' | 'pr_base' | 'latest' | string; // string for custom ref
export type TargetBranchStrategy = 'auto' | 'pr_base' | 'default' | string; // string for custom branch

export async function determineGitReference(referenceMode: GitReferenceMode): Promise<string> {
  const { detectedContextType, prHeadSha, sha } = await getGitHubContext();
  let gitRef = 'HEAD';

  switch (referenceMode) {
    case 'auto':
      switch (detectedContextType) {
        case 'pr_review':
        case 'pr_review_comment':
        case 'pr_comment':
        case 'pull_request':
        case 'pr_description':
          gitRef = prHeadSha || 'HEAD';
          break;
        default:
          gitRef = sha || 'HEAD';
          break;
      }
      break;
    case 'pr_head':
      gitRef = prHeadSha || 'HEAD';
      break;
    case 'pr_base':
      const { prBaseSha: baseSha } = await getGitHubContext(); // Re-fetch for clarity
      gitRef = baseSha || 'HEAD'; // Fallback to HEAD if base SHA not found
      break;
    case 'latest':
      gitRef = 'HEAD';
      break;
    default:
      gitRef = referenceMode; // Custom reference
      break;
  }
  log(`Determined Git reference: ${gitRef} (mode: ${referenceMode})`);
  return gitRef;
}

export async function determineTargetBranch(branchStrategy: TargetBranchStrategy): Promise<string> {
  const { detectedContextType, prBaseRef, payload } = await getGitHubContext();
  let targetBranch = 'main'; // Default branch

  switch (branchStrategy) {
    case 'auto':
      switch (detectedContextType) {
        case 'pr_review':
        case 'pr_review_comment':
        case 'pr_comment':
        case 'pull_request':
        case 'pr_description':
          targetBranch = prBaseRef || 'main';
          break;
        default:
          // For non-PR contexts, GITHUB_BASE_REF might be set if the workflow is triggered on a branch
          // otherwise, default to the repository's default branch (often main/master)
          targetBranch = process.env.GITHUB_BASE_REF || payload.repository?.default_branch || 'main';
          break;
      }
      break;
    case 'pr_base':
      targetBranch = prBaseRef || 'main';
      break;
    case 'default':
      targetBranch = payload.repository?.default_branch || 'main';
      break;
    default:
      targetBranch = branchStrategy; // Custom branch
      break;
  }
  log(`Determined target branch: ${targetBranch} (strategy: ${branchStrategy})`);
  return targetBranch;
}

export async function validateContext(): Promise<{ valid: boolean; warnings: string[]; errors: string[] }> {
  const { detectedContextType, prNumber, issueNumber, ref } = await getGitHubContext();
  const warnings: string[] = [];
  const errors: string[] = [];

  if (detectedContextType.startsWith('pr_') || detectedContextType === 'pull_request') {
    if (!prNumber) {
      warnings.push('PR context detected but no PR number available in direct context fields. This might be okay if issueNumber is used as PR number.');
    }
  } else if (detectedContextType.startsWith('issue')) {
    if (!issueNumber) {
      warnings.push('Issue context detected but no issue number available.');
    }
  }

  if (!ref || ref === 'null') {
    warnings.push('No Git reference (ref) found in context - may default to HEAD.');
  }

  if (errors.length > 0) {
    logError('Context validation failed:');
    errors.forEach(err => logError(`  - ${err}`));
  }
  if (warnings.length > 0) {
    logWarning('Context validation warnings:');
    warnings.forEach(warn => logWarning(`  - ${warn}`));
  }
  return { valid: errors.length === 0, warnings, errors };
}

export async function logContextInfo(context?: GitHubContext): Promise<void> {
  const ctx = context || await getGitHubContext();
  log('📊 GitHub Context Information:');
  log(`  - Detected Context Type: ${ctx.detectedContextType}`);
  log(`  - Event Name: ${ctx.eventName}`);
  log(`  - Repository: ${ctx.repoOwner}/${ctx.repoName}`);
  if (ctx.prNumber) log(`  - PR Number: ${ctx.prNumber}`);
  if (ctx.issueNumber && ctx.issueNumber !== ctx.prNumber) log(`  - Issue Number: ${ctx.issueNumber}`);
  if (ctx.commentId) log(`  - Comment ID: ${ctx.commentId}`);
  log(`  - SHA: ${ctx.sha?.substring(0,8)}...`);
  log(`  - Ref: ${ctx.ref}`);
  log(`  - Actor: ${ctx.actor}`);
  log(`  - Run ID: ${ctx.runId}`);
}

// --- Repository Operations ---
export async function cloneRepository(repoDir: string): Promise<boolean> {
  const { repoOwner, repoName, token } = await getGitHubContext();
  const repoUrl = `https://x-access-token:${token}@github.com/${repoOwner}/${repoName}.git`;

  log(`📥 Cloning repository ${repoOwner}/${repoName} into ${repoDir}...`);
  try {
    // Clean the directory before cloning if it exists and is not empty
    // This is safer than rm -rf and then mkdir
    await runShellCommand('git', ['clone', '--depth=1', repoUrl, repoDir]);
    logSuccess(`Repository cloned to ${repoDir}`);
    return true;
  } catch (error) {
    logError(`Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export async function setupGitContext(repoDir: string, gitReference: string): Promise<void> {
  const { detectedContextType, prHeadRef } = await getGitHubContext();
  const options = { cwd: repoDir };

  log(`🔧 Setting up Git context in ${repoDir} for: ${detectedContextType}`);

  try {
    await runShellCommand('git', ['config', 'user.name', 'github-actions[bot]'], options);
    await runShellCommand('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com'], options);

    if (detectedContextType.startsWith('pr_') && prHeadRef) {
        log(`🌿 Fetching and checking out PR branch: ${prHeadRef} (ref: ${gitReference})`);
        try {
            // Fetch the specific ref for the PR head
            await runShellCommand('git', ['fetch', 'origin', `+${gitReference}:${prHeadRef}`], options);
            await runShellCommand('git', ['checkout', prHeadRef], options);
        } catch (fetchError) {
            logWarning(`Could not fetch PR branch ref ${prHeadRef} directly. Attempting checkout of SHA ${gitReference}. Error: ${fetchError}`);
            await runShellCommand('git', ['checkout', gitReference], options);
        }
    } else if (gitReference && gitReference !== 'HEAD') {
      log(`📍 Checking out specific commit: ${gitReference}`);
      await runShellCommand('git', ['checkout', gitReference], options);
    } else {
      log('Staying on default branch or HEAD.');
    }

    const currentBranchResult = await runShellCommand('git', ['branch', '--show-current'], options);
    const currentBranch = typeof currentBranchResult.stdout === 'string' ? currentBranchResult.stdout.trim() : '(detached HEAD)';
    
    const currentCommitResult = await runShellCommand('git', ['rev-parse', '--short', 'HEAD'], options);
    const currentCommit = typeof currentCommitResult.stdout === 'string' ? currentCommitResult.stdout.trim() : 'unknown';

    log(`📊 Git Status: branch=${currentBranch}, commit=${currentCommit}`);

    core.exportVariable('CURRENT_BRANCH', currentBranch);
    core.exportVariable('CURRENT_COMMIT', currentCommit);

  } catch (error) {
    logError(`Failed to set up Git context: ${error instanceof Error ? error.message : String(error)}`);
    // Depending on the error, you might want to throw it or handle it gracefully
  }
}

export async function getPrDiff(prNumberToDiff?: number): Promise<string | null> {
    const { octokit, repoOwner, repoName, prNumber: contextPrNumber } = await getGitHubContext();
    const targetPrNumber = prNumberToDiff || contextPrNumber;

    if (!targetPrNumber) {
        logError('Cannot get PR diff: PR number is undefined.');
        return null;
    }

    try {
        const response = await octokit.rest.pulls.get({
            owner: repoOwner,
            repo: repoName,
            pull_number: targetPrNumber,
            mediaType: {
                format: 'diff'
            }
        });
        // The response.data is already a string when mediaType.format is 'diff'
        return response.data as unknown as string;
    } catch (error) {
        logError(`Failed to get PR diff for PR #${targetPrNumber}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}
