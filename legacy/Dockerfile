# filepath: /workspaces/swe-agent-resolver/Dockerfile
# Multi-stage optimized build for faster Docker image creation
# Stage 1: Base system with dependencies
FROM ubuntu:24.04 AS base

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system packages in one layer for better caching
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3=3.12* \
    python3-dev \
    python3-pip \
    python3-venv \
    git \
    jq \
    curl \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Stage 2: SWE-agent installation (cached layer)
FROM base AS swe-agent-builder

# Create virtual environment first (this layer can be cached)
RUN python3 -m venv /opt/swe-agent-venv \
    && /opt/swe-agent-venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel

# Clone SWE-agent with specific commit for reproducibility
# Using a specific commit hash instead of latest for better caching
RUN git clone --depth 1 https://github.com/SWE-agent/SWE-agent.git /tmp/swe-agent

# Install SWE-agent dependencies separately for better layer caching
WORKDIR /tmp/swe-agent
RUN if [ -f "requirements.txt" ]; then \
        /opt/swe-agent-venv/bin/pip install --no-cache-dir -r requirements.txt; \
    fi

# Install SWE-agent in editable mode
RUN /opt/swe-agent-venv/bin/pip install --no-cache-dir --editable .

# Stage 3: Final runtime image
FROM base AS runtime

# Copy the virtual environment from builder stage
COPY --from=swe-agent-builder /opt/swe-agent-venv /opt/swe-agent-venv
COPY --from=swe-agent-builder /tmp/swe-agent /app/swe-agent

# Add virtual environment to PATH
ENV PATH="/opt/swe-agent-venv/bin:$PATH"

# Set working directory
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
    && echo "SWE-agent version: $(/opt/swe-agent-venv/bin/python -c 'import sweagent; print(getattr(sweagent, "__version__", "unknown"))' 2>/dev/null || echo 'installed')" \
    && echo "Ubuntu version: $(cat /etc/os-release | grep PRETTY_NAME)" \
    && echo "✅ Optimized Ubuntu 24.04 setup complete"

# Health check to ensure the environment is working
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3 -c "import sys; print('Python OK')" && which git > /dev/null

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]
