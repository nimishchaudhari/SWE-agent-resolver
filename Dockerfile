# Use Python 3.12 slim image for compatibility and smaller size
FROM python:3.12-slim

# Install required system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    jq \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

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