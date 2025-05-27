# Enhanced SWE-Agent Features: Opinion, Analysis & Visual Responses

## Overview

The SWE-Agent has been enhanced to support comment-based opinion/analysis responses in addition to code patches. Users can now request:

- **Opinions & Advice**: Get expert recommendations and best practices
- **Technical Analysis**: Receive detailed code and architectural analysis  
- **Visual Content**: Generate diagrams, charts, and visual representations
- **Traditional Patches**: Continue using full SWE-Agent for code fixes

## 🎯 Request Types & Triggers

### Opinion/Advisory Requests
**Triggers:** `opinion`, `advice`, `suggest`, `recommend`, `think`, `thoughts`, `what do you`, `should i`, `best practice`, `approach`, `strategy`

**Examples:**
```
@swe-agent What do you think about this architecture approach?
@swe-agent Any advice on how to handle this error scenario?
@swe-agent Should I use Redux or Context API for state management?
@swe-agent What's the best practice for database migrations?
```

### Analysis Requests  
**Triggers:** `analyze`, `analysis`, `explain`, `understand`, `investigate`, `examine`, `review`, `assess`, `evaluate`, `why`, `how work`, `what happen`

**Examples:**
```
@swe-agent Can you analyze this code structure for performance issues?
@swe-agent Explain why this algorithm is failing
@swe-agent Review the security implications of this API design
@swe-agent Investigate what's causing the memory leak
```

### Visual Content Requests
**Triggers:** `chart`, `plot`, `graph`, `diagram`, `visualize`, `visualization`, `picture`, `image`, `screenshot`, `draw`, `show visual`

**Examples:**
```
@swe-agent Create a diagram showing the data flow
@swe-agent Generate a chart of the API response times
@swe-agent Draw a sequence diagram for the authentication process
@swe-agent Visualize the database schema relationships
```

### Traditional Patch Requests
**Triggers:** `fix`, `patch`, `solve`, `resolve`, `implement`, `code`, `bug`, `error`, `issue`

**Examples:**
```
@swe-agent Fix this authentication bug
@swe-agent Implement error handling for the API
@swe-agent Resolve the memory leak in the worker process
```

## ⚙️ Configuration Options

### Enhanced Input Parameters

#### `response_mode`
Controls the response behavior:
- `auto` (default): Automatically detect intent from comment content
- `patch`: Force traditional patch generation
- `opinion`: Force opinion/advisory response only
- `analysis`: Force technical analysis response only

#### `enable_visual_content`
- `true` (default): Enable visual content generation
- `false`: Disable visual content features

#### `visual_content_format`
- `all` (default): Generate all available visual formats
- `mermaid`: Generate Mermaid diagrams only
- `ascii`: Generate ASCII art only
- `code`: Generate code examples only

#### `max_comment_length`
- Default: `65536` characters
- Maximum length for generated responses

### Example Workflow Configuration

```yaml
name: Enhanced SWE-Agent
on:
  issue_comment:
    types: [created]

jobs:
  swe-agent:
    if: contains(github.event.comment.body, '@swe-agent')
    runs-on: ubuntu-latest
    steps:
      - uses: nimishchaudhari/swe-agent-resolver@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          model_name: 'gpt-4o'
          response_mode: 'auto'              # Auto-detect intent
          enable_visual_content: 'true'      # Enable visual responses
          visual_content_format: 'all'       # All visual formats
          max_comment_length: '32768'        # Shorter responses
```

## 🚀 Usage Examples

### 1. Architecture Advice
**Comment:** `@swe-agent What do you think about using microservices for this project? Any advice on the trade-offs?`

**Response:** Expert opinion covering:
- Microservices benefits and drawbacks
- Project-specific recommendations
- Implementation considerations
- Best practices and alternatives

### 2. Code Analysis
**Comment:** `@swe-agent Can you analyze this authentication flow for security vulnerabilities?`

**Response:** Technical analysis including:
- Security assessment
- Architecture review
- Performance implications
- Maintainability considerations

### 3. Visual Diagrams
**Comment:** `@swe-agent Create a diagram showing how the user authentication process works`

**Response:** Visual content with:
- Mermaid sequence diagrams
- ASCII flow charts
- Code examples
- Usage instructions

### 4. Traditional Bug Fix
**Comment:** `@swe-agent Fix the SQL injection vulnerability in the login endpoint`

**Response:** Traditional SWE-Agent behavior:
- Code analysis
- Patch generation
- Implementation details
- Testing recommendations

## 🔧 API Integration

### Supported AI Providers

The enhanced features support multiple AI providers:

1. **OpenAI** (gpt-4o, gpt-4-turbo, gpt-3.5-turbo)
2. **Anthropic** (claude-3-5-sonnet, claude-3-haiku, claude-3-opus)
3. **OpenRouter** (Any supported model)
4. **Google Gemini** (gemini-pro, gemini-1.5-pro, gemini-1.5-flash)

### Lightweight Processing

For opinion/analysis requests, the agent uses lightweight API calls instead of the full SWE-Agent pipeline:
- Faster response times
- Lower resource usage
- Reduced API costs
- Maintains quality insights

## 📊 Response Formats

### Opinion Response Template
```markdown
💡 **SWE-Agent Expert Opinion**

**Issue:** #123 - Your Issue Title
**Model:** gpt-4o
**Response Type:** Opinion & Advisory

## 🎯 My Recommendation
[Expert opinion and advice]

## 🤔 Analysis & Considerations  
[Detailed analysis of trade-offs]

## 🚀 Next Steps
[Recommended actions]

---
*💡 SWE-Agent using gpt-4o • Opinion & advisory response*
```

### Analysis Response Template
```markdown
🔍 **SWE-Agent Code Analysis Report**

**Issue:** #123 - Your Issue Title  
**Model:** gpt-4o
**Response Type:** Technical Analysis

## 📊 Analysis Results
[Technical findings]

## 🔍 Technical Details
[In-depth analysis]

## 🎯 Key Findings
[Summary of important points]

---
*🔍 SWE-Agent using gpt-4o • Technical analysis complete*
```

### Visual Response Template
```markdown
📊 **SWE-Agent Visual Analysis**

**Issue:** #123 - Your Issue Title
**Model:** gpt-4o
**Response Type:** Visual Content

## 📈 Generated Visualization
[Mermaid diagrams, ASCII art, code examples]

## 🎨 Visual Content Details
[Additional formats and explanations]

## 📋 How to Use This Visualization
[Usage instructions]

---
*📊 SWE-Agent using gpt-4o • Visual content generated*
```

## 🎭 Enhanced Reactions

The agent now provides context-aware reactions:
- 💡 (`bulb`) for opinion responses
- 🔍 (`mag`) for analysis responses  
- 📊 (`chart_with_upwards_trend`) for visual content
- 🚀 (`rocket`) for successful patches
- ⚠️ (`warning`) for API errors

## 🔍 Intent Detection

The system uses intelligent keyword matching to detect user intent:

### Priority Order:
1. **Opinion/Advice** keywords take precedence for advisory responses
2. **Analysis** keywords trigger technical analysis  
3. **Visual** keywords enable diagram generation
4. **Patch** keywords (or default) use traditional SWE-Agent

### Smart Detection Examples:
- "What's your opinion on using Redis for caching?" → Opinion
- "Analyze the performance of this database query" → Analysis  
- "Show me a diagram of the API architecture" → Visual
- "Fix the bug in the authentication system" → Patch

## 🚦 Error Handling

### API Failures
- Graceful fallback between different AI providers
- Clear error messages for missing API keys
- Retry logic for temporary failures

### Validation
- Comment length limits
- Required environment variables
- API response validation

## 🔐 Security & Best Practices

### API Key Management
Store API keys as repository secrets:
```yaml
secrets:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

### Rate Limiting
- Respect AI provider rate limits
- Implement backoff strategies
- Monitor usage and costs

### Content Filtering
- Responses are filtered for appropriate content
- Professional and helpful tone maintained
- Focus on technical accuracy and best practices

## 🎓 Migration Guide

### From Traditional SWE-Agent
1. **No changes required** for existing workflows
2. **Add new parameters** to enable enhanced features
3. **Configure API keys** for additional providers
4. **Test different request types** to familiarize users

### Backward Compatibility
- All existing functionality preserved
- Default behavior unchanged
- Gradual adoption possible

## 📈 Monitoring & Analytics

### Response Quality
- Monitor user feedback on different response types
- Track successful vs. failed intent detection
- Analyze response length and relevance

### Performance Metrics
- Response time for different request types
- API usage and costs
- Error rates and fallback effectiveness

## 🔮 Future Enhancements

### Planned Features
- **Multi-language support** for international teams
- **Custom templates** for response formatting
- **Integration with documentation** systems
- **Learning from feedback** to improve responses

### Community Contributions
- Submit feature requests via GitHub issues
- Contribute templates and improvements
- Share usage patterns and best practices

## 📚 Resources

- [SWE-Agent Documentation](../README.md)
- [GitHub Actions Workflow Examples](../workflow-example.yml)
- [Migration Guide](../MIGRATION_GUIDE.md)
- [Docker Setup](../DOCKER_CACHING.md)

---

**Ready to enhance your development workflow?** Try different request types and discover how SWE-Agent can provide more than just code fixes!
