# Optimized single-stage build for container environment
FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install only the packages not included in Ubuntu 24.04 base image
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3=3.12* \
    python3-dev \
    python3-pip \
    git \
    jq \
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Use system-managed packages when possible, only upgrade if needed
RUN python3 -c "import pip; print('System pip OK')" || \
    python3 -m pip install --no-cache-dir --user pip setuptools wheel

# Clone SWE-agent repository
RUN git clone --depth 1 https://github.com/SWE-agent/SWE-agent.git /app/swe-agent

# Set working directory for SWE-agent installation
WORKDIR /app/swe-agent

# Install SWE-agent dependencies using system environment
RUN if [ -f "requirements.txt" ]; then \
        python3 -m pip install --no-cache-dir -r requirements.txt --user || \
        python3 -m pip install --no-cache-dir -r requirements.txt --break-system-packages; \
    fi

# Install SWE-agent in editable mode using compatible approach
RUN python3 -m pip install --no-cache-dir --editable . --user || \
    python3 -m pip install --no-cache-dir --editable . --break-system-packages

# Set main working directory
WORKDIR /app

# Copy application files (these change frequently, so put them last)
COPY entrypoint.sh /entrypoint.sh
COPY src/ /src/

# Set permissions in a single layer
RUN chmod +x /entrypoint.sh /src/*.sh

# Display versions for verification (moved to end to avoid rebuilding)
RUN echo "=== System Information ===" \
    && echo "Git version: $(git --version)" \
    && echo "Python version: $(python3 --version)" \
    && echo "SWE-agent version: $(python3 -c 'import sweagent; print(getattr(sweagent, "__version__", "unknown"))' 2>/dev/null || echo 'installed')" \
    && echo "Ubuntu version: $(cat /etc/os-release | grep PRETTY_NAME)" \
    && echo "✅ Container environment setup complete"

# Health check to ensure the environment is working
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3 -c "import sys; print('Python OK')" && which git > /dev/null

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]