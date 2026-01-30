# workspace

Easily create isolated workspaces that fit your git workflow — comes with automatic and configurable setup detection. Perfect for AI sandboxed coding and testing.

Create, manage, and clean up Git worktrees with optional automatic environment setup.

## What are Git Worktrees?

Git worktrees let you have multiple working directories for the same repository, each on a different branch. Work on multiple features in isolation without switching branches.

## Installation

Run directly from GitHub:

```bash
npx jubalm/workspace --help
```

## Quick Start

```bash
# Create a worktree with auto-setup
npx jubalm/workspace feature/new-ui

# Create without setup (git only, fastest)
npx jubalm/workspace feature/new-ui -n

# List all worktrees
npx jubalm/workspace list

# Remove a worktree
npx jubalm/workspace remove feature-new-ui

# Get help
npx jubalm/workspace help
```

**Shorthand**: Use `ws` instead of `workspace` for faster typing:
```bash
npx jubalm/ws feature/new-ui
```

## Usage

### Create a Worktree

```bash
# Default: Create with auto-setup (runs ./lib/setup.sh if exists)
npx jubalm/workspace <branch-name>

# Fast: Git operations only (no setup)
npx jubalm/workspace <branch-name> -n

# Custom base: Create from different base branch
npx jubalm/workspace <branch-name> -b develop

# Custom setup: Use different setup script
npx jubalm/workspace <branch-name> -s ./scripts/my-setup.sh
```

### Manage Worktrees

```bash
# List all worktrees
npx jubalm/workspace list
npx jubalm/workspace ls

# Remove a worktree and its local branch
npx jubalm/workspace remove <name>
npx jubalm/workspace rm <name>

# Clean up stale worktrees
npx jubalm/workspace prune
npx jubalm/workspace clean
```

### Get Help

```bash
npx jubalm/workspace help
npx jubalm/workspace -h
npx jubalm/workspace --help
```

## Branch Resolution

The CLI intelligently resolves branches:

1. **Remote first** - Checks `origin/<branch>`
2. **Local second** - Checks local refs/heads
3. **Create new** - Creates from base branch (default: `main`)

Examples:
```bash
npx jubalm/workspace feature/auth          # Tries origin/feature/auth, then creates from main
npx jubalm/workspace origin/hotfix         # Uses origin/hotfix
npx jubalm/workspace my-local-branch       # Uses existing local branch
npx jubalm/workspace feature/new -b prod   # Creates from prod instead of main
```

## Directory Naming

Branch names are normalized for safe directory names:

```
origin/feature/auth    → .worktreess/feature-auth
claude/quick-fix       → .worktreess/quick-fix
hotfix/bug-123         → .worktreess/bug-123
```

Prefixes stripped: `origin/`, `remotes/origin/`, `claude/`, `remotes/claude/`
Slashes converted to hyphens.

## Setup Scripts

The CLI automatically detects and runs setup scripts using industry-standard patterns. No configuration needed!

### Auto-Detection

When you create a worktree, the CLI checks for these files (in order):

1. `script/setup` - [GitHub Scripts to Rule Them All](https://github.com/github/scripts-to-rule-them-all)
2. `script/bootstrap` - GitHub STRTA for dependencies
3. `bin/setup` - Ruby/Rails convention
4. `setup.sh` - Generic shell script (project root)
5. `bootstrap.sh` - Bootstrap script (project root)
6. `scripts/setup.sh` - Alternative location
7. `Makefile` - With `setup` or `bootstrap` target

The first executable script found will run automatically.

### Example Setup Scripts

#### Node.js Project (script/setup)
```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$WORKSPACE_DIR"
npm ci
cp .env.example .env 2>/dev/null || true
echo "✓ Setup complete"
```

#### Ruby Project (bin/setup)
```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$WORKSPACE_DIR"
bundle install
bin/rails db:setup
echo "✓ Setup complete"
```

#### Python Project (script/setup)
```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$WORKSPACE_DIR"
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
echo "✓ Setup complete"
```

### Skip Setup
```bash
npx jubalm/workspace feature/branch -n
```

### Custom Setup Script
```bash
npx jubalm/workspace feature/branch -s ./custom-init.sh
```

### Setup Script Requirements

Your setup script must:
- Be executable: `chmod +x script/setup`
- Have proper shebang: `#!/usr/bin/env bash` (or python3, ruby, etc.)
- Exit 0 on success, non-zero on failure
- Handle being run multiple times (idempotent)

Access the worktree path via `$WORKSPACE_DIR` environment variable

## Workflows

### Feature Development

```bash
# Create and navigate
npx jubalm/workspace feature/dashboard
cd .worktreess/feature-dashboard

# ... make changes, commit, push ...

# When done
npx jubalm/workspace remove feature-dashboard
```

### Code Review

```bash
# Check out a PR branch
npx jubalm/workspace origin/pull/123/head
cd .worktreess/pull-123-head

# Review the code in isolation
# Cleanup when done
npx jubalm/workspace remove pull-123-head
```

### Parallel Work

```bash
# Work on UI and API simultaneously
npx jubalm/workspace feature/ui
npx jubalm/workspace feature/api
npx jubalm/workspace docs -n  # No setup for quick doc edits

# List all active worktrees
npx jubalm/workspace list
```

### Hotfix from Production

```bash
# Create from production branch
npx jubalm/workspace hotfix/critical-bug -b production
cd .worktreess/critical-bug

# Fix and test
# Then create PR and cleanup
npx jubalm/workspace remove critical-bug
```

## Configuration

- **Worktree directory:** `.worktrees/` (auto-created, must be in `.gitignore`)
- **Default base branch:** `main` (override with `-b`)
- **Default setup script:** `./lib/setup.sh`

### Migration from v0.0.x

If upgrading from v0.0.x, the worktree directory has been renamed from `.worktree/` to `.worktrees/`:

1. Remove old worktrees: `npx jubalm/workspace remove <name>` for each
2. Delete old directory: `rm -rf .worktree`
3. Update `.gitignore` to use `.worktrees/` instead of `.worktree/`
4. Recreate worktrees as needed

Your git configuration is unaffected — this is purely a directory naming change.

## Examples

```bash
# Create with auto-setup
npx jubalm/workspace feature/auth

# Create from remote
npx jubalm/workspace origin/hotfix/security

# Create without setup (fast)
npx jubalm/workspace feature/quick -n

# Create from develop
npx jubalm/workspace feature/new -b develop

# Use custom setup
npx jubalm/workspace feature/test -s ./custom-init.sh

# Combine flags
npx jubalm/workspace hotfix/urgent -b production -s ./minimal-setup.sh

# List all
npx jubalm/workspace list

# Remove specific
npx jubalm/workspace remove feature-auth

# Clean up stale
npx jubalm/workspace prune

# Get help
npx jubalm/workspace help
```

## Troubleshooting

### Git repository not found

Make sure you're in a git repository:
```bash
git status
```

### Setup script not executable

```bash
chmod +x lib/setup.sh
```

### Branch not found

The CLI fetches latest remote branches automatically. If it still fails:
```bash
git fetch origin
npx jubalm/workspace <branch-name>
```

### Worktree already exists

The CLI detects existing worktrees and re-runs setup:
```bash
npx jubalm/workspace feature/branch    # Re-runs setup if worktree exists
```

To prevent re-running:
```bash
npx jubalm/workspace feature/branch -n
```

### Remove worktree manually

If removal fails:
```bash
rm -rf .worktreess/<name>
git worktree prune
```

## FAQ

**Q: Do I need a setup script?**
A: No! Setup scripts are optional. Use `-n` to skip.

**Q: Can I use this with non-Node projects?**
A: Yes! The CLI is project-agnostic. Setup scripts can do anything.

**Q: What if I have existing worktrees from git?**
A: The CLI manages them alongside existing worktrees.

**Q: Can each worktree have different dependencies?**
A: Yes! Each worktree is independent. Setup handles isolation.

**Q: Can I use the same branch in multiple worktrees?**
A: No. Git prevents checking out the same branch twice.

**Q: Can I move the `.worktrees` directory?**
A: Yes, but worktrees might break. Better to remove and recreate.

**Q: Does setup run on existing worktrees?**
A: Yes! Re-running the command re-runs setup automatically.

## License

MIT

## Contributing

Issues and PRs welcome at [github.com/jubalm/workspace](https://github.com/jubalm/workspace)
