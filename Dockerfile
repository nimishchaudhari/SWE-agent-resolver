# Use Ubuntu 24.04 LTS for latest Git version and better Python 3.12 support
FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Python 3.12 and modern Git (Ubuntu 24.04 has Python 3.12 by default)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-dev \
    python3.12-venv \
    python3-pip \
    git \
    jq \
    curl \
    build-essential \
    && ln -sf /usr/bin/python3.12 /usr/bin/python3 \
    && ln -sf /usr/bin/python3.12 /usr/bin/python \
    && git --version \
    && rm -rf /var/lib/apt/lists/*

# Verify Git supports --cached option
RUN git diff --help | grep -q "cached" && echo "Git version compatible: $(git --version)"

# Set working directory
WORKDIR /app

# Install pip for Python 3.12
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.12

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