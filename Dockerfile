# /workspaces/swe-agent-resolver/Dockerfile
# Dockerfile for TypeScript GitHub Action

# Use an official Node.js runtime as a parent image
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

# Final stage
FROM node:20-slim

WORKDIR /app

# Copy built application and node_modules from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Optional: If you have other assets or files needed at runtime, copy them here
# For example, if swe-agent is still needed and invoked as a separate process:
# COPY --from=swe-agent-builder /opt/swe-agent-venv /opt/swe-agent-venv
# COPY --from=swe-agent-builder /tmp/swe-agent /app/swe-agent
# ENV PATH="/opt/swe-agent-venv/bin:$PATH"

# Define the entrypoint for the action
# This will typically be node dist/index.js or similar
# ENTRYPOINT ["node", "dist/index.js"] 
# CMD is overridden by the action.yml, but good to have for local testing
CMD ["node", "dist/index.js"]

# Healthcheck (optional, but good practice)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('fs').existsSync('./dist/index.js') || process.exit(1)"

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Ensure scripts are executable if any are directly run by the container
# RUN chmod +x /app/entrypoint.sh # Example if you had a shell entrypoint

# Metadata
LABEL name="swe-agent-resolver"
LABEL description="GitHub Action to run SWE-agent and resolve issues."
LABEL version="1.0.0"
LABEL maintainer="[Your Name/Org]"

# Display Node.js version
RUN node --version
RUN npm --version
