Okay, I can help you outline a plan to refactor your shell scripts to TypeScript. Since `swe-agent` is Python-based, the TypeScript code will primarily act as a wrapper, orchestrating calls to `swe-agent` and handling GitHub interactions, much like your current shell scripts do.

Here's the relevant code I'll examine to formulate the plan:

1.  **`action.yml`**: To understand the inputs, outputs, and execution environment of your GitHub Action.
2.  **`entrypoint.sh`**: To see the main workflow and how different scripts are called.
3.  **`src/config.sh`**: To understand how configuration (especially GitHub Action inputs) is managed.
4.  **`src/github.sh`**: To see how GitHub API interactions (e.g., posting comments, getting issue data) are handled.
5.  **`src/swe_agent.sh`**: This is crucial as it shows how `swe-agent` is invoked, how arguments (like the problem statement) are prepared, and how its output is captured.
6.  **`src/intent.sh`**: To understand how the user's intent is determined, which might influence the flow.
7.  **`src/response_formatter.sh`**: To see how the final output for GitHub comments or summaries is constructed.
8.  **`src/utils.sh`**: For any common utility functions that will need to be rewritten.

Let's get the content of these files. Okay, refactoring your GitHub Action wrapper from shell scripts to TypeScript while the core `swe-agent` remains in Python is a solid approach. TypeScript will offer better type safety, maintainability, and tooling.

Here's a suggested plan for the refactoring process:

**I. Project Setup & Core TypeScript Action Structure:**

1.  **Initialize Node.js Project:**
    *   Create a `package.json` file (`npm init -y`).
    *   Install TypeScript and necessary type definitions: `npm install --save-dev typescript @types/node`.
    *   Install the GitHub Actions toolkit: `npm install @actions/core @actions/github @actions/exec`.
    *   Install a linter/formatter like ESLint/Prettier.
2.  **Configure TypeScript:**
    *   Create a `tsconfig.json` file (`npx tsc --init`). Configure it to output JavaScript to a `dist` directory.
3.  **Update `action.yml`:**
    *   Change `runs.using` from `docker` or `composite` (if that's what `entrypoint.sh` implies) to `node16` or `node20`.
    *   Change `runs.main` to point to the compiled JavaScript entrypoint (e.g., `dist/index.js`).
    *   Inputs will remain largely the same, but how they are accessed in the code will change (using `@actions/core`).
4.  **Create TypeScript Entrypoint (`src/main.ts` or `src/index.ts`):**
    *   This will be the main file for your action.
    *   It will import functions from `@actions/core` to get inputs and set outputs/failures.
    *   It will orchestrate the calls to other modules you'll create.

**II. Porting Shell Script Logic to TypeScript Modules:**

For each of the existing shell scripts in your `src/` directory, you'll create corresponding TypeScript modules/functions:

1.  **Configuration (`src/config.ts`):**
    *   Read action inputs using `core.getInput('input-name')`.
    *   Read environment variables using `process.env.VAR_NAME`.
    *   Export these configurations for other modules to use.
    *   *Relevant current file: `src/config.sh`*
2.  **GitHub API Interactions (`src/github.ts`):**
    *   Use `@actions/github` to get an authenticated Octokit client: `const octokit = github.getOctokit(core.getInput('github-token'));`.
    *   Re-implement functions like `post_comment`, `get_issue_details`, `get_pr_details`, etc., using Octokit methods.
    *   *Relevant current file: `src/github.sh`*
3.  **SWE-Agent Runner (`src/swe_agent_runner.ts`):**
    *   This module will be responsible for executing the Python-based `swe-agent`.
    *   Use `@actions/exec` or Node.js's `child_process.exec` or `child_process.spawn` to run the Python script.
        *   `@actions/exec` is often simpler for basic command execution and output capture within actions.
    *   You'll need to construct the command and arguments for `swe-agent` dynamically based on inputs and context, similar to how `src/swe_agent.sh` does.
    *   Capture `stdout`, `stderr`, and the exit code from the Python script.
    *   Handle the creation of the "problem statement" and any necessary context files that `swe-agent` expects.
    *   *Relevant current file: `src/swe_agent.sh`*
4.  **Intent Detection (`src/intent.ts`):**
    *   Port the logic from `src/intent.sh` to TypeScript. This might involve string matching, regex, or more complex logic depending on its current implementation.
    *   *Relevant current file: `src/intent.sh`*
5.  **Response Formatting (`src/response_formatter.ts`):**
    *   Re-implement the response formatting logic from `src/response_formatter.sh` in TypeScript. This could involve string manipulation, template literals, or potentially a templating library if the formatting is complex.
    *   *Relevant current file: `src/response_formatter.sh`*
6.  **Utilities (`src/utils.ts`):**
    *   Port any general helper functions from `src/utils.sh` to TypeScript.
    *   *Relevant current file: `src/utils.sh`*

**III. Orchestration and Error Handling:**

1.  **Main Logic Flow (`src/main.ts`):**
    *   Your main TypeScript file will call functions from the modules above in the correct order:
        1.  Load configuration.
        2.  Determine intent (if applicable).
        3.  Fetch necessary data from GitHub (issue/PR details).
        4.  Prepare and run `swe-agent`.
        5.  Process `swe-agent`'s output.
        6.  Format the response.
        7.  Post results back to GitHub (e.g., as a comment).
2.  **Error Handling:**
    *   Use `try...catch` blocks extensively.
    *   Use `core.setFailed('Error message')` to fail the action with a clear message if an error occurs.
    *   Log detailed error information for debugging using `core.error()` or `core.warning()`.

**IV. Build and Test:**

1.  **Build Script:**
    *   Add a build script to your `package.json` (e.g., `"build": "tsc"`).
    *   You might also want to use a bundler like `ncc` (`@vercel/ncc`) to package your TypeScript code and `node_modules` into a single JavaScript file for distribution, which is a common practice for Node.js GitHub Actions. This simplifies the `action.yml` and avoids checking in `node_modules` or the `dist` folder if you don't want to.
2.  **Testing:**
    *   Write unit tests for your TypeScript modules (e.g., using Jest).
    *   Mock GitHub API calls and `swe-agent` execution for tests.
    *   Perform integration testing by running the action in a test workflow.

**V. Documentation and Cleanup:**

1.  Update `README.md` to reflect the new TypeScript-based action, build process, and any changes in usage.
2.  Remove the old shell scripts and `entrypoint.sh` once the TypeScript version is stable.

**Files to Examine for Refactoring Logic:**

To help with this, I'll fetch the content of the key shell scripts and the action definition. This will give us a clear picture of the current functionalities.

Let me know if this plan aligns with your vision, and then I can proceed to fetch the content of the relevant files. Okay, I understand you'd like a plan to refactor your shell script-based GitHub Action into TypeScript, while the underlying `swe-agent` it orchestrates is Python-based. This is a solid choice, especially given the strong TypeScript support in GitHub Actions.

Here's a suggested plan, focusing on identifying the relevant shell script functionalities and how they would translate to TypeScript:

**I. Project Setup & Core Functionality (TypeScript)**

1.  **Initialize a TypeScript Project:**
    *   Set up a `package.json` (`npm init -y`).
    *   Install TypeScript (`npm install typescript --save-dev`).
    *   Install Node types (`npm install @types/node --save-dev`).
    *   Create a `tsconfig.json` (`npx tsc --init`).
    *   Install GitHub Actions toolkit: `npm install @actions/core @actions/github @actions/exec`.
2.  **Action Definition (`action.yml`):**
    *   This file will remain largely the same, defining inputs, outputs, and how the action is run.
    *   The `runs.main` will change from `entrypoint.sh` to your main TypeScript file (e.g., `dist/index.js`).
    *   **Relevant existing file:** `/workspaces/swe-agent-resolver/action.yml` (to understand current inputs/outputs).
3.  **Entrypoint (`src/main.ts` - new file):**
    *   This will be the main script for your action.
    *   It will parse inputs from `action.yml` using `@actions/core`.
    *   It will orchestrate the different steps, similar to `/workspaces/swe-agent-resolver/entrypoint.sh`.
    *   **Relevant existing file:** `/workspaces/swe-agent-resolver/entrypoint.sh` (for overall workflow logic).

**II. Refactoring Shell Script Modules to TypeScript Modules**

For each of the `.sh` files in your `src` directory, we'll create a corresponding TypeScript module (e.g., `src/config.ts`, `src/github.ts`, etc.).

1.  **Configuration (`src/config.ts`):**
    *   **Purpose:** Load and validate configuration from action inputs and environment variables.
    *   **Shell Logic:** `/workspaces/swe-agent-resolver/src/config.sh` (functions `setup_configuration`, `validate_configuration`, `get_model_parameters`, `display_configuration_summary`).
    *   **TypeScript Implementation:**
        *   Use `@actions/core getInput()` to fetch action inputs.
        *   Use `process.env` to access environment variables.
        *   Implement validation logic.
        *   Export configuration values or a configuration object.
2.  **GitHub API Interaction (`src/github.ts`):**
    *   **Purpose:** Interact with the GitHub API (post/update comments, add reactions, get context).
    *   **Shell Logic:** `/workspaces/swe-agent-resolver/src/github.sh` (functions `post_comment`, `update_comment`, `add_reaction`, `add_contextual_reaction`, `extract_enhanced_github_context`, `detect_github_context`, `determine_git_reference`, `determine_target_branch`).
    *   **TypeScript Implementation:**
        *   Use `@actions/github getOctokit()` to get an authenticated Octokit client.
        *   Use Octokit methods for API calls (e.g., `octokit.rest.issues.createComment`, `octokit.rest.reactions.createForIssueComment`).
        *   Access GitHub context from `@actions/github context`.
        *   The logic in `/workspaces/swe-agent-resolver/scripts/context-detection.sh` (called by `extract_enhanced_github_context`) will need to be translated into TypeScript to gather necessary PR/issue details.
3.  **Intent Detection (`src/intent.ts`):**
    *   **Purpose:** Determine the user's intent from their comment.
    *   **Shell Logic:** `/workspaces/swe-agent-resolver/src/intent.sh` (function `detect_request_intent`, `handle_non_patch_request`, `generate_visual_content`).
    *   **TypeScript Implementation:**
        *   Replicate the string matching and conditional logic.
        *   The `handle_non_patch_request` might involve calling an LLM directly (see `ai_api.sh`). This could be done using a library like `axios` or `node-fetch` to call the LLM API, or a dedicated LLM client library.
        *   Visual content generation would involve formatting strings as Markdown.
4.  **SWE-Agent Orchestration (`src/sweAgent.ts`):**
    *   **Purpose:** Prepare inputs for `swe-agent` (Python script) and execute it.
    *   **Shell Logic:** `/workspaces/swe-agent-resolver/src/swe_agent.sh` (functions `run_swe_agent_diagnostics`, `execute_swe_agent_with_context`, `create_problem_statement_with_context`, `execute_swe_agent`).
    *   **TypeScript Implementation:**
        *   Use `fs` module (e.g., `fs.promises.writeFile`) to create the `problem_statement.md` file.
        *   Use `@actions/exec exec()` to run the Python `sweagent` command. This is the primary point of interaction with the Python part.
        *   Capture `stdout`, `stderr`, and the exit code from `exec()`.
        *   The diagnostic checks (`run_swe_agent_diagnostics`) can be partially replicated by checking for the `sweagent` command using `io.which()` from `@actions/io` (you might need to install this: `npm install @actions/io`).
5.  **Response Formatting (`src/responseFormatter.ts`):**
    *   **Purpose:** Format the output/results into a user-friendly GitHub comment.
    *   **Shell Logic:** `/workspaces/swe-agent-resolver/src/response_formatter.sh` (various `format_*_response` functions) and parts of `/workspaces/swe-agent-resolver/src/swe_agent.sh` (like `process_swe_agent_results`, `format_timeout_message`, etc.).
    *   **TypeScript Implementation:**
        *   Use template literals or a simple templating function to construct the Markdown for comments.
        *   This module will take the output from `sweAgent.ts` (or `intent.ts` for non-patch requests) and format it.
6.  **Utilities (`src/utils.ts`):**
    *   **Purpose:** Common helper functions (logging, file/directory operations, time tracking, patch processing).
    *   **Shell Logic:** `/workspaces/swe-agent-resolver/src/utils.sh`.
    *   **TypeScript Implementation:**
        *   Logging: Use `@actions/core info()`, `warning()`, `error()`.
        *   File/Dir: Use `fs` module and `@actions/io` (e.g., `io.mkdirP`, `io.rmRF`).
        *   Time Tracking: Use `Date.now()`.
        *   Patch Processing (`find_patch_in_output`): Use `fs` to read files and string manipulation or regex to find patch content. The logic for extracting patches from `.json` trajectory files (`jq` commands) would need to be replicated by parsing JSON (`JSON.parse`) and accessing the relevant fields.
7.  **AI API Interaction (`src/aiApi.ts` - if needed for non-patch intents):**
    *   **Purpose:** Directly call LLM APIs for analysis, opinion, etc.
    *   **Shell Logic:** `/workspaces/swe-agent-resolver/src/ai_api.sh`.
    *   **TypeScript Implementation:**
        *   Use `axios` or `node-fetch` to make HTTP requests to the LLM provider's API endpoint.
        *   Handle API key management securely (likely from action inputs/secrets).

**III. Handling Scripts Directory**

*   `/workspaces/swe-agent-resolver/scripts/context-detection.sh`: As mentioned, its logic needs to be integrated into `src/github.ts`.
*   Other scripts like `build-docker.sh`, `cleanup-and-summary.sh`, `final-summary.sh`, `handle-issue-context.sh`, `handle-pr-context.sh`, `pr-operations.sh`, `test-enhanced-features.sh` seem to be part of the build, testing, or higher-level orchestration of the *current* shell-based action.
    *   The build script (`build-docker.sh`) will be replaced by `npm run build` (which would run `tsc`).
    *   Testing scripts would need to be adapted or rewritten for a TypeScript context (e.g., using Jest).
    *   The context handling and PR operations logic should be absorbed into the relevant TypeScript modules (primarily `src/github.ts` and the main entrypoint).

**IV. Execution Flow (TypeScript)**

1.  `main.ts` starts.
2.  `config.ts` loads and validates inputs.
3.  `github.ts` fetches issue/PR context.
4.  `intent.ts` determines user intent.
5.  **If patch intent:**
    *   `sweAgent.ts` creates `problem_statement.md`.
    *   `sweAgent.ts` executes `sweagent` (Python script) using `@actions/exec`.
    *   `sweAgent.ts` processes the results (patch file, logs).
6.  **If non-patch intent (analysis, opinion, visual):**
    *   `intent.ts` (possibly with `aiApi.ts`) generates the content.
7.  `responseFormatter.ts` formats the final message.
8.  `github.ts` posts the comment to GitHub.

**Key Considerations During Refactoring:**

*   **Error Handling:** Implement robust try-catch blocks and use `@actions/core setFailed()` for unrecoverable errors.
*   **Asynchronous Operations:** TypeScript/JavaScript is asynchronous. Use `async/await` extensively for I/O operations (file system, API calls, process execution).
*   **Security:** Continue to handle secrets (API keys, GitHub token) appropriately via action inputs.
*   **Testing:** Plan for unit tests (e.g., with Jest) for individual TypeScript modules and potentially integration tests that mock GitHub API calls and `swe-agent` execution.

This plan provides a high-level overview. Each shell script will need careful translation of its specific logic and commands to their TypeScript/Node.js equivalents.

Let me know if you'd like me to proceed with this plan or if you have any adjustments!Okay, I can help you with a plan to refactor your shell scripts to TypeScript. Since `swe-agent` is a Python tool, the TypeScript code will essentially act as a more robust and maintainable wrapper, orchestrating the calls to `swe-agent` and handling the GitHub Action lifecycle.

Here's a suggested plan:

**Phase 1: Project Setup & Basic Configuration**

1.  **Initialize Node.js Project:**
    *   Create `package.json` (`npm init -y`).
    *   Create a src directory for TypeScript files and a `dist` directory for compiled JavaScript.
2.  **Install Dependencies:**
    *   TypeScript: `npm install --save-dev typescript @types/node`
    *   GitHub Actions Toolkit: `npm install @actions/core @actions/github`
    *   Child Process Execution: `npm install execa` (for easier management of child processes like `swe-agent`).
3.  **Configure TypeScript:**
    *   Create `tsconfig.json` (e.g., `npx tsc --init`). Adjust settings for `outDir` (to `dist`), `rootDir` (to src), `moduleResolution` (`node`), `target` (`es2020` or later), etc.
4.  **Update action.yml:**
    *   Change `runs.using` to `node20` (or `node16`).
    *   Change `runs.main` to `dist/index.js` (or whatever your main compiled JS file will be).
5.  **Basic Entry Point (`src/index.ts` or `src/main.ts`):**
    *   Create a simple `async function run() {}` and call it. This will be the equivalent of your `main()` in entrypoint.sh.
6.  **Configuration Module (`src/config.ts`):**
    *   Migrate logic from config.sh.
    *   Use `@actions/core getInput()` to fetch `INPUT_*` variables.
    *   Implement `setup_configuration` and `validate_configuration`.
    *   Define types/interfaces for your configuration object.

**Phase 2: Core Utilities & GitHub Interactions**

7.  **Utilities Module (`src/utils.ts`):**
    *   Migrate functions from utils.sh.
    *   Implement logging functions (you can use `console.log` or `@actions/core` logging commands, or a library like `winston`).
    *   Re-implement file/directory utilities using Node.js `fs` module (e.g., `fs.promises.mkdtemp` for `create_temp_directory`).
    *   Time tracking can be done with `Date.now()`.
8.  **GitHub Module (`src/github.ts`):**
    *   Migrate functions from github.sh.
    *   Use `@actions/github` (via `github.getOctokit(token)`) for API calls like `post_comment`, `update_comment`, `add_reaction`.
    *   Use `@actions/github.context` to get event payload details (issue number, comment body, PR details, etc.) replacing manual environment variable parsing for event data.
    *   Re-implement context detection and git reference logic.

**Phase 3: Intent, AI, and Response Formatting**

9.  **Intent Module (`src/intent.ts`):**
    *   Migrate `detect_request_intent` from intent.sh. Use JavaScript string methods and regular expressions.
    *   The `handle_non_patch_request` and related prompt generation will be part of this, preparing data for the AI API call.
10. **AI API Module (`src/ai.ts`):**
    *   This will be a new module to encapsulate the logic from the (unseen) ai_api.sh.
    *   Use `https` module or a library like `axios` or `node-fetch` to make calls to the LLM API.
    *   Handle API key management securely (likely from the `config.ts` module).
11. **Response Formatting Module (`src/responseFormatter.ts`):**
    *   Migrate `format_response_by_intent` and other formatting functions from response_formatter.sh.
    *   Use TypeScript template literals for cleaner string construction.

**Phase 4: SWE-Agent Orchestration & Main Logic**

12. **SWE-Agent Module (`src/sweAgent.ts`):**
    *   Migrate logic from swe_agent.sh.
    *   Use `execa` to run the `swe-agent` Python script as a child process.
    *   Implement `create_problem_statement_with_context` using `fs.promises.writeFile`.
    *   Capture `stdout`, `stderr`, and exit codes from `swe-agent` execution.
    *   Implement result processing and error message formatting.
13. **Progress Tracking Module (`src/progress.ts`):**
    *   Migrate logic from the (unseen) progress.sh. This might involve updating GitHub comments or creating checks.
14. **Main Orchestration (`src/index.ts` or `src/main.ts`):**
    *   Flesh out the `run()` function to replicate the flow from entrypoint.sh:
        *   Setup configuration.
        *   Initialize progress.
        *   Detect intent.
        *   Add initial reaction.
        *   Create temp directory.
        *   Process based on intent (calling `sweAgent.ts` or `ai.ts` functions).
        *   Handle results (success/failure comments).
        *   Cleanup.

**Phase 5: Build, Test, and Refine**

15. **Build Script:**
    *   Add a build script to `package.json` (e.g., `"build": "tsc"`).
16. **Testing:**
    *   Consider using a testing framework like Jest (`npm install --save-dev jest @types/jest ts-jest`).
    *   Write unit tests for individual modules (config parsing, intent detection, response formatting).
    *   Write integration tests to simulate action runs (mocking GitHub context and `swe-agent` execution).
    *   Adapt existing shell-based tests if possible or rewrite them in TypeScript/JavaScript.
17. **Error Handling & Logging:**
    *   Implement robust error handling using `try...catch` blocks throughout.
    *   Ensure consistent and informative logging.
18. **Linting and Formatting:**
    *   Install and configure ESLint and Prettier for code quality and consistency.

**Migration Strategy Tips:**

*   **Incremental Refactoring:** Don't try to do it all at once. Refactor one shell script (or a group of related functions) to its TypeScript equivalent, test it, and then move to the next.
*   **Interfaces and Types:** Define TypeScript interfaces and types for data structures (e.g., GitHub event payloads, configuration objects, API responses) early on. This will improve code clarity and help catch errors.
*   **Focus on entrypoint.sh as the Guide:** Use entrypoint.sh as the roadmap for the main control flow in your `src/index.ts`.
*   **Keep `swe-agent` Call Intact Initially:** The core call to the Python `swe-agent` script via `execa` will remain. The TypeScript code wraps this call.



Okay, migrating from shell scripts to TypeScript opens up several opportunities for improvement beyond just a direct port of functionality. TypeScript's features can lead to a more robust, maintainable, and developer-friendly codebase.

Here's your existing plan, augmented with specific improvements that TypeScript enables:

**Phase 1: Project Setup & Basic Configuration**

1.  **Initialize Node.js Project:**
    *   Create `package.json` (`npm init -y`).
    *   Create a src directory for TypeScript files and a `dist` directory for compiled JavaScript.
2.  **Install Dependencies:**
    *   TypeScript: `npm install --save-dev typescript @types/node`
    *   GitHub Actions Toolkit: `npm install @actions/core @actions/github`
    *   Child Process Execution: `npm install execa` (for easier management of child processes like `swe-agent`).
        *   **Improvement:** `execa` provides better handling of child processes (e.g., promises, more detailed error objects, better cross-platform compatibility) compared to raw `child_process`.
3.  **Configure TypeScript:**
    *   Create `tsconfig.json` (e.g., `npx tsc --init`). Adjust settings for `outDir` (to `dist`), `rootDir` (to src), `moduleResolution` (`node`), `target` (`es2020` or later), etc.
    *   **Improvement: Leverage stricter compiler options.** In `tsconfig.json`, enable options like `strict: true`, `noImplicitAny: true`, `noUnusedLocals: true`, `noUnusedParameters: true` to catch potential errors at compile-time and enforce cleaner code.
4.  **Update action.yml:**
    *   Change `runs.using` to `node20` (or `node16`).
    *   Change `runs.main` to `dist/index.js` (or whatever your main compiled JS file will be).
5.  **Basic Entry Point (`src/index.ts` or `src/main.ts`):**
    *   Create a simple `async function run() {}` and call it. This will be the equivalent of your `main()` in entrypoint.sh.
6.  **Configuration Module (`src/config.ts`):**
    *   Migrate logic from `config.sh`.
    *   Use `@actions/core getInput()` to fetch `INPUT_*` variables.
    *   Implement `setup_configuration` and `validate_configuration`.
    *   **Improvement: Define clear TypeScript interfaces for your configuration object.** This ensures type safety when accessing configuration values across different modules and makes the expected structure explicit.
        ```typescript
        // Example in src/config.ts
        export interface ActionConfig {
          githubToken: string;
          modelName: string;
          // ... other config properties
        }
        ```

**Phase 2: Core Utilities & GitHub Interactions**

7.  **Utilities Module (`src/utils.ts`):**
    *   Migrate functions from `utils.sh`.
    *   Implement logging functions (you can use `console.log` or `@actions/core` logging commands, or a library like `winston`).
        *   **Improvement: Structured Logging.** Consider a library like `winston` for more advanced logging capabilities (e.g., different log levels, formatting, potential transport to external services if needed in the future).
    *   Re-implement file/directory utilities using Node.js `fs` module (e.g., `fs.promises.mkdtemp` for `create_temp_directory`).
        *   **Improvement: Promise-based file system operations.** Use `fs.promises` for cleaner asynchronous file operations with `async/await`.
    *   Time tracking can be done with `Date.now()`.
8.  **GitHub Module (`src/github.ts`):**
    *   Migrate functions from `github.sh`.
    *   Use `@actions/github` (via `github.getOctokit(token)`) for API calls like `post_comment`, `update_comment`, `add_reaction`.
    *   Use `@actions/github.context` to get event payload details (issue number, comment body, PR details, etc.) replacing manual environment variable parsing for event data.
    *   Re-implement context detection and git reference logic.
    *   **Improvement: Typed API interactions.**
        *   Utilize `async/await` for cleaner asynchronous code when making API calls.
        *   Define interfaces for expected GitHub API response structures (or use types provided by `@octokit/types`) to improve reliability and catch unexpected API changes.

**Phase 3: Intent, AI, and Response Formatting**

9.  **Intent Module (`src/intent.ts`):**
    *   Migrate `detect_request_intent` from `intent.sh`. Use JavaScript string methods and regular expressions.
    *   The `handle_non_patch_request` and related prompt generation will be part of this, preparing data for the AI API call.
    *   **Improvement: Use enums or string literal types for intents.** This makes the code more readable and prevents errors from typos when checking intent values.
        ```typescript
        // Example in src/intent.ts
        export enum RequestIntent {
          Patch = 'PATCH',
          Analyze = 'ANALYZE',
          Opinion = 'OPINION',
          Unknown = 'UNKNOWN',
        }
        ```
10. **AI API Module (`src/ai.ts`):**
    *   This will be a new module to encapsulate the logic from the (unseen) `ai_api.sh`.
    *   Use `https` module or a library like `axios` or `node-fetch` to make calls to the LLM API.
    *   Handle API key management securely (likely from the `config.ts` module).
    *   **Improvement: Define interfaces for AI API request and response payloads.** This ensures type safety and makes it easier to work with the AI service's data structures.
11. **Response Formatting Module (`src/responseFormatter.ts`):**
    *   Migrate `format_response_by_intent` and other formatting functions from `response_formatter.sh`.
    *   Use TypeScript template literals for cleaner string construction.
    *   **Improvement: Typed inputs for formatters.** Ensure that functions in this module expect typed data (e.g., an object representing `swe-agent` results with a defined interface) to make formatting logic more robust.

**Phase 4: SWE-Agent Orchestration & Main Logic**

12. **SWE-Agent Module (`src/sweAgent.ts`):**
    *   Migrate logic from `swe_agent.sh`.
    *   Use `execa` to run the `swe-agent` Python script as a child process.
    *   Implement `create_problem_statement_with_context` using `fs.promises.writeFile`.
    *   Capture `stdout`, `stderr`, and exit codes from `swe-agent` execution.
    *   Implement result processing and error message formatting.
    *   **Improvement: Enhanced process management and output parsing.**
        *   Use `async/await` with `execa` for more readable asynchronous process management.
        *   Implement more robust parsing of `swe-agent`'s `stdout` and `stderr`. For example, if `swe-agent` can output structured data (like JSON for errors or progress), parse it directly in TypeScript for better error handling and data extraction.
13. **Progress Tracking Module (`src/progress.ts`):**
    *   Migrate logic from the (unseen) `progress.sh`. This might involve updating GitHub comments or creating checks.
    *   **Improvement: Typed progress updates.** If progress involves structured data, define types for it.
14. **Main Orchestration (`src/index.ts` or `src/main.ts`):**
    *   Flesh out the `run()` function to replicate the flow from entrypoint.sh:
        *   Setup configuration.
        *   Initialize progress.
        *   Detect intent.
        *   Add initial reaction.
        *   Create temp directory.
        *   Process based on intent (calling `sweAgent.ts` or `ai.ts` functions).
        *   Handle results (success/failure comments).
        *   Cleanup.
    *   **Improvement: More structured control flow.** `async/await` will make the main orchestration logic much cleaner and easier to follow than chained shell commands.

**Phase 5: Build, Test, and Refine**

15. **Build Script:**
    *   Add a build script to `package.json` (e.g., `"build": "tsc"`).
    *   **Improvement: Consider a bundler.** For GitHub Actions, using a bundler like `@vercel/ncc` or `esbuild` can package your TypeScript code and `node_modules` into a single JavaScript file. This simplifies distribution and can improve cold start times for the action.
16. **Testing:**
    *   Consider using a testing framework like Jest (`npm install --save-dev jest @types/jest ts-jest`).
    *   Write unit tests for individual modules (config parsing, intent detection, response formatting).
    *   Write integration tests to simulate action runs (mocking GitHub context and `swe-agent` execution).
    *   Adapt existing shell-based tests if possible or rewrite them in TypeScript/JavaScript.
    *   **Improvement: Comprehensive and typed testing.**
        *   Leverage Jest's powerful mocking capabilities more effectively for isolating units of code. TypeScript allows for typed mocks, ensuring your mocks conform to the expected interfaces.
        *   Benefit from type checking within your test files themselves, catching errors in test setup or assertions.
17. **Error Handling & Logging:**
    *   Implement robust error handling using `try...catch` blocks throughout.
    *   Ensure consistent and informative logging.
    *   **Improvement: Custom error types.** Define custom error classes (e.g., `ConfigurationError`, `SweAgentError`) for more specific error handling and clearer debugging.
18. **Linting and Formatting:**
    *   Install and configure ESLint and Prettier for code quality and consistency.
    *   **Improvement: Automated code quality.** Integrate these tools into your development workflow (e.g., pre-commit hooks) to maintain a consistent code style and catch common issues automatically.
19. **Improved Debugging:**
    *   **Improvement: Source map support.** TypeScript compiles to JavaScript, but with source maps, you can debug your TypeScript code directly in IDEs like VS Code or in browser developer tools (if applicable), making it much easier to trace issues back to the original source.
----

**General TypeScript Advantages to Keep in Mind (Beyond Specific Plan Points):**

*   **Enhanced Readability & Maintainability:** TypeScript's features like classes, interfaces, modules, and static typing lead to more organized, self-documenting, and easier-to-maintain code compared to complex shell scripts.
*   **Better Tooling & Developer Experience:** Benefit from superior IDE support (autocompletion, refactoring, inline error checking), and robust linters/formatters integrated with TypeScript.
*   **Reliable Dependency Management:** Use npm/yarn to manage external libraries (like `@actions/core`, `execa`, `axios`) with version control and automated updates, which is more structured than managing dependencies in shell scripts.
*   **Scalability:** As your action grows in complexity, TypeScript's structured nature will make it easier to manage and extend compared to shell scripts.

By incorporating these TypeScript-specific improvements, you'll not only replicate the functionality of your shell scripts but also create a more robust, maintainable, and developer-friendly GitHub Action.
