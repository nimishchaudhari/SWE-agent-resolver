# Migration Guide: Docker Image Caching Setup

## Phase 1: Initial Setup (Current State)
The action currently uses `Dockerfile` for building. This is necessary for the first deployment.

## Phase 2: Enable Docker Image Caching (After First Build)

### Step 1: Wait for First Docker Image Build
After committing the current changes, the GitHub Actions workflow will build and push your first Docker image to GHCR.

### Step 2: Update action.yml to Use Cached Image
Once the image is successfully built and available in GHCR, update `action.yml`:

```yaml
runs:
  using: 'docker'
  image: 'docker://ghcr.io/nimishchaudhari/swe-agent-resolver:latest'
```

### Step 3: Update Workflows (Optional)
For workflows that want to explicitly use the cached image:

```yaml
- name: Run SWE-Agent (Fast with cached image)
  uses: nimishchaudhari/SWE-agent-resolver@main
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    llm_api_key: ${{ secrets.OPENAI_API_KEY }}
    # Other parameters...
```

## Rollback Plan
If there are issues with the cached image, you can always revert to:

```yaml
runs:
  using: 'docker'
  image: 'Dockerfile'
```

## Verification Steps
1. Check that the Docker image exists: https://github.com/nimishchaudhari/SWE-agent-resolver/pkgs/container/swe-agent-resolver
2. Test a workflow run to ensure it uses the cached image
3. Verify execution time is reduced by 2-5 minutes

## Timeline
- **Now**: Commit with Dockerfile-based builds
- **After first successful build**: Switch to cached image
- **Ongoing**: Automatic image updates via GitHub Actions
