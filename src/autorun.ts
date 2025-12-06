import { existsSync, accessSync, constants, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { info, warning, success, error } from './logger.js';

export type SetupMode = 'none' | 'default' | string;

/**
 * Detects setup script in worktree using industry-standard patterns.
 * Checks in priority order:
 * 1. script/setup (GitHub STRTA)
 * 2. script/bootstrap (GitHub STRTA)
 * 3. bin/setup (Ruby/Rails)
 * 4. setup.sh (project root)
 * 5. bootstrap.sh (project root)
 * 6. scripts/setup.sh
 * 7. scripts/bootstrap.sh
 * 8. Makefile (with setup/bootstrap target)
 *
 * @param worktreePath - Absolute path to worktree
 * @returns Path to detected script, or null if none found
 */
function detectSetupScript(worktreePath: string): string | null {
  const candidates = [
    'script/setup',
    'script/bootstrap',
    'bin/setup',
    'setup.sh',
    'bootstrap.sh',
    'scripts/setup.sh',
    'scripts/bootstrap.sh',
  ];

  for (const candidate of candidates) {
    const fullPath = join(worktreePath, candidate);
    if (isExecutable(fullPath)) {
      return fullPath;
    }
  }

  // Check Makefile as fallback
  const makefilePath = join(worktreePath, 'Makefile');
  if (hasMakeTarget(makefilePath, ['setup', 'bootstrap'])) {
    return 'make setup';
  }

  return null;
}

/**
 * Checks if a file exists and is executable
 */
function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.F_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if Makefile has one of the specified targets
 */
function hasMakeTarget(makefilePath: string, targets: string[]): boolean {
  if (!existsSync(makefilePath)) {
    return false;
  }

  try {
    const content = readFileSync(makefilePath, 'utf-8');
    // Check for lines like ".PHONY: setup" or "setup:" etc
    for (const target of targets) {
      // Match lines starting with target name followed by colon
      // This is a simple check; doesn't handle all Makefile edge cases
      if (new RegExp(`^${target}:`, 'm').test(content)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export function runSetup(worktreePath: string, setupMode: SetupMode): boolean {
  if (setupMode === 'none') {
    info('Skipping setup (--no-setup flag set)');
    return true;
  }

  console.log('');

  let setupScript: string | null;

  if (setupMode === 'default') {
    // Auto-detect setup script
    setupScript = detectSetupScript(worktreePath);

    if (!setupScript) {
      info('No setup script found (checked: script/setup, script/bootstrap, bin/setup, setup.sh, etc.)');
      info('To use a custom script, run: workspace <branch> -s /path/to/script.sh');
      return true;
    }

    success(`Found setup script: ${setupScript}`);
  } else {
    // User specified custom script - use as-is
    setupScript = setupMode;
  }

  // Check if setup script exists
  if (!existsSync(setupScript)) {
    warning(`Setup script not found: ${setupScript}`);
    return true;
  }

  // Check if setup script is executable
  try {
    accessSync(setupScript, constants.X_OK);
  } catch {
    warning(`Setup script is not executable: ${setupScript}`);
    info(`Run: chmod +x ${setupScript}`);
    return true;
  }

  // Execute setup script
  console.log('');
  info(`Running setup script: ${setupScript}`);
  const startTime = Date.now();
  try {
    execSync(`"${setupScript}"`, {
      stdio: 'inherit',
      cwd: worktreePath,
      env: {
        ...process.env,
        WORKSPACE_DIR: worktreePath,
      },
    });

    const duration = Math.floor((Date.now() - startTime) / 1000);
    success(`Setup complete! (${duration}s)`);
    return true;
  } catch {
    error('Setup script exited with error');
    warning('Worktree created but setup failed');
    return false;
  }
}
