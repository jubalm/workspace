import { execSync, ExecSyncOptions } from 'node:child_process';
import { error } from './logger.js';

export function exec(command: string, options?: ExecSyncOptions): string {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      ...options,
    });
    return typeof result === 'string' ? result.trim() : result.toString().trim();
  } catch (err) {
    const execError = err as { status?: number; stderr?: Buffer };
    error(`Command failed: ${command}`);
    if (execError.stderr) {
      error(execError.stderr.toString());
    }
    process.exit(execError.status ?? 1);
  }
}

export function execQuiet(command: string): string {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

export function execInteractive(command: string): void {
  try {
    execSync(command, {
      stdio: 'inherit',
    });
  } catch (err) {
    const execError = err as { status?: number };
    process.exit(execError.status ?? 1);
  }
}
