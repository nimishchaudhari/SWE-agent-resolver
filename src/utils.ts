import * as core from '@actions/core';
import fs from 'fs/promises';
import path from 'path';
import { execa, Options as ExecaOptions } from 'execa';

// --- Logging Functions ---
export function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
  core.info(message);
}

export function logError(message: string): void {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
  core.error(message);
}

export function logWarning(message: string): void {
  console.warn(`[${new Date().toISOString()}] WARNING: ${message}`);
  core.warning(message);
}

export function logSuccess(message: string): void {
  console.log(`[${new Date().toISOString()}] SUCCESS: ${message}`);
  core.info(message);
}

// --- File and Directory Utilities ---
export async function createTempDirectory(baseName = 'swe_agent'): Promise<string> {
  const tempDir = path.join('/tmp', `${baseName}_${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  log(`Temporary directory created: ${tempDir}`);
  return tempDir;
}

export interface WorkspaceDirectories {
  baseDir: string;
  repoDir: string;
  outputDir: string;
}

export async function setupWorkspaceDirectories(baseDir: string): Promise<WorkspaceDirectories> {
  const repoDir = path.join(baseDir, 'repo');
  const outputDir = path.join(baseDir, 'output');

  await fs.mkdir(repoDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  // Set environment variables for potential use by other processes
  core.exportVariable('TEMP_DIR', baseDir);
  core.exportVariable('REPO_DIR', repoDir);
  core.exportVariable('OUTPUT_DIR', outputDir);

  log('📁 Workspace directories created:');
  log(`  - Base: ${baseDir}`);
  log(`  - Repository: ${repoDir}`);
  log(`  - Output: ${outputDir}`);
  return { baseDir, repoDir, outputDir };
}

// --- Time Tracking ---
interface Timer {
  startTime: number;
}

export function startTimer(): Timer {
  log('⏱️ Timer started');
  return { startTime: Date.now() };
}

export function getElapsedTime(timer: Timer): string {
  if (!timer || typeof timer.startTime !== 'number') {
    return 'N/A';
  }
  const elapsedMilliseconds = Date.now() - timer.startTime;
  const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes > 0) {
    return `${elapsedMinutes} minutes`;
  } else if (elapsedSeconds > 0) {
    return `${elapsedSeconds} seconds`;
  } else {
    return '< 1 second';
  }
}

// --- Patch Processing ---
export async function findPatchInOutput(outputDir: string): Promise<string | null> {
  try {
    // Check for .patch files
    const files = await fs.readdir(outputDir);
    for (const file of files) {
      if (file.endsWith('.patch')) {
        const patchFilePath = path.join(outputDir, file);
        const stat = await fs.stat(patchFilePath);
        if (stat.size > 0) {
          const content = await fs.readFile(patchFilePath, 'utf-8');
          log(`📄 Found patch file: ${patchFilePath}`);
          return content;
        }
      }
    }

    // Check for trajectory files with patches
    for (const file of files) {
      if (file.endsWith('.traj')) {
        const trajFilePath = path.join(outputDir, file);
        const stat = await fs.stat(trajFilePath);
        if (stat.size > 0) {
          const content = await fs.readFile(trajFilePath, 'utf-8');
          const patchMatch = content.match(/diff --git[\s\S]*/);
          if (patchMatch && patchMatch[0]) {
            log(`📄 Found patch in trajectory file: ${trajFilePath}`);
            return patchMatch[0].substring(0, 50000); // Limiting size for safety
          }
        }
      }
    }

    // Check for any diff output in logs (e.g., swe_agent.log)
    const logFilePath = path.join(outputDir, 'swe_agent.log');
    try {
      const logContent = await fs.readFile(logFilePath, 'utf-8');
      const patchMatch = logContent.match(/diff --git[\s\S]*/);
      if (patchMatch && patchMatch[0]) {
        log('📄 Found patch in SWE-Agent logs');
        return patchMatch[0].substring(0, 50000); // Limiting size
      }
    } catch (error) {
      // Log file might not exist, which is fine
    }
  } catch (error) {
    logWarning(`Error finding patch in output: ${error instanceof Error ? error.message : String(error)}`);
  }
  return null;
}

export interface PatchStatistics {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
}

export function calculatePatchStatistics(patchContent: string | null): PatchStatistics {
  if (!patchContent) {
    return { filesChanged: 0, linesAdded: 0, linesRemoved: 0 };
  }

  const filesChanged = (patchContent.match(/^diff --git/gm) || []).length;
  const linesAdded = (patchContent.match(/^\+/gm) || []).length - filesChanged; // Exclude +++ lines
  const linesRemoved = (patchContent.match(/^-/gm) || []).length - filesChanged; // Exclude --- lines

  return {
    filesChanged,
    linesAdded: Math.max(0, linesAdded),
    linesRemoved: Math.max(0, linesRemoved),
  };
}

export function truncatePatchIfNeeded(patchContent: string, maxLength = 40000): { truncatedPatch: string; wasTruncated: boolean } {
  if (patchContent.length > maxLength) {
    return {
      truncatedPatch: `${patchContent.substring(0, maxLength)}\n...\n(Patch truncated - too long for comment)`,
      wasTruncated: true,
    };
  }
  return { truncatedPatch: patchContent, wasTruncated: false };
}

// --- Error Analysis ---
export async function extractErrorInfo(logFilePath: string): Promise<string> {
  try {
    const logContent = await fs.readFile(logFilePath, 'utf-8');
    const lines = logContent.split('\\n');
    const errorLines = lines
      .slice(-20) // Last 20 lines
      .filter(line => /(Error|Exception|Failed|Traceback)/i.test(line))
      .slice(0, 3); // Max 3 error lines
    return errorLines.length > 0 ? errorLines.join('\\n') : 'No specific errors found in log';
  } catch (error) {
    return 'No log file was created or an error occurred reading it - SWE-Agent might have failed immediately';
  }
}

export async function getLogPreview(logFilePath: string): Promise<string> {
  try {
    const logContent = await fs.readFile(logFilePath, 'utf-8');
    const lines = logContent.split('\\n');
    const first10Lines = lines.slice(0, 10).join('\\n');
    const last10Lines = lines.slice(-10).join('\\n');
    return `**First 10 lines of log:**\n\`\`\`\n${first10Lines}\n\`\`\`\n\n**Last 10 lines of log:**\n\`\`\`\n${last10Lines}\n\`\`\``;
  } catch (error) {
    return `No log file found at ${logFilePath} or an error occurred reading it.`;
  }
}

// --- GitHub Action Outputs ---
export function setActionOutput(key: string, value: string | boolean | number): void {
  core.setOutput(key, value);
}

export async function setPatchOutputs(
  patchGenerated: boolean,
  executionTime: string,
  patchContent: string | null
): Promise<void> {
  setActionOutput('patch_generated', patchGenerated);
  setActionOutput('execution_time', executionTime);

  if (patchGenerated && patchContent) {
    // GitHub output size limit is 1MB. We'll use a file for larger patches.
    const patchOutputFilePath = path.join(process.env.GITHUB_WORKSPACE || '.', 'swe_agent_patch.txt');
    await fs.writeFile(patchOutputFilePath, patchContent);
    setActionOutput('patch_content_file', patchOutputFilePath); // Output the file path

    // For smaller patches, also set as direct output (truncated if necessary)
    if (patchContent.length < 65000) { // A bit less than typical comment limits
        setActionOutput('patch_content', patchContent);
    } else {
        setActionOutput('patch_content', truncatePatchIfNeeded(patchContent, 65000).truncatedPatch);
    }
    log('✅ Patch generated and saved to outputs');
  } else {
    setActionOutput('patch_content', '');
    setActionOutput('patch_content_file', '');
  }
}

// --- Cleanup ---
export async function cleanupTempFiles(tempDir: string | null): Promise<void> {
  if (tempDir && (await fs.stat(tempDir).catch(() => null))?.isDirectory()) {
    log(`🧹 Cleaning up temporary files in ${tempDir}...`);
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      log('✅ Cleanup completed');
    } catch (error) {
      logError(`Failed to clean up temporary files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// --- Shell command execution ---
export async function runShellCommand(
  command: string,
  args: string[],
  options: ExecaOptions = {},
  logOutput = true,
): Promise<Awaited<ReturnType<typeof execa>>> {
  try {
    const result = await execa(command, args, options);
    if (logOutput) {
      if (result.stdout) log(`Stdout: ${String(result.stdout)}`);
      if (result.stderr) logWarning(`Stderr: ${String(result.stderr)}`);
    }
    return result;
  } catch (e: any) { // Using any for the error type for now
    logError(`Error executing command: ${command} ${args.join(' ')}`);
    if (e?.stdout) logError(`Stdout: ${String(e.stdout)}`);
    if (e?.stderr) logError(`Stderr: ${String(e.stderr)}`);
    if (e?.exitCode !== undefined) logError(`Exit code: ${e.exitCode}`);
    if (e?.message) logError(`Full error: ${e.message}`);
    throw e;
  }
}

export async function runCommandWithProgress(
  command: string,
  args: string[],
  options: ExecaOptions = {},
  progressCallback?: (data: string) => void
): Promise<Awaited<ReturnType<typeof execa>>> {
  log(`🚀 Executing with progress: ${command} ${args.join(' ')}`);
  try {
    const subprocess = execa(command, args, options);

    if (progressCallback) {
      subprocess.stdout?.on('data', (data: Buffer | string) => {
        const output = data.toString();
        progressCallback(output);
      });
      subprocess.stderr?.on('data', (data: Buffer | string) => {
        const output = data.toString();
        progressCallback(output); // Also send stderr to progress
      });
    }

    const result = await subprocess;
    logSuccess(`Command finished: ${command} ${args.join(' ')}`);
    return result;
  } catch (e: any) {
    logError(`Command with progress failed: ${command} ${args.join(' ')}`);
    if (e?.stdout) logError(`Stdout: ${String(e.stdout)}`);
    if (e?.stderr) logError(`Stderr: ${String(e.stderr)}`);
    if (e?.exitCode !== undefined) logError(`Exit code: ${e.exitCode}`);
    if (e?.message) logError(`Full error: ${e.message}`);
    throw e;
  }
}
