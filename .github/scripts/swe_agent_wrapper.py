import os
import json
import argparse
import traceback
import re
import tempfile
import subprocess
from datetime import datetime
from github import Github
from git import Repo
from sweagent import Agent, AgentArguments
from sweagent.environment.swe_env import SWEEnv

class SWEAgentGitHubWrapper:
    def __init__(self, repo_name, issue_number, context_type, command, pr_head_ref=None, pr_base_ref=None):
        self.gh = Github(os.environ['GITHUB_TOKEN'])
        self.repo = self.gh.get_repo(repo_name)
        self.issue_number = issue_number
        self.context_type = context_type
        self.command = command
        self.pr_head_ref = pr_head_ref
        self.pr_base_ref = pr_base_ref
        self.status_comment = None
        
    def post_status(self, message, update=False):
        """Post or update status comment"""
        issue = self.repo.get_issue(self.issue_number)
        
        status_message = f"""## 🤖 SWE-Agent Status

**Command**: `{self.command}`
**Time**: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}

### Status:
{message}

---
*This comment will be updated as the analysis progresses...*
"""
        
        if update and self.status_comment:
            self.status_comment.edit(status_message)
        else:
            self.status_comment = issue.create_comment(status_message)
    
    def extract_problem_statement(self):
        """Extract the problem from issue/PR description"""
        try:
            if self.context_type in ['issues', 'issue_comment']:
                issue = self.repo.get_issue(self.issue_number)
                # Get the full conversation context
                comments = list(issue.get_comments())
                context = f"Issue Title: {issue.title}\n\nIssue Description:\n{issue.body}\n\n"
                
                # Add recent comments for context
                if comments:
                    context += "Recent Comments:\n"
                    for comment in comments[-5:]:  # Last 5 comments
                        context += f"\n---\n@{comment.user.login}: {comment.body}\n"
                
                return context
                
            elif self.context_type in ['pull_request', 'pull_request_comment']:
                pr = self.repo.get_pull(self.issue_number)
                return f"PR Title: {pr.title}\n\nPR Description:\n{pr.body}"
        except Exception as e:
            raise Exception(f"Failed to extract problem statement: {str(e)}")
    
    def validate_command(self):
        """Validate and parse the command"""
        valid_commands = {
            'analyze': 'Analyze the issue without proposing changes',
            'fix': 'Analyze and propose a fix',
            'test': 'Run tests on the current code',
            'review': 'Review the current changes'
        }
        
        if self.command not in valid_commands:
            raise ValueError(f"Invalid command '{self.command}'. Valid commands: {', '.join(valid_commands.keys())}")
        
        return valid_commands[self.command]
    
    def run_swe_agent(self, problem_statement):
        """Run SWE-agent on the problem"""
        try:
            self.post_status("🔄 Initializing SWE-Agent...", update=True)
            
            # Configure SWE-agent based on command
            model_name = os.environ.get('SWE_AGENT_MODEL', 'gpt-4')
            
            args = AgentArguments(
                model_name=model_name,
                data_path=f"github_issue_{self.issue_number}.json",
                repo_path=".",
                config_file=".github/swe_agent_config.yaml" if os.path.exists(".github/swe_agent_config.yaml") else None,
                per_instance_cost_limit=float(os.environ.get('SWE_AGENT_COST_LIMIT', '2.0'))
            )
            
            # Adjust problem statement based on command
            if self.command == 'analyze':
                problem_statement = f"Analyze this issue and provide insights, but do not propose code changes:\n\n{problem_statement}"
            elif self.command == 'fix':
                problem_statement = f"Analyze and fix this issue:\n\n{problem_statement}"
            elif self.command == 'test':
                problem_statement = f"Run relevant tests and report results:\n\n{problem_statement}"
            elif self.command == 'review':
                problem_statement = f"Review the current code/changes and provide feedback:\n\n{problem_statement}"
            
            # Create a temporary data file for SWE-agent
            data = {
                "repo": self.repo.full_name,
                "instance_id": f"{self.repo.name}-{self.issue_number}",
                "problem_statement": problem_statement,
                "issue_number": self.issue_number
            }
            
            with open(args.data_path, 'w') as f:
                json.dump(data, f)
            
            self.post_status("🔍 Analyzing the problem...", update=True)
            
            # Initialize and run agent
            env = SWEEnv(args)
            agent = Agent(args)
            
            # Run the agent
            info = agent.run(env)
            
            # Clean up
            if os.path.exists(args.data_path):
                os.remove(args.data_path)
            
            return info
            
        except Exception as e:
            raise Exception(f"SWE-Agent execution failed: {str(e)}")
    
    def apply_patch_to_pr(self, patch):
        """Apply the patch to the PR branch"""
        if not self.pr_head_ref or self.context_type not in ['pull_request', 'pull_request_comment']:
            return False, "Not a pull request context"
        
        try:
            # Clone the repository
            with tempfile.TemporaryDirectory() as tmpdir:
                # Clone the repo
                repo_url = f"https://x-access-token:{os.environ['GITHUB_TOKEN']}@github.com/{self.repo.full_name}.git"
                local_repo = Repo.clone_from(repo_url, tmpdir)
                
                # Checkout the PR branch
                local_repo.git.checkout(self.pr_head_ref)
                
                # Apply the patch
                patch_file = os.path.join(tmpdir, 'swe_agent.patch')
                with open(patch_file, 'w') as f:
                    f.write(patch)
                
                # Try to apply the patch
                try:
                    local_repo.git.apply(patch_file)
                except Exception as e:
                    return False, f"Failed to apply patch: {str(e)}"
                
                # Commit the changes
                local_repo.git.add(A=True)
                local_repo.index.commit(f"Apply SWE-Agent fix for #{self.issue_number}")
                
                # Push the changes
                origin = local_repo.remote('origin')
                origin.push(self.pr_head_ref)
                
                return True, "Patch applied successfully"
                
        except Exception as e:
            return False, f"Failed to apply patch: {str(e)}"
    
    def format_results(self, results, patch_applied=False, patch_message=""):
        """Format results for posting"""
        model_name = results.get('model_name', 'Unknown')
        cost = results.get('total_cost', 0)
        
        # Base response
        response = f"""## ✅ SWE-Agent Analysis Complete

**Command**: `{self.command}`
**Model**: {model_name}
**Cost**: ${cost:.2f}
**Status**: {'Success' if results.get('success', False) else 'Completed with issues'}
"""
        
        # Add command-specific results
        if self.command == 'analyze':
            response += f"""
### Analysis:
{results.get('analysis', 'No analysis provided')}
"""
        
        elif self.command == 'fix':
            if results.get('patch'):
                response += f"""
### Proposed Solution:
```diff
{results.get('patch', 'No changes proposed')}
```

### Explanation:
{results.get('explanation', 'No explanation provided')}
"""
                if patch_applied:
                    response += f"\n✅ **Patch automatically applied to PR branch**"
                elif patch_message:
                    response += f"\n⚠️ **Patch not applied**: {patch_message}"
            else:
                response += "\n### Result:\nNo code changes were necessary to address this issue.\n"
        
        elif self.command == 'test':
            response += f"""
### Test Results:
```
{results.get('test_output', 'No test output available')}
```
"""
        
        elif self.command == 'review':
            response += f"""
### Code Review:
{results.get('review_comments', 'No review comments provided')}
"""
        
        # Add any additional notes
        if results.get('notes'):
            response += f"\n### Additional Notes:\n{results.get('notes')}\n"
        
        response += """
---
*This analysis was performed automatically by SWE-Agent. Please review any proposed changes carefully.*
"""
        
        return response
    
    def post_error(self, error_message):
        """Post error message"""
        issue = self.repo.get_issue(self.issue_number)
        
        error_response = f"""## ❌ SWE-Agent Error

**Command**: `{self.command}`
**Error**: {error_message}

Please check:
1. The command syntax is correct
2. Required secrets (API keys) are configured
3. The repository has the necessary permissions

Valid commands: `analyze`, `fix`, `test`, `review`

Example usage:
```
@swe-agent-bot fix
@swe-agent-bot analyze
```

---
*If this error persists, please check the workflow logs for more details.*
"""
        
        issue.create_comment(error_response)
    
    def run(self):
        """Main execution flow"""
        try:
            # Validate command
            command_desc = self.validate_command()
            
            # Post initial status
            self.post_status(f"🚀 Starting: {command_desc}")
            
            # Extract problem statement
            problem = self.extract_problem_statement()
            
            # Run SWE-agent
            results = self.run_swe_agent(problem)
            
            # Apply patch if in PR context and command is 'fix'
            patch_applied = False
            patch_message = ""
            if self.command == 'fix' and results.get('patch') and self.context_type in ['pull_request', 'pull_request_comment']:
                self.post_status("📝 Applying patch to PR branch...", update=True)
                patch_applied, patch_message = self.apply_patch_to_pr(results['patch'])
            
            # Format and post results
            formatted_results = self.format_results(results, patch_applied, patch_message)
            
            # Delete status comment and post final results
            if self.status_comment:
                self.status_comment.delete()
            
            issue = self.repo.get_issue(self.issue_number)
            issue.create_comment(formatted_results)
            
        except Exception as e:
            # Post error message
            error_msg = f"{type(e).__name__}: {str(e)}"
            print(f"Error: {error_msg}")
            print(traceback.format_exc())
            
            # Delete status comment if exists
            if self.status_comment:
                self.status_comment.delete()
            
            self.post_error(error_msg)
            raise

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--context', required=True)
    parser.add_argument('--issue-number', type=int, required=True)
    parser.add_argument('--repo', required=True)
    parser.add_argument('--command', default='fix')
    parser.add_argument('--pr-head-ref', default='')
    parser.add_argument('--pr-base-ref', default='')
    
    args = parser.parse_args()
    
    wrapper = SWEAgentGitHubWrapper(
        args.repo, 
        args.issue_number, 
        args.context,
        args.command,
        args.pr_head_ref,
        args.pr_base_ref
    )
    
    wrapper.run()

if __name__ == "__main__":
    main()
