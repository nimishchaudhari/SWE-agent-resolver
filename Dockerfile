# /workspaces/swe-agent-resolver/Dockerfile
# Multi-stage optimized build for TypeScript GitHub Action with SWE-Agent

# Stage 1: Node.js TypeScript Builder
FROM node:20-slim AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Transpile TypeScript to JavaScript
RUN npm run build --if-present

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Python base with system dependencies
FROM node:20-slim AS python-base

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system packages in one layer for better caching
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3=3.11* \
    python3-dev \
    python3-pip \
    python3-venv \
    git \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Stage 3: SWE-agent installation (cached layer)
FROM python-base AS swe-agent-builder

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

# Stage 4: Final runtime image
FROM python-base AS runtime

# Copy the virtual environment from builder stage
COPY --from=swe-agent-builder /opt/swe-agent-venv /opt/swe-agent-venv
COPY --from=swe-agent-builder /tmp/swe-agent /app/swe-agent

# Copy built application and node_modules from TypeScript builder stage
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package*.json /app/

# Add virtual environment to PATH
ENV PATH="/opt/swe-agent-venv/bin:$PATH"

# Set working directory
WORKDIR /app

# Define the entrypoint for the action
# This will typically be node dist/index.js or similar
# ENTRYPOINT ["node", "dist/index.js"] 
# CMD is overridden by the action.yml, but good to have for local testing
CMD ["node", "/app/dist/index.js"]

# Health check to ensure both Node.js and Python environments are working
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('fs').existsSync('./dist/index.js') || process.exit(1)" && \
        python3 -c "import sys; print('Python OK')" && \
        which sweagent > /dev/null

# Display versions for verification (moved to end to avoid rebuilding)
RUN echo "=== System Information ===" \
    && echo "Node.js version: $(node --version)" \
    && echo "npm version: $(npm --version)" \
    && echo "Git version: $(git --version)" \
    && echo "Python version: $(python3 --version)" \
    && echo "SWE-agent version: $(/opt/swe-agent-venv/bin/python -c 'import sweagent; print(getattr(sweagent, "__version__", "unknown"))' 2>/dev/null || echo 'installed')" \
    && echo "✅ TypeScript + SWE-Agent setup complete"

# Metadata
LABEL name="swe-agent-resolver"
LABEL description="GitHub Action to run SWE-agent and resolve issues."
LABEL version="1.0.0"
LABEL maintainer="[Your Name/Org]"
