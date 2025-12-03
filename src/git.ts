import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exec, execQuiet, execInteractive } from './exec.js';
import { info, warning, success, error } from './logger.js';

export const WORKTREE_DIR = '.worktree';
export const DEFAULT_BASE_BRANCH = 'main';

export interface BranchResolution {
  type: 'remote' | 'local' | 'new';
  foundBranch: string;
  cleanBranchName: string;
}

// Git validation

export function checkGitRepo(): void {
  const result = execQuiet('git rev-parse --git-dir');
  if (!result) {
    throw new Error('Not a git repository');
  }
}

export function getProjectRoot(): string {
  return exec('git rev-parse --show-toplevel');
}

// Branch operations

export function resolveBranch(branch: string): BranchResolution {
  let remoteCandidate: string;
  let cleanBranchName: string;

  // Build remote candidate first (before stripping prefixes)
  if (branch.startsWith('origin/')) {
    remoteCandidate = branch;
    cleanBranchName = branch.replace('origin/', '');
  } else if (branch.startsWith('remotes/origin/')) {
    remoteCandidate = branch.replace('remotes/', '');
    cleanBranchName = branch.replace('remotes/origin/', '');
  } else {
    // For anything else (claude/foo, feature/bar, etc.), prepend origin/
    remoteCandidate = `origin/${branch}`;
    cleanBranchName = branch;
  }

  // Check remote, then local, then create new
  if (branchExists(remoteCandidate)) {
    info(`Found remote branch: ${remoteCandidate}`);
    return {
      type: 'remote',
      foundBranch: remoteCandidate,
      cleanBranchName,
    };
  } else if (branchExists(cleanBranchName)) {
    info(`Found local branch: ${cleanBranchName}`);
    return {
      type: 'local',
      foundBranch: cleanBranchName,
      cleanBranchName,
    };
  } else {
    info(`Branch '${cleanBranchName}' not found on remote or locally`);
    info('Will create new branch from base');
    return {
      type: 'new',
      foundBranch: '',
      cleanBranchName,
    };
  }
}

export function branchExists(branch: string): boolean {
  const result = execQuiet(`git rev-parse --verify ${branch}`);
  return result !== '';
}

export function getBranchRef(branch: string): string {
  return execQuiet(`git rev-parse --verify ${branch}`);
}

export function getBranchName(worktreePath: string): string {
  return execQuiet(`cd "${worktreePath}" && git rev-parse --abbrev-ref HEAD`);
}

export function getBranchInfo(worktreePath: string): { branch: string; tracking?: string } {
  const branch = getBranchName(worktreePath);
  const tracking = execQuiet(
    `cd "${worktreePath}" && git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null`
  ).replace(/^origin\//, '');

  return {
    branch,
    tracking: tracking && tracking !== '@{u}' ? tracking : undefined,
  };
}

export function fetchRemote(): void {
  const result = execQuiet('git fetch --quiet origin');
  if (result === '') {
    // Fetch succeeded (no output expected)
    return;
  }
}

// Worktree paths

export function sanitizeBranchName(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function getWorktreeName(branch: string): string {
  return sanitizeBranchName(branch.replace(/^origin\//, ''));
}

export function getWorktreePath(worktreeDir: string, branch: string): string {
  const name = getWorktreeName(branch);
  return join(worktreeDir, name);
}

// Worktree creation handlers

function ensureTracking(
  worktreePath: string,
  branchName: string,
  remoteBranch: string
): void {
  const upstream = execQuiet(
    `cd "${worktreePath}" && git rev-parse --abbrev-ref --symbolic-full-name @{u}`
  );
  if (!upstream) {
    info(`Setting up tracking: ${branchName} -> ${remoteBranch}`);
    exec(`cd "${worktreePath}" && git branch --set-upstream-to="${remoteBranch}"`);
  }
}

function createWorktreeWithExistingBranch(
  worktreePath: string,
  branchName: string,
  remoteBranch: string
): void {
  info(`Using existing local branch: ${branchName}`);
  exec(`git worktree add "${worktreePath}" "${branchName}"`);
  ensureTracking(worktreePath, branchName, remoteBranch);
  success('Worktree created!');
  info(`Branch: ${branchName} (tracking ${remoteBranch})`);
}

function createWorktreeWithNewTrackingBranch(
  worktreePath: string,
  branchName: string,
  remoteBranch: string
): void {
  info(`Creating local tracking branch: ${branchName} -> ${remoteBranch}`);
  exec(`git worktree add -b "${branchName}" "${worktreePath}" "${remoteBranch}"`);
  exec(`cd "${worktreePath}" && git branch --set-upstream-to="${remoteBranch}"`);
  success('Worktree created!');
  info(`Branch: ${branchName} (tracking ${remoteBranch})`);
}

export function createFromRemoteBranch(
  worktreePath: string,
  resolution: BranchResolution
): void {
  const trackingBranchName = resolution.foundBranch.replace('origin/', '');

  if (branchExists(trackingBranchName)) {
    createWorktreeWithExistingBranch(worktreePath, trackingBranchName, resolution.foundBranch);
  } else {
    createWorktreeWithNewTrackingBranch(worktreePath, trackingBranchName, resolution.foundBranch);
  }
}

export function createFromLocalBranch(
  worktreePath: string,
  resolution: BranchResolution
): void {
  info(`Using existing local branch: ${resolution.foundBranch}`);
  exec(`git worktree add "${worktreePath}" "${resolution.foundBranch}"`);
  success('Worktree created!');
  info(`Branch: ${resolution.foundBranch}`);
}

export function createNewBranch(
  worktreePath: string,
  resolution: BranchResolution,
  baseBranchOption?: string
): void {
  const baseBranch = baseBranchOption || DEFAULT_BASE_BRANCH;

  // Verify base branch exists
  if (!branchExists(baseBranch)) {
    error(`Base branch not found: ${baseBranch}`);
    info('Available branches:');
    execInteractive('git branch -a | head -20');
    process.exit(1);
  }

  const branchRef = getBranchRef(baseBranch);
  info(`Creating new branch '${resolution.cleanBranchName}' from: ${baseBranch}`);

  exec(`git worktree add -b "${resolution.cleanBranchName}" "${worktreePath}" "${branchRef}"`);
  success('Worktree created!');
  info(`Branch: ${resolution.cleanBranchName} (new from ${baseBranch})`);
}

// Gitignore management

export function ensureGitignore(projectRoot: string, worktreeDir: string): void {
  const gitignorePath = join(projectRoot, '.gitignore');
  const pattern = `${worktreeDir}/`;

  if (!existsSync(gitignorePath)) {
    warning('.gitignore not found, creating one');
    writeFileSync(gitignorePath, `${pattern}\n`);
    success(`Added ${pattern} to .gitignore`);
    return;
  }

  const content = readFileSync(gitignorePath, 'utf8');
  const regex = new RegExp(`^${worktreeDir}/?\$`, 'm');

  if (!regex.test(content)) {
    warning(`${pattern} not found in .gitignore`);
    appendFileSync(gitignorePath, `\n# git worktrees\n${pattern}\n`);
    success(`Added ${pattern} to .gitignore`);
  }
}
