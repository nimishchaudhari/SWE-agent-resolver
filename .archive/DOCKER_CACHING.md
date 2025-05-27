# Docker Image Caching for Faster Builds

This repository uses GitHub Actions to build and cache Docker images for faster retrieval and execution.

## How It Works

1. **Automated Builds**: The `.github/workflows/build-docker-image.yml` workflow automatically builds and pushes Docker images to GitHub Container Registry (GHCR) when:
   - Changes are made to `Dockerfile` or `entrypoint.sh`
   - Code is pushed to main/master branch
   - Weekly (for security updates)

2. **Image Storage**: Images are stored in GitHub Container Registry at:
   ```
   ghcr.io/nimishchaudhari/swe-agent-resolver:latest
   ghcr.io/nimishchaudhari/swe-agent-resolver:<branch-name>
   ghcr.io/nimishchaudhari/swe-agent-resolver:<sha>
   ```

3. **Faster Execution**: The action now uses pre-built images instead of building from Dockerfile every time, reducing execution time by 2-5 minutes.

## Configuration Options

### Using Pre-built Image (Recommended)
```yaml
- name: Run SWE-Agent
  uses: nimishchaudhari/SWE-agent-resolver@main
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    llm_api_key: ${{ secrets.OPENAI_API_KEY }}
    # use_prebuilt_image: 'true' # This is the default
```

### Building from Dockerfile (Fallback)
```yaml
- name: Run SWE-Agent
  uses: nimishchaudhari/SWE-agent-resolver@main
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    llm_api_key: ${{ secrets.OPENAI_API_KEY }}
    use_prebuilt_image: 'false'
```

## Benefits

- **Speed**: 2-5 minutes faster execution per run
- **Reliability**: Consistent environment across runs
- **Resource Efficiency**: Less CPU usage during action execution
- **Multi-platform**: Supports both AMD64 and ARM64 architectures

## Image Updates

Images are automatically rebuilt:
- When Dockerfile or entrypoint.sh changes
- Weekly for security updates
- On manual trigger via workflow_dispatch

## Troubleshooting

If the pre-built image fails, the action will automatically fall back to building from Dockerfile. You can also manually disable pre-built images by setting `use_prebuilt_image: 'false'`.
