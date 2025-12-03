import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  WORKTREE_DIR,
  getWorktreeName,
  getWorktreePath,
  getProjectRoot,
  ensureGitignore,
  fetchRemote,
  resolveBranch,
  createFromRemoteBranch,
  createFromLocalBranch,
  createNewBranch,
} from './git.js';
import { runSetup, type SetupMode } from './autorun.js';
import { exec, execQuiet, execInteractive } from './exec.js';
import { info, warning, success, error } from './logger.js';

export interface CreateWorktreeOptions {
  skipSetup?: boolean;
  setupScript?: string;
  baseBranch?: string;
}

interface WorktreePaths {
  projectRoot: string;
  dirName: string;
  worktreePath: string;
}

// Path preparation

function prepareWorktreePaths(branch: string): WorktreePaths {
  const projectRoot = getProjectRoot();
  const dirName = getWorktreeName(branch);
  const worktreePath = getWorktreePath(join(projectRoot, WORKTREE_DIR), branch);
  return { projectRoot, dirName, worktreePath };
}

// Prerequisite setup

function ensureWorktreeDir(projectRoot: string): void {
  const worktreePath = join(projectRoot, WORKTREE_DIR);
  if (!existsSync(worktreePath)) {
    info(`Creating ${WORKTREE_DIR}/ directory`);
    mkdirSync(worktreePath, { recursive: true });
    success(`Created ${WORKTREE_DIR}/ directory`);
  }
}

function setupPrerequisites(projectRoot: string): void {
  ensureGitignore(projectRoot, WORKTREE_DIR);
  ensureWorktreeDir(projectRoot);
  fetchRemote();
}

// Existing worktree handler

function handleExistingWorktree(
  worktreePath: string,
  dirName: string,
  options: CreateWorktreeOptions
): void {
  info(`Worktree already exists: ${WORKTREE_DIR}/${dirName}`);
  info('Re-running setup...');

  const setupMode: SetupMode = options.skipSetup
    ? 'none'
    : options.setupScript || 'default';

  if (!runSetup(worktreePath, setupMode)) {
    process.exit(1);
  }

  console.log('');
  info('Next steps:');
  info(`  cd ${WORKTREE_DIR}/${dirName}`);
  console.log('');
}

// Main command: create worktree

export function createWorktree(
  branch: string,
  options: CreateWorktreeOptions
): void {
  const { projectRoot, dirName, worktreePath } = prepareWorktreePaths(branch);

  // Early return for existing worktree
  if (existsSync(worktreePath)) {
    handleExistingWorktree(worktreePath, dirName, options);
    return;
  }

  // Create new worktree
  info(`Creating worktree for branch: ${branch}`);
  setupPrerequisites(projectRoot);

  const resolution = resolveBranch(branch);

  // Dispatch to appropriate handler based on branch type
  switch (resolution.type) {
    case 'remote':
      createFromRemoteBranch(worktreePath, resolution);
      break;
    case 'local':
      createFromLocalBranch(worktreePath, resolution);
      break;
    case 'new':
      createNewBranch(worktreePath, resolution, options.baseBranch);
      break;
  }

  info(`Location: ${worktreePath}`);

  // Run setup (if not skipped)
  const setupMode: SetupMode = options.skipSetup
    ? 'none'
    : options.setupScript || 'default';

  if (!runSetup(worktreePath, setupMode)) {
    process.exit(1);
  }

  // Show next steps
  console.log('');
  info('Next steps:');
  info(`  cd ${WORKTREE_DIR}/${dirName}`);
  console.log('');
}

// Remove worktree

export function removeWorktree(name: string): void {
  const projectRoot = getProjectRoot();
  const worktreePath = join(projectRoot, WORKTREE_DIR, name);

  // Check if worktree exists
  if (!existsSync(worktreePath)) {
    error(`Worktree not found: ${WORKTREE_DIR}/${name}`);
    info('Available worktrees:');
    execInteractive('git worktree list');
    process.exit(1);
  }

  // Get the branch name for this worktree
  const branchName = execQuiet(`cd "${worktreePath}" && git rev-parse --abbrev-ref HEAD`);

  info(`Removing worktree: ${WORKTREE_DIR}/${name}`);

  exec(`git worktree remove "${worktreePath}" --force`);
  success('Worktree removed!');

  // Delete the local branch if it exists
  if (branchName && branchName !== 'HEAD') {
    info(`Deleting local branch: ${branchName}`);
    const result = execQuiet(`git branch -D "${branchName}"`);
    if (result) {
      success(`Local branch '${branchName}' deleted`);
    } else {
      warning(`Could not delete branch '${branchName}' (may not exist or already deleted)`);
    }
  }

  console.log('');
  execInteractive('git worktree list');
}

// List worktrees

export function listWorktrees(): void {
  info('Git worktrees:');
  console.log('');
  execInteractive('git worktree list');
}

// Prune worktrees

export function pruneWorktrees(): void {
  info('Pruning stale worktrees...');
  execInteractive('git worktree prune -v');
  success('Prune complete');
  console.log('');
  listWorktrees();
}
