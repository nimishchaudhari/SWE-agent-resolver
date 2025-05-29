FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Install SWE-Agent (placeholder - adjust based on actual installation method)
RUN pip3 install swe-agent || echo "SWE-Agent installation placeholder"

# Create non-root user
RUN useradd -m -u 1001 sweagent
RUN chown -R sweagent:sweagent /app

# Copy application code
COPY --chown=sweagent:sweagent src/ ./src/

# Create tmp directory for job execution
RUN mkdir -p /tmp/swe-agent-jobs && chown sweagent:sweagent /tmp/swe-agent-jobs

# Switch to non-root user
USER sweagent

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]