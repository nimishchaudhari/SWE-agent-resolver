# Use Ubuntu 24.04 LTS for latest Git version and Python 3.12
FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system packages including Python 3.12 (default in Ubuntu 24.04)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-dev \
    python3-pip \
    python3-venv \
    git \
    jq \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Display versions for verification in build logs
RUN echo "=== System Information ===" \
    && echo "Git version: $(git --version)" \
    && echo "Python version: $(python3 --version)" \
    && echo "Ubuntu version: $(cat /etc/os-release | grep PRETTY_NAME)" \
    && echo "✅ Ubuntu 24.04 setup complete"

# Set working directory
WORKDIR /app

# Clone and install SWE-agent (latest version)
RUN git clone --depth 1 https://github.com/SWE-agent/SWE-agent.git ./swe-agent

# Install SWE-agent and dependencies using virtual environment to avoid PEP 668 issues
RUN cd /app/swe-agent && \
    python3 -m venv /opt/swe-agent-venv && \
    /opt/swe-agent-venv/bin/pip install --upgrade pip && \
    /opt/swe-agent-venv/bin/pip install --editable .

# Add virtual environment to PATH
ENV PATH="/opt/swe-agent-venv/bin:$PATH"

# Copy entrypoint script and source files
COPY entrypoint.sh /entrypoint.sh
COPY src/ /src/
RUN chmod +x /entrypoint.sh
RUN chmod +x /src/*.sh

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]