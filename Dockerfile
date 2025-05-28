# Use Python 3.12 slim image for compatibility and smaller size
FROM python:3.12-slim

# Install required system packages with updated Git
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common \
    curl \
    && curl -fsSL https://packages.github.com/server/keys/github-serverless.asc | apt-key add - \
    && echo "deb https://packagecloud.io/github/git-lfs/debian/ bullseye main" > /etc/apt/sources.list.d/github_git-lfs.list \
    && apt-get update && apt-get install -y --no-install-recommends \
    git \
    jq \
    build-essential \
    && git --version \
    && rm -rf /var/lib/apt/lists/*

# Verify Git version (should be 2.30+)
RUN git --version && git diff --help | grep -q "cached" || (echo "Git version too old" && exit 1)

# Set working directory
WORKDIR /app

# Clone and install SWE-agent (latest version)
RUN git clone --depth 1 https://github.com/SWE-agent/SWE-agent.git ./swe-agent

# Install SWE-agent and dependencies
RUN cd /app/swe-agent && \
    python -m pip install --upgrade pip && \
    pip install --no-cache-dir --editable .

# Copy entrypoint script and source files
COPY entrypoint.sh /entrypoint.sh
COPY src/ /src/
RUN chmod +x /entrypoint.sh
RUN chmod +x /src/*.sh

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]