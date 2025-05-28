import { execa, Options as ExecaOptions } from 'execa';
import * as fsPromises from 'fs/promises';
import * as fs from 'fs'; // For createWriteStream
import * as path from 'path';
import { log, logError, logSuccess, logWarning } from './utils';
import { Config } from './config';

const SWE_AGENT_OUTPUT_DIR_NAME = '.swe_agent_output';

interface SweAgentExecutionResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    patchContent?: string;
    logFile: string;
    outputDir: string;
}

async function runSweAgentDiagnostics(): Promise<boolean> {
    log('🔍 Checking for sweagent command...');
    try {
        const { stdout } = await execa('sweagent', ['--help']);
        logSuccess('sweagent command found and --help executed successfully.');
        if (stdout.trim().length > 0) {
            log('📋 Help command output (first 15 lines):');
            stdout.split('\\n').slice(0, 15).forEach(line => log(`  ${line}`));
        } else {
            log('ℹ️ \'sweagent --help\' produced no output, but exited successfully.');
        }
        return true;
    } catch (error: any) {
        logError('Critical Error: sweagent command not found or --help failed.');
        logError(error.stderr || error.message);
        return false;
    }
}

async function createProblemStatement(
    outputDir: string,
    issueTitle: string,
    issueBody: string,
    commentBody: string
): Promise<string> {
    const problemStatementFile = path.join(outputDir, 'problem_statement.md');
    const content = `
# GitHub Issue: ${issueTitle}

## Original Issue Description
${issueBody}

## User Comment/Request
${commentBody}

## Repository Context
This is a GitHub repository issue that needs to be resolved. Please analyze the codebase, understand the problem, and provide a complete solution.

## Instructions
1. Analyze the repository structure and understand the codebase
2. Identify the root cause of the issue
3. Implement a comprehensive fix
4. Ensure the solution follows best practices
5. Test the changes if possible

## Expected Output
Please provide a working solution that addresses the issue described above.
`;
    await fsPromises.mkdir(outputDir, { recursive: true });
    await fsPromises.writeFile(problemStatementFile, content);
    log(`📝 Created problem statement: ${problemStatementFile}`);
    return problemStatementFile;
}

async function executeSweAgent(
    config: Config,
    repoDir: string,
    problemStatementFile: string,
    instanceOutputDir: string
): Promise<SweAgentExecutionResult> {
    log(`🤖 Running SWE-Agent with model: ${config.modelName}`);
    await fsPromises.mkdir(instanceOutputDir, { recursive: true });
    const logFile = path.join(instanceOutputDir, 'swe_agent_run.log');

    const sweAgentArgs = [
        'run',
        '--agent.model.name', config.modelName,
        // TODO: Add these to config.ts if they need to be configurable
        // '--agent.model.per_instance_cost_limit', config.sweAgentPerInstanceCostLimit || '3.00', 
        // '--agent.model.temperature', config.sweAgentTemperature || '0.0',
        // '--agent.model.top_p', config.sweAgentTopP || '1.0',
        '--env.repo.path', repoDir,
        '--env.deployment.type', 'local',
        '--problem_statement.path', problemStatementFile,
        '--output_dir', instanceOutputDir,
        '--actions.apply_patch_locally', 'false',
    ];
    
    // Example: Add from config if available
    // if (config.sweAgentConfigFile && (await fsPromises.stat(config.sweAgentConfigFile)).isFile()) {
    //     sweAgentArgs.push('--config', config.sweAgentConfigFile);
    // } else {
    //     logWarning(`SWE-Agent config file not found or not specified: ${config.sweAgentConfigFile}. Using default swe-agent config.`);
    // }
    
    if (config.openAiApiKey) sweAgentArgs.push('--agent.model.openai_api_key', config.openAiApiKey);
    if (config.anthropicApiKey) sweAgentArgs.push('--agent.model.anthropic_api_key', config.anthropicApiKey);
    // Add other provider API keys as swe-agent supports them

    if (config.sweAgentArgs && config.sweAgentArgs.length > 0) {
        config.sweAgentArgs.forEach(arg => {
            if (arg) sweAgentArgs.push(arg);
        });
    }
    
    log(`Executing: sweagent ${sweAgentArgs.join(' ')}`);

    try {
        const execOptions: ExecaOptions = {
            cwd: repoDir,
            all: true,
            reject: false,
        };
        const process = execa('sweagent', sweAgentArgs, execOptions);
        
        const logStream = fs.createWriteStream(logFile);
        process.all?.pipe(logStream);
        process.all?.on('data', (data: Buffer | string) => {
            log(`[swe-agent] ${data.toString().trim()}`);
        });

        const result = await process;
        const resultStdout = typeof result.all === 'string' ? result.all : (Array.isArray(result.all) ? result.all.join('\\n') : '');
        
        log(`SWE-Agent process finished with exit code: ${result.exitCode}`);
        return {
            exitCode: result.exitCode ?? -1,
            stdout: resultStdout, // Use combined output
            stderr: '', // Stderr is part of .all
            logFile,
            outputDir: instanceOutputDir,
        };
    } catch (error: any) {
        logError('Failed to execute SWE-Agent.');
        logError(error);
        return {
            exitCode: error.exitCode ?? -1,
            stdout: String(error.stdout || ''),
            stderr: String(error.stderr || error.message || 'Unknown error during execa call'),
            logFile,
            outputDir: instanceOutputDir,
        };
    }
}

async function findPatchInOutput(outputDir: string): Promise<string | undefined> {
    const patchFileNames = ['patch.patch', 'all_output.patch']; // Common patch file names
    const potentialJsonOutputs = ['trajectory.json', 'run_instance.json']; // Files that might contain a patch

    for (const fileName of patchFileNames) {
        const filePath = path.join(outputDir, fileName);
        try {
            if ((await fsPromises.stat(filePath)).isFile()) {
                logSuccess(`Found patch file: ${filePath}`);
                return await fsPromises.readFile(filePath, 'utf-8');
            }
        } catch (e) { /* file not found */ }
    }
    
    for (const fileName of potentialJsonOutputs) {
        const filePath = path.join(outputDir, fileName);
        try {
            if ((await fsPromises.stat(filePath)).isFile()) {
                const content = await fsPromises.readFile(filePath, 'utf-8');
                const jsonData = JSON.parse(content);
                const patch = jsonData.patch || jsonData.final_patch || jsonData.model_patch;
                if (patch && typeof patch === 'string' && patch.trim() !== '') {
                    logSuccess(`Extracted patch from JSON file: ${filePath}`);
                    return patch;
                }
            }
        } catch (e) {
            logWarning(`Could not read or parse JSON for patch: ${filePath}. Error: ${(e as Error).message}`);
        }
    }

    const logFile = path.join(outputDir, 'swe_agent_run.log');
     try {
        if ((await fsPromises.stat(logFile)).isFile()) {
            const logContent = await fsPromises.readFile(logFile, 'utf-8');
            const patchRegex = new RegExp("(?:^|\\\\n)--- a/.+?(?:^|\\\\n)diff --git a/.+", "s");
            const match = logContent.match(patchRegex);
            if (match && match[0]) {
                logSuccess('Found patch content in the log file.');
                return match[0];
            }
        }
    } catch (e) { /* file not found */ }

    logWarning('No patch file or content found in SWE-Agent output directory.');
    return undefined;
}

async function processSweAgentResults(
    result: SweAgentExecutionResult,
    executionTimeSeconds: number,
    // config: Config, // config might not be needed here if all info is in result or passed directly
    issueNumber?: number,
    issueTitle?: string
): Promise<{ message: string; success: boolean; patch?: string }> {
    
    const patchContent = await findPatchInOutput(result.outputDir);

    if (result.exitCode === 0 && patchContent) {
        logSuccess('SWE-Agent completed successfully with a patch.');
        const message = `SWE-Agent finished in ${executionTimeSeconds}s and found a solution for issue #${issueNumber || 'N/A'}: ${issueTitle || 'N/A'}.\\n\\n\`\`\`diff\\n${patchContent}\\n\`\`\``;
        return { message, success: true, patch: patchContent };
    } else if (result.exitCode === 0 && !patchContent) {
        logWarning('SWE-Agent completed successfully but no patch was found.');
        const message = `SWE-Agent finished in ${executionTimeSeconds}s for issue #${issueNumber || 'N/A'}: ${issueTitle || 'N/A'}, but no patch was generated.`;
        return { message, success: false };
    } else {
        logError(`SWE-Agent execution failed with exit code: ${result.exitCode}`);
        let failureReason = `Unknown error (exit code: ${result.exitCode}).`;
        if (result.exitCode === 124) failureReason = 'Timeout.';
        if (result.exitCode === 137) failureReason = 'Process killed (possibly OOM).';
        
        const logPreview = result.stderr || result.stdout || (await fsPromises.readFile(result.logFile, 'utf-8').catch(() => 'Could not read log file.')).slice(-1000);

        const message = `SWE-Agent failed for issue #${issueNumber || 'N/A'}: ${issueTitle || 'N/A'} after ${executionTimeSeconds}s. Reason: ${failureReason}\\n\\nLog tail:\\n\`\`\`\\n${logPreview}\\n\`\`\``;
        return { message, success: false };
    }
}

export {
    runSweAgentDiagnostics,
    createProblemStatement,
    executeSweAgent,
    processSweAgentResults,
    SweAgentExecutionResult,
    SWE_AGENT_OUTPUT_DIR_NAME
};

// Example usage (for testing, to be removed or adapted for index.ts)
/*
async function main() {
    const mockConfig: Config = {
        GITHUB_TOKEN: 'none',
        MODEL_NAME: 'gpt-4o', // Or your preferred model
        TRIGGER_PHRASE: '@swe-agent',
        LOG_LEVEL: 'DEBUG',
        // Add other necessary config fields
    };

    const diagnosticsOk = await runSweAgentDiagnostics();
    if (!diagnosticsOk) {
        logError("SWE-Agent diagnostics failed. Exiting.");
        return;
    }

    const tempRepoDir = '/tmp/mock-repo'; // Create a mock repo for testing
    const problemStatementDir = path.join(SWE_AGENT_OUTPUT_DIR, 'test-instance');
    await fs.mkdir(tempRepoDir, { recursive: true });
    await fs.mkdir(problemStatementDir, { recursive: true });
    
    // Create a dummy file in the mock repo
    await fs.writeFile(path.join(tempRepoDir, 'example.py'), "def hello():\\n  print('Hello world')");


    const problemFile = await createProblemStatement(
        problemStatementDir,
        "Test Issue",
        "This is a test issue body.",
        "Please fix the print statement to say 'Hello SWE!'"
    );

    const startTime = Date.now();
    const result = await executeSweAgent(
        mockConfig,
        tempRepoDir, // Use a path to a git repository
        problemFile,
        problemStatementDir // Instance-specific output directory
    );
    const endTime = Date.now();
    const executionTime = (endTime - startTime) / 1000;

    const finalReport = await processSweAgentResults(result, executionTime, mockConfig, 123, "Test Issue");
    log(finalReport.message);

    // Cleanup
    // await fs.rm(tempRepoDir, { recursive: true, force: true });
    // await fs.rm(problemStatementDir, { recursive: true, force: true });
}

// main().catch(console.error);
*/

