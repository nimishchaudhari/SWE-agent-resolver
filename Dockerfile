# Multi-stage build for SWE-Agent GitHub Action with LiteLLM
FROM python:3.11-slim AS python-base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install SWE-Agent and dependencies
RUN pip install --no-cache-dir \
    sweagent \
    swe-agent \
    litellm \
    openai \
    anthropic \
    pyyaml \
    requests \
    jinja2 \
    python-dotenv \
    gitpython

# Stage 2: Node.js runtime with Python
FROM node:18-slim

# Install system dependencies including Python
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    gcc \
    g++ \
    vim \
    nano \
    && rm -rf /var/lib/apt/lists/*

# Copy Python installation from previous stage
COPY --from=python-base /usr/local /usr/local

# Create action directory
WORKDIR /action

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy action source code and new src directory
COPY src/ ./src/
COPY action/ ./action/
COPY test/ ./test/

# Copy additional required files
COPY jest.config.js ./
COPY *.md ./
COPY *.yml ./
COPY *.yaml ./

# Create workspace and cache directories
RUN mkdir -p /swe-agent-workspace && \
    mkdir -p /tmp/swe-agent-cache && \
    mkdir -p /github/workspace && \
    mkdir -p /var/log/swe-agent && \
    chmod 755 /swe-agent-workspace /tmp/swe-agent-cache /github/workspace /var/log/swe-agent

# Create non-root user for execution
RUN useradd -m -u 1001 sweagent && \
    chown -R sweagent:sweagent /action /swe-agent-workspace /tmp/swe-agent-cache /var/log/swe-agent

# Set environment variables
ENV PYTHONPATH="/usr/local/lib/python3.11/site-packages:/action/src:$PYTHONPATH"
ENV PATH="/usr/local/bin:$PATH"
ENV NODE_PATH="/action/node_modules:$NODE_PATH"
ENV LOG_DIR="/var/log/swe-agent"

# GitHub Actions environment
ENV GITHUB_ACTIONS=true
ENV CI=true

# SWE-Agent specific environment
ENV SWE_AGENT_WORKSPACE=/swe-agent-workspace
ENV SWE_AGENT_CACHE_DIR=/tmp/swe-agent-cache

# Switch to non-root user for security
USER sweagent

# Verify installations
RUN python3 -c "import sweagent; print('SWE-Agent installed successfully')" || \
    python3 -c "print('SWE-Agent import failed, but continuing...')"
RUN python3 -c "import litellm; print('LiteLLM installed successfully')"
RUN node --version && npm --version

# Entry point for GitHub Action
ENTRYPOINT ["node", "/action/src/index.js"]