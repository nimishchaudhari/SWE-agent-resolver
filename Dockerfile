# Start from a Python base image (e.g., Python 3.10 or 3.11, check SWE-agent compatibility)
FROM python:3.10-slim

# Install git, jq (for parsing GitHub event JSON), curl (for GitHub API calls if needed directly)
# and other common utilities that might be useful.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    jq \
    curl \
    patch \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone the SWE-agent repository. Consider pinning to a specific commit/tag for stability in production.
# For development, cloning main/master is fine.
RUN rm -rf ./swe-agent # Ensure clean state before clone
RUN git clone https://github.com/SWE-agent/SWE-agent.git ./swe-agent
RUN ls -la /app/swe-agent # Debug: List contents of the cloned directory

# If SWE-agent uses submodules:
# RUN cd swe-agent && git submodule update --init --recursive

# Install SWE-agent dependencies.
# Ensure requirements.txt is at the root of SWE-agent or adjust path.
# Some agents require specific versions of torch, etc. This might need adjustment
# if the base python image doesn't play well with specific deep learning library versions.
# RUN pip install --no-cache-dir -r swe-agent/requirements.txt

# Copy the entrypoint script into the container and make it executable
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]