# Start from a Python base image (e.g., Python 3.10 or 3.11, check SWE-agent compatibility)
FROM python:3.12-slim

# Install git, jq (for parsing GitHub event JSON), curl (for GitHub API calls if needed directly)
# and other common utilities that might be useful.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    jq \
    curl \
    patch \
    docker.io \
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

# Install SWE-agent from the cloned source
# RUN cd /app/swe-agent && pip install . && cd /app
RUN cd /app/swe-agent && python -m pip install --upgrade pip && pip install --editable . && cd /app

# Workaround for swe-agent apparently looking for config in <site-packages>/config
# This will try to symlink the installed package's config directory.
# If that doesn't exist, it copies from the original source code.
# RUN sh -c ' \\
#     SITE_PACKAGES_DIR=$(python -c "from sysconfig import get_paths; print(get_paths()[\\\\"purelib\\\\\"])"); \\
#     echo "Detected site-packages directory: $SITE_PACKAGES_DIR"; \\
#     PKG_CONFIG_DIR="$SITE_PACKAGES_DIR/sweagent/config"; \\
#     TARGET_CONFIG_DIR="$SITE_PACKAGES_DIR/config"; \\
#     SRC_CONFIG_DIR="/app/swe-agent/sweagent/config"; \\
#     echo "Applying swe-agent config path workaround."; \\
#     echo "PKG_CONFIG_DIR: $PKG_CONFIG_DIR"; \\
#     echo "TARGET_CONFIG_DIR: $TARGET_CONFIG_DIR"; \\
#     echo "SRC_CONFIG_DIR: $SRC_CONFIG_DIR"; \\
#     if [ -d "$PKG_CONFIG_DIR" ]; then \\
#       echo "Found $PKG_CONFIG_DIR, creating symlink: $TARGET_CONFIG_DIR -> $PKG_CONFIG_DIR"; \\
#       ln -sfn "$PKG_CONFIG_DIR" "$TARGET_CONFIG_DIR"; \\
#     elif [ -d "$SRC_CONFIG_DIR" ]; then \\
#       echo "Package config dir $PKG_CONFIG_DIR not found. Copying from $SRC_CONFIG_DIR to $TARGET_CONFIG_DIR"; \\
#       mkdir -p "$TARGET_CONFIG_DIR" && cp -r "$SRC_CONFIG_DIR"/* "$TARGET_CONFIG_DIR/"; \\
#     else \\
#       echo "Warning: Config source directory not found for workaround ($PKG_CONFIG_DIR or $SRC_CONFIG_DIR). Creating empty $TARGET_CONFIG_DIR."; \\
#       mkdir -p "$TARGET_CONFIG_DIR"; \\
#     fi \\
# '

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