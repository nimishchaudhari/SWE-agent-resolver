FROM python:3.12-slim

# Install required packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    jq \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone and install SWE-agent
RUN git clone https://github.com/SWE-agent/SWE-agent.git ./swe-agent
RUN cd /app/swe-agent && \
    python -m pip install --upgrade pip && \
    pip install --editable .

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]