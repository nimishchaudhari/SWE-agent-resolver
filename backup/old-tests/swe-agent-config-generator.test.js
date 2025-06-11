const SWEAgentConfigGenerator = require('../../action/swe-agent-config-generator');
const yaml = require('js-yaml');

describe('SWEAgentConfigGenerator', () => {
  let configGenerator;

  beforeEach(() => {
    configGenerator = new SWEAgentConfigGenerator();
  });

  describe('generateConfig', () => {
    const baseOptions = {
      model: {
        model: 'gpt-4o',
        api_key: '$OPENAI_API_KEY',
        temperature: 0.0,
        max_tokens: 4000,
        timeout: 300,
        api_base: 'https://api.openai.com/v1'
      },
      problem: 'issue_analysis',
      context: {
        type: 'issue',
        issueNumber: 123,
        title: 'Test Issue',
        body: 'Test issue description',
        author: 'testuser',
        repoOwner: 'test-owner',
        repoName: 'test-repo'
      }
    };

    test('should generate valid YAML configuration', () => {
      const config = configGenerator.generateConfig(baseOptions);
      const parsed = yaml.load(config);
      
      expect(parsed).toBeDefined();
      expect(parsed.problem_statement).toBeDefined();
      expect(parsed.agent).toBeDefined();
      expect(parsed.env).toBeDefined();
      expect(parsed.metadata).toBeDefined();
    });

    test('should include model configuration', () => {
      const config = configGenerator.generateConfig(baseOptions);
      const parsed = yaml.load(config);
      
      expect(parsed.agent.model.name).toBe('gpt-4o');
      expect(parsed.agent.model.api_key).toBe('$OPENAI_API_KEY');
      expect(parsed.agent.model.temperature).toBe(0.0);
      expect(parsed.agent.model.max_tokens).toBe(4000);
    });

    test('should generate correct problem statement', () => {
      const config = configGenerator.generateConfig(baseOptions);
      const parsed = yaml.load(config);
      
      expect(parsed.problem_statement.type).toBe('issue_analysis');
      expect(parsed.problem_statement.description).toContain('Test Issue');
      expect(parsed.problem_statement.context.title).toBe('Test Issue');
    });

    test('should include default tools for issue analysis', () => {
      const config = configGenerator.generateConfig(baseOptions);
      const parsed = yaml.load(config);
      
      const toolNames = parsed.agent.tools.map(t => t.name);
      expect(toolNames).toContain('str_replace_editor');
      expect(toolNames).toContain('bash');
      expect(toolNames).toContain('file_viewer');
      expect(toolNames).toContain('python_executor');
    });

    test('should use custom tools when provided', () => {
      const options = {
        ...baseOptions,
        tools: ['bash', 'git_tool']
      };
      
      const config = configGenerator.generateConfig(options);
      const parsed = yaml.load(config);
      
      expect(parsed.agent.tools).toHaveLength(2);
      expect(parsed.agent.tools[0].name).toBe('bash');
      expect(parsed.agent.tools[1].name).toBe('git_tool');
    });

    test('should include custom instructions in system prompt', () => {
      const options = {
        ...baseOptions,
        customInstructions: 'Follow TDD practices'
      };
      
      const config = configGenerator.generateConfig(options);
      const parsed = yaml.load(config);
      
      expect(parsed.agent.system_prompt).toContain('Follow TDD practices');
    });

    test('should generate Azure-specific configuration', () => {
      const options = {
        ...baseOptions,
        model: {
          model: 'azure/gpt-4',
          api_key: '$AZURE_OPENAI_API_KEY',
          api_base: '$AZURE_OPENAI_ENDPOINT',
          api_version: '$AZURE_OPENAI_API_VERSION',
          azure_deployment: 'gpt-4'
        }
      };
      
      const config = configGenerator.generateConfig(options);
      const parsed = yaml.load(config);
      
      expect(parsed.agent.model.azure_deployment).toBe('gpt-4');
      expect(parsed.agent.model.api_version).toBe('$AZURE_OPENAI_API_VERSION');
    });

    test('should handle PR review context', () => {
      const options = {
        ...baseOptions,
        problem: 'pr_review',
        context: {
          type: 'pull_request',
          prNumber: 456,
          title: 'Test PR',
          body: 'Test PR description',
          author: 'testuser',
          repoOwner: 'test-owner',
          repoName: 'test-repo',
          baseBranch: 'main',
          headBranch: 'feature',
          changedFiles: 5
        }
      };
      
      const config = configGenerator.generateConfig(options);
      const parsed = yaml.load(config);
      
      expect(parsed.problem_statement.type).toBe('pr_review');
      expect(parsed.problem_statement.context.base_branch).toBe('main');
      expect(parsed.problem_statement.context.head_branch).toBe('feature');
      expect(parsed.problem_statement.context.changed_files).toBe(5);
    });

    test('should include comment in context for comment events', () => {
      const options = {
        ...baseOptions,
        context: {
          ...baseOptions.context,
          type: 'issue_comment',
          comment: '@swe-agent help me fix this'
        }
      };
      
      const config = configGenerator.generateConfig(options);
      const parsed = yaml.load(config);
      
      expect(parsed.problem_statement.context.comment).toBe('@swe-agent help me fix this');
      expect(parsed.agent.system_prompt).toContain('@swe-agent help me fix this');
    });

    test('should include metadata with generation info', () => {
      const config = configGenerator.generateConfig(baseOptions);
      const parsed = yaml.load(config);
      
      expect(parsed.metadata.generated_by).toBe('swe-agent-resolver');
      expect(parsed.metadata.generated_at).toBeDefined();
      expect(parsed.metadata.problem_type).toBe('issue_analysis');
      expect(parsed.metadata.github_context.repository).toBe('test-owner/test-repo');
    });
  });

  describe('formatToolsConfig', () => {
    test('should format tools with conditions', () => {
      const tools = ['bash', 'python_executor', 'node_executor'];
      const result = configGenerator.formatToolsConfig(tools);
      
      expect(result).toEqual([
        { name: 'bash', condition: 'always' },
        { name: 'python_executor', condition: 'python' },
        { name: 'node_executor', condition: 'javascript' }
      ]);
    });

    test('should handle unknown tools', () => {
      const tools = ['custom_tool'];
      const result = configGenerator.formatToolsConfig(tools);
      
      expect(result).toEqual([{ name: 'custom_tool' }]);
    });
  });

  describe('generateSystemPrompt', () => {
    test('should generate base prompt', () => {
      const result = configGenerator.generateSystemPrompt(
        'Base prompt',
        { type: 'issue' },
        ''
      );
      
      expect(result).toContain('Base prompt');
      expect(result).toContain('GitHub Actions environment');
    });

    test('should add comment context', () => {
      const result = configGenerator.generateSystemPrompt(
        'Base prompt',
        { type: 'issue_comment', comment: 'Help me!' },
        ''
      );
      
      expect(result).toContain('User Comment: "Help me!"');
      expect(result).toContain('Respond specifically to this comment');
    });

    test('should add PR context', () => {
      const result = configGenerator.generateSystemPrompt(
        'Base prompt',
        { type: 'pull_request', changedFiles: 10 },
        ''
      );
      
      expect(result).toContain('This PR affects 10 file(s)');
    });

    test('should include custom instructions', () => {
      const result = configGenerator.generateSystemPrompt(
        'Base prompt',
        { type: 'issue' },
        'Always include tests'
      );
      
      expect(result).toContain('Additional Instructions: Always include tests');
    });
  });

  describe('validateConfig', () => {
    test('should validate correct configuration', () => {
      const config = configGenerator.generateConfig({
        model: { model: 'gpt-4o', api_key: '$KEY' },
        problem: 'issue_analysis',
        context: { type: 'issue', repoOwner: 'owner', repoName: 'repo' }
      });
      
      const result = configGenerator.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing agent section', () => {
      const config = yaml.dump({ env: {} });
      const result = configGenerator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing agent configuration');
    });

    test('should detect missing model name', () => {
      const config = yaml.dump({
        agent: { model: { api_key: '$KEY' } },
        env: {}
      });
      
      const result = configGenerator.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing model name');
    });

    test('should warn about missing tools', () => {
      const config = yaml.dump({
        agent: { 
          model: { name: 'gpt-4o', api_key: '$KEY' },
          tools: []
        },
        env: {}
      });
      
      const result = configGenerator.validateConfig(config);
      expect(result.warnings).toContain('No tools configured - agent may have limited capabilities');
    });

    test('should handle invalid YAML', () => {
      const result = configGenerator.validateConfig('invalid: yaml: format:');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid YAML');
    });
  });

  describe('removeNullValues', () => {
    test('should remove null and undefined values', () => {
      const obj = {
        a: 1,
        b: null,
        c: undefined,
        d: {
          e: 2,
          f: null,
          g: undefined
        }
      };
      
      configGenerator.removeNullValues(obj);
      
      expect(obj).toEqual({
        a: 1,
        d: { e: 2 }
      });
    });

    test('should preserve arrays', () => {
      const obj = {
        tools: ['bash', 'git'],
        empty: null
      };
      
      configGenerator.removeNullValues(obj);
      
      expect(obj).toEqual({
        tools: ['bash', 'git']
      });
    });
  });
});