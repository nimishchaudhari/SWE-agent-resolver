# Use Ubuntu 24.04 which has Python 3.12 and complete Git installation
FROM ubuntu:24.04

# Install Git, Python, and other dependencies
RUN apt-get update && apt-get install -y \
    git \
    git-lfs \
    python3 \
    python3-pip \
    python3-venv \
    jq \
    curl \
    build-essential \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create python/python3 symlink for compatibility
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Verify Git installation and configure
RUN git --version && \
    echo "✅ Git installed successfully" && \
    git config --global --add safe.directory '*' && \
    git config --global init.defaultBranch main

# Set working directory
WORKDIR /app

# Clone and install SWE-agent (latest version)
# Use shallow clone for faster builds
RUN git clone --depth 1 --single-branch https://github.com/SWE-agent/SWE-agent.git ./swe-agent

# Install SWE-agent and dependencies
# Separate pip upgrade and install for better caching
RUN python -m pip install --upgrade pip
RUN cd /app/swe-agent && \
    pip install --no-cache-dir --editable .

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
COPY src/ /src/
RUN chmod +x /entrypoint.sh
RUN chmod +x /src/*.sh

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]