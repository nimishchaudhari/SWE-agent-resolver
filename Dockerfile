FROM python:3.12-slim

# Install required system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    jq \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

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