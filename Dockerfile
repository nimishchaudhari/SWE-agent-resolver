# Use the same base image as SWE-agent Codespaces for compatibility
FROM mcr.microsoft.com/vscode/devcontainers/miniconda:0-3

# Install system dependencies and Node.js (following SWE-agent devcontainer setup)
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    build-essential \
    gcc \
    g++ \
    vim \
    nano \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (similar to SWE-agent oncreate.sh)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

# Install SWE-Agent from source (following devcontainer approach)
WORKDIR /opt
RUN git clone https://github.com/SWE-agent/SWE-agent.git && \
    cd SWE-agent && \
    pip install -e . && \
    git config --global --add safe.directory /opt/SWE-agent && \
    chown -R vscode:vscode /opt/SWE-agent

# Install additional Python dependencies
RUN pip install --no-cache-dir \
    litellm \
    openai \
    anthropic \
    pyyaml \
    requests \
    jinja2 \
    python-dotenv \
    gitpython

# Create action directory
WORKDIR /action

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy action source code and simplified structure  
COPY src/ ./src/
COPY action/ ./action/
COPY utils/ ./utils/
COPY test/ ./test/

# Copy additional required files
COPY jest.config.js ./
COPY *.md ./
COPY *.yml ./
COPY *.yaml ./

# Create workspace and cache directories with proper permissions
RUN mkdir -p /swe-agent-workspace && \
    mkdir -p /tmp/swe-agent-cache && \
    mkdir -p /github/workspace && \
    mkdir -p /github/workspace/logs && \
    mkdir -p /var/log/swe-agent && \
    chmod -R 777 /swe-agent-workspace /tmp/swe-agent-cache /github/workspace /var/log/swe-agent && \
    chown -R vscode:vscode /action /swe-agent-workspace /tmp/swe-agent-cache /var/log/swe-agent /github/workspace

# Set environment variables for conda/miniconda environment
ENV PYTHONPATH="/opt/miniconda/lib/python3.11/site-packages:/action/src"
ENV PATH="/opt/miniconda/bin:/opt/miniconda/condabin:$PATH"
ENV NODE_PATH="/action/node_modules"
ENV LOG_DIR="/var/log/swe-agent"

# GitHub Actions environment
ENV GITHUB_ACTIONS=true
ENV CI=true

# SWE-Agent specific environment
ENV SWE_AGENT_WORKSPACE=/swe-agent-workspace
ENV SWE_AGENT_CACHE_DIR=/tmp/swe-agent-cache

# Switch to vscode user for verification, then back to root for GitHub Actions
USER vscode

# Verify installations with proper environment
RUN python -c "import litellm; print('✅ LiteLLM installed successfully')"
RUN sweagent --help > /dev/null && echo "✅ SWE-Agent CLI available" || echo "⚠️ SWE-Agent CLI not available"
RUN python -c "import sweagent; print('✅ SWE-Agent Python package available')" || echo "⚠️ SWE-Agent Python package not available"
RUN node --version && npm --version

# Switch back to root for GitHub Actions compatibility (required for file_commands access)
USER root

# Ensure GitHub Actions has proper permissions
RUN mkdir -p /github/file_commands && chmod 777 /github/file_commands

# Entry point for GitHub Action
ENTRYPOINT ["node", "/action/action/entrypoint.js"]