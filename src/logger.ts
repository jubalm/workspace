import chalk from 'chalk';

let verboseMode = false;

export function setVerbose(verbose: boolean): void {
  verboseMode = verbose;
}

export function info(message: string): void {
  if (verboseMode) {
    console.log(chalk.blue('ℹ'), message);
  }
}

// Indented detail lines (no icon, always shown)
export function detail(message: string): void {
  console.log(`  ${message}`);
}

export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

export function warning(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

// Lightweight spinner (no dependencies needed)
interface Spinner {
  start(): void;
  succeed(message?: string): void;
  fail(message?: string): void;
  stop(): void;
}

export function createSpinner(message: string): Spinner {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frameIndex = 0;
  let interval: NodeJS.Timeout | null = null;
  let isRunning = false;

  const render = (): void => {
    const frame = frames[frameIndex % frames.length];
    process.stdout.write(`\r${chalk.cyan(frame)} ${message}`);
    frameIndex++;
  };

  return {
    start(): void {
      if (isRunning) return;
      isRunning = true;
      render();
      interval = setInterval(render, 80);
    },

    succeed(finalMessage?: string): void {
      if (!isRunning) return;
      isRunning = false;
      if (interval) clearInterval(interval);
      const msg = finalMessage || message;
      // Pad with spaces to clear any leftover spinner characters
      const padding = Math.max(0, message.length - msg.length + 20);
      process.stdout.write(`\r${chalk.green('✓')} ${msg}${' '.repeat(padding)}\n`);
    },

    fail(finalMessage?: string): void {
      if (!isRunning) return;
      isRunning = false;
      if (interval) clearInterval(interval);
      const msg = finalMessage || message;
      // Pad with spaces to clear any leftover spinner characters
      const padding = Math.max(0, message.length - msg.length + 20);
      process.stdout.write(`\r${chalk.red('✗')} ${msg}${' '.repeat(padding)}\n`);
    },

    stop(): void {
      if (!isRunning) return;
      isRunning = false;
      if (interval) clearInterval(interval);
      process.stdout.write('\r');
    },
  };
}
