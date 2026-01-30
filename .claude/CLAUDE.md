# @jubalm/workspace - Project Configuration

This file documents project-specific setup, preferences, and conventions.

## Project Overview

**Status: MVP (v0.3.0 - TypeScript)**
Lightweight CLI for Git worktree management with auto-detecting setup scripts.

## Stack & Technology

**Runtime**
- Node.js 18+ (ESM modules)
- TypeScript 5.9+ (strict mode)
- Git 2.7+ (worktree operations)

**Package Manager**
- npm 6+ (CLI distribution)

**Build Tools**
- esbuild (production bundler)
- tsx (development runtime)

**Dependencies**
- commander 12+ (CLI argument parsing)
- chalk 5+ (terminal colors)

**Tooling**
- GitHub (code hosting)
- TypeScript (type safety)

## Project Structure

```
@jubalm/workspace/
├── .claude/                 # Project configuration
├── src/                     # TypeScript source files (flat structure)
│   ├── commands.ts         # CLI command implementations
│   ├── git.ts              # Git & worktree primitives
│   ├── autorun.ts          # Setup script detection & execution
│   ├── exec.ts             # Command execution (exec, execQuiet, execInteractive)
│   ├── logger.ts           # Terminal output (info, success, warning, error)
│   └── index.ts            # CLI entry point with Commander
├── dist/                    # Built output (esbuild bundle)
│   └── index.js            # Executable bundle with shebang
├── build.mjs               # esbuild build script
├── tsconfig.json           # TypeScript configuration (strict mode)
├── package.json            # npm package config
├── README.md               # User-facing documentation
├── LICENSE                 # MIT License
└── .gitignore             # Git ignore rules
```

## Key Commands

### Local Development
```bash
# Development mode (tsx - no build needed)
npm run dev -- help                # Show help
npm run dev -- list                # List worktrees
npm run dev -- feature/test -n     # Test create command

# Build and test
npm run build                      # Build with esbuild
node dist/index.js help            # Test built binary
```

### Distribution
```bash
npm run build                      # Build before publishing
npm link                           # Install locally for testing
npm publish                        # Publish to npm registry (auto-builds)
```

## Code Style & Conventions

### TypeScript
- **Mode:** Strict mode enabled in tsconfig.json
- **Modules:** ES Modules (import/export)
- **Types:** Explicit type annotations for function parameters and return values
- **Imports:** Always use `.js` extension in imports (for ESM compatibility)
- **Error handling:** Try/catch with proper error typing
- **Naming:** camelCase for functions/variables, PascalCase for types/interfaces
- **Comments:** Why, not what (code explains what)

### File Organization
- **Flat structure:** All source files in `src/` root (6 files total)
- **Semantic names:** Files named by domain concept, not technical layer
  - `commands.ts` - What the CLI does (create, list, remove, prune)
  - `git.ts` - Git & worktree primitives (operations, validation, paths)
  - `autorun.ts` - Setup script detection & execution
  - `exec.ts` - Command execution utilities
  - `logger.ts` - Terminal output formatting
- **Co-located types:** Interfaces defined with their implementations (not separate `types/` directory)

### Output & Logging
- **Colors:** Use chalk for colored output
- **Logging:** Use helper functions from `logger.ts` (`info()`, `success()`, `warning()`, `error()`)
- **Execution:** Use helpers from `exec.ts` (`exec()`, `execQuiet()`, `execInteractive()`)

## Configuration

### package.json
- **name:** `@jubalm/workspace` (scoped package)
- **version:** Semantic versioning (currently 0.3.0)
- **bin:** Maps `workspace` command to `./dist/index.js`
- **type:** `"module"` (ES Modules)
- **files:** `["dist"]` (published files)
- **Node requirement:** 18.0.0+
- **scripts:**
  - `dev`: Run with tsx (no build needed)
  - `build`: Bundle with esbuild
  - `prepublishOnly`: Auto-build before publishing

### tsconfig.json
- **target:** ES2022
- **module:** ES2022
- **moduleResolution:** bundler
- **strict:** true (all strict checks enabled)
- **outDir:** ./dist
- **rootDir:** ./src

## API Contract

The CLI follows standard Unix conventions:

**Commands:**
- `workspace <branch>` - Create worktree
- `workspace list|ls` - List worktrees
- `workspace remove|rm|delete <name>` - Remove worktree
- `workspace prune|clean` - Prune stale worktrees
- `workspace help|-h|--help` - Show help

**Flags:**
- `-n, --no-setup` - Skip setup script
- `-s, --setup <path>` - Custom setup script
- `-b, --base <branch>` - Base branch for new branches
- `-h, --help` - Show help

**Exit Codes:**
- `0` - Success
- `1` - Failure (error message printed to stderr)

## Environment & Dependencies

**Required:**
- Git 2.7+ (for worktree support)
- Node.js 18+ (for ESM and CLI)

**Runtime Dependencies:**
- chalk 5.x (terminal colors)
- commander 12.x (CLI framework)

**Dev Dependencies:**
- TypeScript 5.9+ (type checking)
- tsx 4.x (dev runtime)
- esbuild 0.27+ (bundler)
- @types/node (Node.js types)

**Optional:**
- Bash 3.2+ (for custom setup scripts)
- npm/yarn (for dependency installation in setup scripts)
- Any tools needed by custom setup scripts

## Setup Script Auto-Detection

The CLI automatically detects setup scripts using industry-standard patterns:

**Detection order:**
1. `script/setup` - GitHub Scripts to Rule Them All
2. `script/bootstrap` - GitHub STRTA for dependencies
3. `bin/setup` - Ruby/Rails convention
4. `setup.sh` - Generic Unix (project root)
5. `bootstrap.sh` - Bootstrap (project root)
6. `scripts/setup.sh` - Alternative location
7. `Makefile` - With `setup` or `bootstrap` target

**Key features:**
- Auto-runs first executable script found (unless `-n` flag)
- Custom script via `-s` flag bypasses detection
- Helpful messages if no script found
- Works with any script language (Bash, Python, Ruby, etc.)

## Common Gotchas

- ❌ Don't hardcode paths - use `git rev-parse --show-toplevel`
- ❌ Don't assume `.worktrees` exists - create it with `mkdir -p`
- ⚠️ Setup scripts must be executable (`chmod +x`)
- ⚠️ Setup script path can be relative or absolute
- ⚠️ Always fetch latest remote branches before branch resolution
- ⚠️ Git prevents checking out the same branch in multiple worktrees

## Testing & Manual Testing

**No automated test suite yet.** Manual testing:

```bash
# Development testing (no build needed)
npm run dev -- feature/test -n
npm run dev -- list
npm run dev -- remove feature-test

# Production build testing
npm run build
node dist/index.js feature/test -n
node dist/index.js list
node dist/index.js remove feature-test

# In any git repo
workspace feature/test -n              # If installed globally
npx @jubalm/workspace feature/test -n  # If not installed
```

## Git Workflow

- **Default branch:** `main` (when initialized on GitHub)
- **Branching:** Use meaningful names (feature/, fix/, docs/)
- **Commits:** Clear messages describing changes

## Documentation

- `README.md` - User guide with examples and troubleshooting
- `package.json` - Project metadata and scripts
- Inline comments in shell scripts for non-obvious logic

## Distribution

**Current:** GitHub-hosted, installable via:
```bash
npm install -g @jubalm/workspace
npx @jubalm/workspace --help
```

**To publish to npm:**
1. Update version in `package.json`
2. Run `npm publish`
3. Verify on [npmjs.com](https://www.npmjs.com/package/@jubalm/workspace)

## Debugging Tips

**CLI not working:**
- Check Node.js version: `node --version` (need 18+)
- Rebuild: `npm run build`
- Test source directly: `npm run dev -- help`
- Check TypeScript errors: `npx tsc --noEmit`

**Build issues:**
- Clear dist: `rm -rf dist && npm run build`
- Check esbuild version: `npm ls esbuild`
- Verify package.json bin points to `./dist/index.js`

**Worktree issues:**
- Verify git repo: `git status`
- Check available branches: `git branch -a`
- Try manual fetch: `git fetch origin`
- Enable verbose: Add console.log in src/core/git.ts

**Setup script not running:**
- Check if it exists: `ls -l lib/setup.sh`
- Check permissions: `chmod +x lib/setup.sh`
- Test directly: `WORKSPACE_DIR=/path/to/worktree lib/setup.sh`

**Type errors:**
- Check imports have `.js` extension (required for ESM)
- Verify all types are properly defined in src/types/
- Run `npx tsc --noEmit` to see all type errors

## Resources

- [Git Worktree Docs](https://git-scm.com/docs/git-worktree)
- [npm CLI Guide](https://docs.npmjs.com/cli/latest/)
- [Bash Manual](https://www.gnu.org/software/bash/manual/)
