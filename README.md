## Objective of this branch : Allow swe-agent-resolver to be triggered from anywhere, for exmaple:


[]1. **Comment Trigger with @swe-agent**:
   - **Description**: Add a comment in a pull request (PR) or issue containing the trigger phrase (default: `@swe-agent`).
   - **Example**: In a PR comment, write: `@swe-agent Please review this code and suggest improvements.`
   - **Details**: The action listens for the `@swe-agent` phrase (configurable) in PR or issue comments and processes the request based on the comment's content and context.

[]2. **Issue Assignment**:
   - **Description**: Assign an issue to a specific GitHub user configured for the action.
   - **Example**: Assign an issue to the user account linked to the Claude Code Action (e.g., a bot account like `@swe-agent-bot`).
   - **Details**: When the issue is assigned, the action triggers automatically, analyzing the issue description and associated code or context.

[]3. **Manual Workflow Dispatch**:
   - **Description**: Trigger the action manually through the GitHub Actions interface or via a workflow dispatch event.
   - **Example**: Use the GitHub UI to manually run the workflow or trigger it via an API call with a specific event type.
   - **Details**: Configure the workflow YAML to include a `workflow_dispatch` event, allowing manual invocation for specific tasks.

   ```yaml
   on:
     workflow_dispatch:
   ```

[]4. **PR Event Triggers**:
   - **Description**: Automatically trigger the action on specific PR events, such as opening, updating, or commenting on a PR.
   - **Example**: Configure the workflow to run when a PR is opened or updated.
   - **Details**: The action can be set to respond to PR events like `pull_request.opened`, `pull_request.synchronize`, or `pull_request_review_comment.created`.

   ```yaml
   on:
     pull_request:
       types: [opened, synchronize, reopened]
   ```

[]5. **Issue Comment Event**:
   - **Description**: Trigger the action when a comment is posted on an issue, even without explicitly using the `@swe-agent` phrase, if configured to do so.
   - **Example**: A comment like "Please fix this bug" on an issue can trigger the action if the workflow is set to monitor issue comments.
   - **Details**: Use the `issue_comment` event in the workflow YAML to capture all issue comments.

   ```yaml
   on:
     issue_comment:
       types: [created, edited]
   ```

[]6. **Custom Trigger Phrases**:
   - **Description**: Configure a custom trigger phrase instead of the default `@swe-agent`.
   - **Example**: Set the trigger to `@codebot` by updating the workflow configuration.
   - **Details**: Modify the workflow YAML to specify a custom trigger phrase in the action's inputs, allowing flexibility in how the action is invoked.

   ```yaml
   - uses: anthropics/claude-code-action@v1
     with:
       trigger-phrase: '@codebot'
   ```

[]7. **Scheduled Triggers**:
   - **Description**: Run the action on a schedule to perform recurring tasks, such as reviewing open PRs or issues.
   - **Example**: Configure a cron job to check for open issues daily.
   - **Details**: Use the `schedule` event in the workflow YAML to trigger the action periodically.

   ```yaml
   on:
     schedule:
       - cron: '0 0 * * *' # Runs daily at midnight
   ```

[]8. **Push Event Triggers**:
   - **Description**: Trigger the action when code is pushed to a specific branch or repository.
   - **Example**: Automatically analyze code changes when a push occurs to the `main` branch.
   - **Details**: Configure the workflow to respond to `push` events, useful for continuous code review.

   ```yaml
   on:
     push:
       branches: [main]
   ```
