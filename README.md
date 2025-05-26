# SWE-Agent GitHub Actions Resolver

A complete GitHub Action that automatically resolves issues using [SWE-Agent](https://github.com/SWE-agent/SWE-agent) - an AI-powered autonomous software engineer. Generates patches and automatically creates Pull Requests.

## ✨ Features

- 🤖 **AI-Powered Issue Resolution**: Uses SWE-Agent with models like GPT-4o or Claude
- 💬 **Comment-Triggered**: Simply comment `@swe-agent fix this` on any issue
- 🔧 **Automatic Patch Generation**: Generates code patches to resolve issues
- 🔄 **Auto Pull Request Creation**: Automatically applies patches and creates PRs
- 📝 **Real-time Progress Updates**: Posts live updates to GitHub issues
- ⚡ **Complete Automation**: From analysis to PR creation, fully automated

## 🚀 Quick Setup

### Option 1: Complete Workflow (Recommended)
Add this workflow file to your repository at `.github/workflows/swe-agent.yml`:

```yaml
name: SWE-Agent Issue Resolver

on:
  issue_comment:
    types: [created]

permissions:
  issues: write
  contents: write
  pull-requests: write

jobs:
  generate-patch:
    name: Generate Patch with SWE-Agent
    if: github.event.issue.pull_request == null && contains(github.event.comment.body, '@swe-agent') && github.event.comment.user.login != 'github-actions[bot]'
    runs-on: ubuntu-latest
    timeout-minutes: 60
    
    outputs:
      patch_generated: ${{ steps.swe-agent.outputs.patch_generated }}
      patch_content: ${{ steps.swe-agent.outputs.patch_content }}
      execution_time: ${{ steps.swe-agent.outputs.execution_time }}
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0
      
      - name: Run SWE-Agent
        id: swe-agent
        uses: nimishchaudhari/swe-agent-resolver@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          llm_api_key: ${{ secrets.OPENAI_API_KEY }}
          model_name: ${{ vars.SWE_AGENT_MODEL || 'gpt-4o' }}
          trigger_phrase: '@swe-agent'
          timeout_minutes: 45

  apply-patch:
    name: Apply Patch and Create PR
    needs: generate-patch
    if: needs.generate-patch.outputs.patch_generated == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0
      
      - name: Set up Python (for linting)
        uses: actions/setup-python@v4
        with:
          python-version: '3.x'
      
      - name: Install GitHub CLI
        run: |
          curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
          echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
          sudo apt update
          sudo apt install gh
      
      - name: Install linting tools (optional)
        run: |
          pip install black isort flake8 || true
      
      - name: Apply patch and create PR
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PATCH_CONTENT: ${{ needs.generate-patch.outputs.patch_content }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          ISSUE_TITLE: ${{ github.event.issue.title }}
          MODEL_NAME: ${{ vars.SWE_AGENT_MODEL || 'gpt-4o' }}
          EXECUTION_TIME: ${{ needs.generate-patch.outputs.execution_time }}
        run: |
          set -e
          
          # Configure git
          git config --global user.name "swe-agent-bot[bot]"
          git config --global user.email "swe-agent-bot[bot]@users.noreply.github.com"
          
          # Create branch
          BRANCH_NAME="swe-agent-fix-issue-${ISSUE_NUMBER}-$(date +%s)"
          git checkout -b "$BRANCH_NAME"
          
          # Apply patch
          echo "$PATCH_CONTENT" > /tmp/swe_agent_fix.patch
          
          if git apply --check /tmp/swe_agent_fix.patch; then
            git apply /tmp/swe_agent_fix.patch
            
            # Run linting/formatting if tools are available
            if command -v black >/dev/null 2>&1; then
              find . -name "*.py" -exec black {} + || true
            fi
            
            if command -v isort >/dev/null 2>&1; then
              find . -name "*.py" -exec isort {} + || true
            fi
            
            # Check if there are any changes to commit
            if git diff --cached --quiet && git diff --quiet; then
              echo "No changes detected after applying patch"
              exit 1
            fi
            
            # Commit changes
            git add .
            git commit -m "Fix: Apply patch for issue #${ISSUE_NUMBER} by SWE-Agent"
            
            # Push branch and create PR
            git push origin "$BRANCH_NAME"
            
            PR_TITLE="SWE-Agent Fix for Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}"
            PR_BODY="Automatically generated by SWE-Agent. Issue: #${ISSUE_NUMBER}"
            
            DEFAULT_BRANCH=$(gh api repos/${{ github.repository }} --jq .default_branch)
            PR_URL=$(gh pr create --title "$PR_TITLE" --body "$PR_BODY" --base "$DEFAULT_BRANCH" --head "$BRANCH_NAME")
            
            # Update issue comment with PR link
            COMMENT_ID="${{ github.event.comment.id }}"
            gh api repos/${{ github.repository }}/issues/comments/$COMMENT_ID \
              --method PATCH \
              --field body="✅ **Solution Generated & Pull Request Created!** [View PR](${PR_URL})"
          else
            echo "Patch could not be applied cleanly - posting patch for manual review"
            exit 1
          fi
```

### Option 2: Patch Generation Only
If you only want patch generation without automatic PR creation, use this simpler workflow:

```yaml
name: SWE-Agent Patch Generator

on:
  issue_comment:
    types: [created]

permissions:
  issues: write
  contents: read

jobs:
  resolve_issue:
    name: Generate Patch with SWE-Agent
    runs-on: ubuntu-latest
    if: |
      github.event.comment.user.login != 'github-actions[bot]' &&
      contains(github.event.comment.body, '@swe-agent')
    
    steps:
      - name: Run SWE-Agent Resolver
        uses: nimishchaudhari/swe-agent-resolver@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          llm_api_key: ${{ secrets.OPENAI_API_KEY }}
          model_name: 'gpt-4o'
```

## 🔧 Required Setup

1. **Add your API key** as a repository secret:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Add a new secret named `OPENAI_API_KEY` with your OpenAI API key

2. **Optional: Set model preference** as a repository variable:
   - Add a variable named `SWE_AGENT_MODEL` with value like `gpt-4o`, `claude-3.5-sonnet`, etc.

## 🎯 Usage

Simply comment on any GitHub issue with the trigger phrase:

```
@swe-agent fix this bug
@swe-agent solve this problem  
@swe-agent help with this issue
```

### Complete Workflow Process:
1. **👀 Processing**: Reacts with eyes to show it's processing
2. **🤖 Analysis**: SWE-Agent analyzes the issue and codebase
3. **🔧 Patch Generation**: Creates a code patch to resolve the issue
4. **📄 Progress Updates**: Posts live updates to the issue comment
5. **🔄 Auto PR Creation**: Applies patch and creates a Pull Request
6. **✅ Completion**: Updates comment with PR link for review

### Patch-Only Workflow Process:
1. **👀 Processing**: Reacts with eyes to show it's processing  
2. **🤖 Analysis**: SWE-Agent analyzes the issue and codebase
3. **🔧 Patch Generation**: Creates a code patch to resolve the issue
4. **📄 Result**: Posts the generated patch as a comment
5. **✅ Complete**: Reacts with thumbs up on success or 😕 on failure

## ⚙️ Configuration

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github_token` | GitHub token for API access | Yes | `${{ github.token }}` |
| `llm_api_key` | OpenAI/Anthropic API key | Yes | - |
| `trigger_phrase` | Phrase that triggers the agent | No | `@swe-agent` |
| `model_name` | AI model to use | No | `gpt-4o` |
| `timeout_minutes` | Max execution time | No | `30` |

### Supported Models

- `gpt-4o` (OpenAI GPT-4 Omni)
- `gpt-4-turbo` (OpenAI GPT-4 Turbo)
- `claude-3.5-sonnet` (Anthropic Claude)

## 🔒 Security

- Only processes comments containing the trigger phrase
- Uses repository's default permissions
- API keys are stored securely as GitHub secrets
- No data is sent to external services except the chosen AI provider

## 📝 Example

1. **Create an issue** describing a bug or feature request
2. **Comment** `@swe-agent fix this` on the issue
3. **Wait** for SWE-Agent to analyze and generate a solution
4. **Review** the generated patch in the comment
5. **Apply** the patch to your codebase if it looks good

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [SWE-Agent](https://github.com/SWE-agent/SWE-agent) - The autonomous software engineer
- Built for the GitHub Actions community

---

**Note**: This action requires an OpenAI or Anthropic API key. Usage costs depend on the model and complexity of issues being resolved.
* Dec 7: [An interview with the SWE-agent & SWE-bench team](https://www.youtube.com/watch?v=fcr8WzeEXyk)

## 🚀 Get started!

👉 Try SWE-agent in your browser: [![Open in GitHub Codespaces](https://img.shields.io/badge/Open_in_GitHub_Codespaces-gray?logo=github)](https://codespaces.new/SWE-agent/SWE-agent) ([more information](https://swe-agent.com/latest/installation/codespaces/))

Read our [documentation][docs] to learn more:

* [Installation](https://swe-agent.com/latest/installation/source/)
* [Hello world from the command line](https://swe-agent.com/latest/usage/hello_world/)
* [Benchmarking on SWE-bench](https://swe-agent.com/latest/usage/batch_mode/)
* [Frequently Asked Questions](https://swe-agent.com/latest/faq/)

[docs]: https://swe-agent.com

## SWE-agent for offensive cybersecurity (EnIGMA) <a name="enigma"></a>

<img src="https://github.com/user-attachments/assets/84599168-11a7-4776-8a49-33dbf0758bb2" height="80px"></img>

[SWE-agent: EnIGMA][enigma] is a mode for solving offensive cybersecurity (capture the flag) challenges.
EnIGMA achieves state-of-the-art results on multiple cybersecurity benchmarks (see [leaderboard](https://enigma-agent.com/#results)).
Please use [SWE-agent 0.7](https://github.com/SWE-agent/SWE-agent/tree/v0.7) while we update EnIGMA for 1.0.

[enigma]: https://enigma-agent.com
[SWE-bench]: https://github.com/SWE-bench/SWE-bench
[nyu-ctf]: https://arxiv.org/abs/2406.05590

In addition, you might be interested in the following projects:


<div align="center">
  <a href="https://github.com/SWE-agent/SWE-ReX"><img src="docs/assets/swerex_logo_text_below.svg" alt="SWE-ReX" height="120px"></a>
   &nbsp;&nbsp;
  <a href="https://github.com/SWE-bench/SWE-bench"><img src="docs/assets/swebench_logo_text_below.svg" alt="SWE-bench" height="120px"></a>
  &nbsp;&nbsp;
  <!-- <a href="https://github.com/SWE-agent/SWE-agent"><img src="docs/assets/sweagent_logo_text_below.svg" alt="SWE-agent" height="120px"></a> -->
  <a href="https://github.com/SWE-bench/SWE-smith"><img src="docs/assets/swesmith_logo_text_below.svg" alt="SWE-smith" height="120px"></a>
  &nbsp;&nbsp;
  <a href="https://github.com/SWE-bench/sb-cli"><img src="docs/assets/sbcli_logo_text_below.svg" alt="sb-cli" height="120px"></a>
</div>

## Contributions <a name="contributions"></a>

If you'd like to contribute to the codebase, we welcome [issues](https://github.com/SWE-agent/SWE-agent/issues) and [pull requests](https://github.com/SWE-agent/SWE-agent/pulls)! For larger code changes, we always encourage discussion in issues first.

## Citation & contact <a name="citation"></a>

SWE-agent is an academic project started at Princeton University by John Yang*, Carlos E. Jimenez*, Alexander Wettig, Kilian Lieret, Shunyu Yao, Karthik Narasimhan, and Ofir Press.
Contact person: [John Yang](https://john-b-yang.github.io/), [Carlos E. Jimenez](http://www.carlosejimenez.com/), and [Kilian Lieret](https://www.lieret.net/) (Email: johnby@stanford.edu, carlosej@princeton.edu, kl5675@princeton.edu).

If you found this work helpful, please consider citing it using the following:

<details>
<summary> SWE-agent citation</summary>

```bibtex
@inproceedings{yang2024sweagent,
  title={{SWE}-agent: Agent-Computer Interfaces Enable Automated Software Engineering},
  author={John Yang and Carlos E Jimenez and Alexander Wettig and Kilian Lieret and Shunyu Yao and Karthik R Narasimhan and Ofir Press},
  booktitle={The Thirty-eighth Annual Conference on Neural Information Processing Systems},
  year={2024},
  url={https://arxiv.org/abs/2405.15793}
}
```
</details>

If you used the summarizer, interactive commands or the offensive cybersecurity capabilities in SWE-agent, please also consider citing:

<details>
<summary>EnIGMA citation</summary>

```bibtex
@misc{abramovich2024enigmaenhancedinteractivegenerative,
      title={EnIGMA: Enhanced Interactive Generative Model Agent for CTF Challenges},
      author={Talor Abramovich and Meet Udeshi and Minghao Shao and Kilian Lieret and Haoran Xi and Kimberly Milner and Sofija Jancheska and John Yang and Carlos E. Jimenez and Farshad Khorrami and Prashanth Krishnamurthy and Brendan Dolan-Gavitt and Muhammad Shafique and Karthik Narasimhan and Ramesh Karri and Ofir Press},
      year={2024},
      eprint={2409.16165},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2409.16165},
}
```
</details>


## 🪪 License <a name="license"></a>
MIT. Check `LICENSE`.


<div align="center">

[![Pytest](https://github.com/SWE-agent/SWE-agent/actions/workflows/pytest.yaml/badge.svg)](https://github.com/SWE-agent/SWE-agent/actions/workflows/pytest.yaml)
[![build-docs](https://github.com/SWE-agent/SWE-agent/actions/workflows/build-docs.yaml/badge.svg)](https://github.com/SWE-agent/SWE-agent/actions/workflows/build-docs.yaml)
[![codecov](https://codecov.io/gh/SWE-agent/SWE-agent/graph/badge.svg?token=18XAVDK365)](https://codecov.io/gh/SWE-agent/SWE-agent)
[![pre-commit.ci status](https://results.pre-commit.ci/badge/github/SWE-agent/SWE-agent/main.svg)](https://results.pre-commit.ci/latest/github/SWE-agent/SWE-agent/main)
[![Markdown links](https://github.com/SWE-agent/SWE-agent/actions/workflows/check-links.yaml/badge.svg)](https://github.com/SWE-agent/SWE-agent/actions/workflows/check-links.yaml)

</div>
