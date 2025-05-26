# SWE-Agent GitHub Actions Resolver

A simple GitHub Action that automatically resolves issues using [SWE-Agent](https://github.com/SWE-agent/SWE-agent) - an AI-powered autonomous software engineer.

## ✨ Features

- 🤖 **AI-Powered Issue Resolution**: Uses SWE-Agent with models like GPT-4o or Claude
- 💬 **Comment-Triggered**: Simply comment `@swe-agent fix this` on any issue
- 🔧 **Automatic Patch Generation**: Generates code patches to resolve issues
- 📝 **Clear Communication**: Posts results directly to GitHub issues
- ⚡ **Simple Setup**: Just add the action to your repository

## 🚀 Quick Setup

1. **Add the workflow file** to your repository at `.github/workflows/swe-resolver.yml`:

```yaml
name: SWE-Agent Issue Resolver

on:
  issue_comment:
    types: [created]

permissions:
  issues: write
  contents: read

jobs:
  resolve_issue:
    name: Resolve Issue with SWE-Agent
    runs-on: ubuntu-latest
    if: |
      github.event.comment.user.login != 'github-actions[bot]' &&
      contains(github.event.comment.body, '@swe-agent')
    
    steps:
      - name: Run SWE-Agent Resolver
        uses: nimishchaudhari/SWE-agent-resolver@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          llm_api_key: ${{ secrets.OPENAI_API_KEY }}
          model_name: 'gpt-4o'
```

2. **Add your OpenAI API key** as a repository secret named `OPENAI_API_KEY`

3. **That's it!** Comment `@swe-agent fix this issue` on any issue to trigger the resolver

## 🎯 Usage

Simply comment on any GitHub issue with the trigger phrase:

```
@swe-agent fix this bug
@swe-agent solve this problem
@swe-agent help with this issue
```

The action will:
1. 👀 React with eyes to show it's processing
2. 🤖 Run SWE-Agent to analyze and fix the issue
3. 📄 Post the generated patch as a comment
4. ✅ React with thumbs up on success or 😕 on failure

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
