import { Command } from 'commander';
import { checkGitRepo } from './git.js';
import { createWorktree, listWorktrees, removeWorktree, pruneWorktrees } from './commands.js';
import { error } from './logger.js';
import type { CreateWorktreeOptions } from './commands.js';

const program = new Command();

program
  .name('workspace')
  .description('Easily create isolated workspaces that fit your git workflow — comes with automatic and configurable setup detection. Perfect for AI sandboxed coding and testing.')
  .version('0.0.1');

// Main command: create worktree
program
  .argument('[branch]', 'Branch name to create worktree for')
  .option('-n, --no-setup', 'Skip setup script (fastest, git operations only)')
  .option('-s, --setup <path>', 'Use custom setup script')
  .option('-b, --base <branch>', 'Create new branch from custom base (default: main)')
  .action((branch: string | undefined, options: any) => {
    try {
      checkGitRepo();

      if (!branch) {
        program.help();
        return;
      }

      // Convert Commander's option naming (--no-setup becomes setup: false)
      const createOptions: CreateWorktreeOptions = {
        skipSetup: options.setup === false,
        setupScript: typeof options.setup === 'string' ? options.setup : undefined,
        baseBranch: options.base,
      };

      createWorktree(branch, createOptions);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      }
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .alias('ls')
  .description('List all worktrees')
  .action(() => {
    try {
      checkGitRepo();
      listWorktrees();
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      }
      process.exit(1);
    }
  });

// Remove command
program
  .command('remove <name>')
  .alias('rm')
  .alias('delete')
  .description('Remove a worktree')
  .action((name: string) => {
    try {
      checkGitRepo();
      removeWorktree(name);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      }
      process.exit(1);
    }
  });

// Prune command
program
  .command('prune')
  .alias('clean')
  .description('Clean up stale worktrees')
  .action(() => {
    try {
      checkGitRepo();
      pruneWorktrees();
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      }
      process.exit(1);
    }
  });

program.parse();
