# Multi-stage build for SWE-Agent GitHub Action with LiteLLM
FROM python:3.11-slim AS python-base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install SWE-Agent and LiteLLM
RUN pip install --no-cache-dir \
    swe-agent \
    litellm \
    openai \
    anthropic \
    pyyaml \
    requests \
    jinja2

# Create SWE-Agent workspace
RUN mkdir -p /swe-agent-workspace && chmod 755 /swe-agent-workspace

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
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies from previous stage
COPY --from=python-base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-base /usr/local/bin /usr/local/bin

# Create action directory
WORKDIR /action

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy action source code
COPY src/ ./src/
COPY action/ ./action/

# Create workspace and cache directories
RUN mkdir -p /swe-agent-workspace && \
    mkdir -p /tmp/swe-agent-cache && \
    mkdir -p /github/workspace && \
    chmod 755 /swe-agent-workspace /tmp/swe-agent-cache /github/workspace

# Create non-root user for execution
RUN useradd -m -u 1001 sweagent && \
    chown -R sweagent:sweagent /action /swe-agent-workspace /tmp/swe-agent-cache

# Set Python path for SWE-Agent
ENV PYTHONPATH="/usr/local/lib/python3.11/site-packages:$PYTHONPATH"
ENV PATH="/usr/local/bin:$PATH"

# GitHub Actions environment
ENV GITHUB_ACTIONS=true
ENV CI=true

# Switch to non-root user for security
USER sweagent

# Entry point for GitHub Action
ENTRYPOINT ["node", "/action/action/entrypoint.js"]