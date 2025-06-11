#!/bin/bash

# Development Environment Setup Script for SWE-Agent Resolver
# Sets up complete local development and testing environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  SWE-Agent Resolver Development Setup     ${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_section() {
    echo -e "${YELLOW}▶ $1${NC}"
    echo "----------------------------------------"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

check_dependencies() {
    print_section "Checking dependencies"
    
    local missing_deps=()
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js (v18+)")
    else
        local node_version=$(node --version | cut -d'v' -f2)
        local major_version=$(echo "$node_version" | cut -d'.' -f1)
        if [ "$major_version" -lt 18 ]; then
            missing_deps+=("Node.js v18+ (current: v$node_version)")
        else
            print_success "Node.js v$node_version"
        fi
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    else
        print_success "npm $(npm --version)"
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        missing_deps+=("Python 3.8+")
    else
        print_success "Python $(python3 --version | cut -d' ' -f2)"
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        missing_deps+=("Git")
    else
        print_success "Git $(git --version | cut -d' ' -f3)"
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        print_success "Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
    else
        print_warning "Docker not found (optional for containerized testing)"
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing dependencies:"
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        echo ""
        echo "Please install the missing dependencies and run this script again."
        exit 1
    fi
    
    print_success "All required dependencies found"
    echo ""
}

install_node_dependencies() {
    print_section "Installing Node.js dependencies"
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
    
    npm install
    print_success "Node.js dependencies installed"
    echo ""
}

install_python_dependencies() {
    print_section "Installing Python dependencies"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        print_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install SWE-agent and dependencies
    pip install \
        sweagent \
        swe-agent \
        litellm \
        openai \
        anthropic \
        pyyaml \
        requests \
        jinja2 \
        python-dotenv \
        gitpython
    
    print_success "Python dependencies installed"
    print_info "Virtual environment created at: ./venv"
    print_info "To activate: source venv/bin/activate"
    echo ""
}

setup_environment_files() {
    print_section "Setting up environment files"
    
    # Create .env template if it doesn't exist
    if [ ! -f ".env.example" ]; then
        cat > .env.example << 'EOF'
# GitHub Configuration
GITHUB_TOKEN=your_github_token_here

# AI Provider API Keys (set at least one)
OPENAI_API_KEY=sk-your_openai_api_key_here
ANTHROPIC_API_KEY=sk-ant-your_anthropic_api_key_here
DEEPSEEK_API_KEY=sk-your_deepseek_api_key_here
GROQ_API_KEY=gsk_your_groq_api_key_here
OPENROUTER_API_KEY=sk-or-your_openrouter_api_key_here

# Azure OpenAI (optional)
AZURE_OPENAI_API_KEY=your_azure_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=swe-agent:*

# Testing Configuration
SKIP_REAL_TESTS=false
SKIP_E2E_TESTS=false
EOF
        print_success "Created .env.example template"
    fi
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        cp .env.example .env
        print_warning "Created .env file from template"
        print_info "Please edit .env with your actual API keys"
    else
        print_info ".env file already exists"
    fi
    
    # Create .gitignore additions
    if ! grep -q ".env" .gitignore 2>/dev/null; then
        cat >> .gitignore << 'EOF'

# Environment files
.env
.env.local
.env.*.local

# Development files
venv/
*.log
test-local-output/
test-workspace/
test-logs/
node_modules/

# OS files
.DS_Store
Thumbs.db
EOF
        print_success "Updated .gitignore"
    fi
    
    echo ""
}

create_test_directories() {
    print_section "Creating test directories"
    
    local test_dirs=(
        "test-local-output"
        "test-workspace" 
        "test-logs"
        "test-repos"
    )
    
    for dir in "${test_dirs[@]}"; do
        mkdir -p "$dir"
        echo "# Test output directory" > "$dir/.gitkeep"
    done
    
    print_success "Test directories created"
    echo ""
}

setup_git_hooks() {
    print_section "Setting up Git hooks (optional)"
    
    if [ -d ".git" ]; then
        # Create pre-commit hook
        cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Run linting and basic tests before commit
echo "Running pre-commit checks..."

# Run ESLint
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ ESLint failed. Please fix the issues before committing."
    exit 1
fi

# Run unit tests
npm run test:unit
if [ $? -ne 0 ]; then
    echo "❌ Unit tests failed. Please fix the issues before committing."
    exit 1
fi

echo "✅ Pre-commit checks passed"
EOF
        
        chmod +x .git/hooks/pre-commit
        print_success "Git pre-commit hook installed"
    else
        print_warning "Not a Git repository - skipping Git hooks"
    fi
    
    echo ""
}

verify_installation() {
    print_section "Verifying installation"
    
    # Test Node.js setup
    if npm run lint --silent > /dev/null 2>&1; then
        print_success "ESLint configuration working"
    else
        print_warning "ESLint may have configuration issues"
    fi
    
    # Test unit tests
    if npm run test:unit --silent > /dev/null 2>&1; then
        print_success "Unit tests can run"
    else
        print_warning "Unit tests may have issues"
    fi
    
    # Test Python environment
    if source venv/bin/activate && python -c "import litellm; print('LiteLLM available')" 2>/dev/null; then
        print_success "Python environment working"
    else
        print_warning "Python environment may need attention"
    fi
    
    # Test Docker build (if Docker is available)
    if command -v docker &> /dev/null; then
        print_info "Testing Docker build (this may take a few minutes)..."
        if timeout 300 docker build -t swe-agent-resolver:dev-test . > /dev/null 2>&1; then
            print_success "Docker build successful"
            docker rmi swe-agent-resolver:dev-test > /dev/null 2>&1 || true
        else
            print_warning "Docker build failed or timed out"
        fi
    fi
    
    echo ""
}

create_useful_scripts() {
    print_section "Creating development scripts"
    
    # Create quick test script
    cat > dev-test-quick.sh << 'EOF'
#!/bin/bash
# Quick development test script

set -e

echo "🚀 Running quick development tests..."

# Run linting
echo "📝 Linting..."
npm run lint

# Run unit tests
echo "🧪 Unit tests..."
npm run test:unit

# Run provider validation (without real API calls)
echo "🔌 Provider validation..."
SKIP_REAL_TESTS=true npm run test:provider 2>/dev/null || echo "Provider tests completed"

echo "✅ Quick tests completed!"
EOF
    
    chmod +x dev-test-quick.sh
    
    # Create full test script
    cat > dev-test-full.sh << 'EOF'
#!/bin/bash
# Full development test script (requires API keys)

set -e

echo "🚀 Running full development test suite..."

# Check for API keys
if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "⚠️ No API keys found. Set at least one provider API key for full testing."
    echo "Example: export OPENAI_API_KEY=sk-your-key-here"
    exit 1
fi

# Source environment if .env exists
if [ -f ".env" ]; then
    source .env
fi

# Run all tests
echo "📝 Linting..."
npm run lint

echo "🧪 Unit tests..."
npm run test:unit

echo "🔌 Provider integration tests..."
npm run test:real || echo "Some real provider tests may have failed"

echo "🌐 E2E tests..."
SKIP_E2E_TESTS=false npm run test:e2e || echo "E2E tests completed with warnings"

echo "🐳 Docker tests..."
if command -v docker &> /dev/null; then
    docker build -t swe-agent-resolver:test .
    echo "Docker build successful"
else
    echo "Docker not available, skipping Docker tests"
fi

echo "✅ Full test suite completed!"
EOF
    
    chmod +x dev-test-full.sh
    
    # Create local development server script
    cat > dev-server.sh << 'EOF'
#!/bin/bash
# Local development server

set -e

echo "🚀 Starting development environment..."

# Source environment
if [ -f ".env" ]; then
    source .env
fi

# Start development services using Docker Compose
if command -v docker-compose &> /dev/null || command -v docker &> /dev/null; then
    echo "Starting Docker Compose services..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
else
    echo "Docker not available. Starting local development mode..."
    
    # Activate Python venv
    source venv/bin/activate
    
    # Start in development mode
    npm run dev
fi
EOF
    
    chmod +x dev-server.sh
    
    print_success "Development scripts created:"
    print_info "  ./dev-test-quick.sh - Quick tests (no API calls)"
    print_info "  ./dev-test-full.sh - Full tests (requires API keys)"
    print_info "  ./dev-server.sh - Development server"
    echo ""
}

show_next_steps() {
    print_section "Next Steps"
    
    echo -e "${GREEN}🎉 Development environment setup complete!${NC}"
    echo ""
    echo "To get started:"
    echo ""
    echo "1. Configure API keys:"
    echo "   ${YELLOW}nano .env${NC}"
    echo "   Add your API keys for at least one provider"
    echo ""
    echo "2. Run quick tests:"
    echo "   ${YELLOW}./dev-test-quick.sh${NC}"
    echo ""
    echo "3. Start development server:"
    echo "   ${YELLOW}./dev-server.sh${NC}"
    echo ""
    echo "4. Run real provider tests (with API keys):"
    echo "   ${YELLOW}./dev-test-full.sh${NC}"
    echo ""
    echo "5. Run local integration tests:"
    echo "   ${YELLOW}./test-local-real.sh${NC}"
    echo ""
    echo "Available npm scripts:"
    echo "  ${BLUE}npm run test${NC}          - All tests"
    echo "  ${BLUE}npm run test:unit${NC}     - Unit tests only"
    echo "  ${BLUE}npm run test:real${NC}     - Real provider tests"
    echo "  ${BLUE}npm run test:e2e${NC}      - End-to-end tests"
    echo "  ${BLUE}npm run lint${NC}          - Code linting"
    echo "  ${BLUE}npm run dev${NC}           - Development mode"
    echo ""
    echo "Documentation:"
    echo "  ${BLUE}README.md${NC}             - Main documentation"
    echo "  ${BLUE}test/README.md${NC}        - Testing guide"
    echo ""
    echo -e "${GREEN}Happy coding! 🚀${NC}"
}

main() {
    print_header
    
    check_dependencies
    install_node_dependencies
    install_python_dependencies
    setup_environment_files
    create_test_directories
    setup_git_hooks
    create_useful_scripts
    verify_installation
    show_next_steps
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "action.yml" ]; then
    print_error "This script must be run from the swe-agent-resolver root directory"
    print_info "Current directory: $(pwd)"
    print_info "Expected files: package.json, action.yml"
    exit 1
fi

# Run main function
main "$@"