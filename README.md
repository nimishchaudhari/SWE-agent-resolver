# SWE-Agent GitHub Action

A GitHub Action that wraps the SWE-Agent CLI to provide automated software engineering assistance for your repositories.

## Features

- **Issue Analysis**: Automatically analyzes GitHub issues and provides insights and recommendations
- **PR Review**: Reviews pull requests and suggests improvements
- **Command Processing**: Responds to @swe-agent mentions in comments
- **Concurrent Job Processing**: Handles multiple requests simultaneously
- **Formatted Results**: Returns well-formatted markdown responses

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub        │    │   Node.js       │    │   SWE-Agent     │
│   Webhooks      │───▶│   Server        │───▶│   CLI           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Result        │
                       │   Processor     │
                       └─────────────────┘
```

## Setup

### 1. Configure GitHub Webhook

1. Go to your repository settings
2. Navigate to "Webhooks"
3. Add a new webhook with:
   - **Payload URL**: Your server endpoint + `/webhook`
   - **Content type**: `application/json`
   - **Secret**: A secure random string
   - **Events**: Issues, Pull requests, Issue comments

### 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_TOKEN=your_github_token
SWE_AGENT_PATH=/path/to/swe-agent
```

### 3. Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t swe-agent-action .
docker run -p 3000:3000 --env-file .env swe-agent-action
```

## Usage

### As a GitHub Action

```yaml
name: SWE-Agent
on:
  issues:
    types: [opened]
  pull_request:
    types: [opened]
  issue_comment:
    types: [created]

jobs:
  swe-agent:
    runs-on: ubuntu-latest
    steps:
      - uses: your-org/swe-agent-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          webhook-secret: ${{ secrets.WEBHOOK_SECRET }}
```

### Direct Server Deployment

1. Deploy the Node.js server to your infrastructure
2. Configure the webhook URL to point to your server
3. The server will automatically handle incoming GitHub events

## Module Structure

- **`src/github/`** - GitHub API integration and webhook handling
- **`src/swe-agent/`** - SWE-Agent CLI orchestration and job management
- **`src/config/`** - Configuration management and validation
- **`src/result-processor/`** - Output formatting and result processing
- **`src/utils/`** - Logging and utility functions

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_WEBHOOK_SECRET` | Secret for webhook validation | Required |
| `GITHUB_TOKEN` | GitHub API token | Required |
| `SWE_AGENT_PATH` | Path to SWE-Agent executable | `/usr/local/bin/swe-agent` |
| `SWE_AGENT_TIMEOUT` | Job timeout in milliseconds | `300000` |
| `MAX_CONCURRENT_JOBS` | Maximum concurrent jobs | `3` |
| `LOG_LEVEL` | Logging level | `info` |

## Health Monitoring

The server provides a health endpoint at `/health` that returns:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## License

[Your License Here]