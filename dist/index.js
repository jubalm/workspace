#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";

// src/git.ts
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// src/exec.ts
import { execSync } from "node:child_process";

// src/logger.ts
import chalk from "chalk";
var verboseMode = false;
function setVerbose(verbose) {
  verboseMode = verbose;
}
function info(message) {
  if (verboseMode) {
    console.log(chalk.blue("\u2139"), message);
  }
}
function detail(message) {
  console.log(`  ${message}`);
}
function success(message) {
  console.log(chalk.green("\u2713"), message);
}
function warning(message) {
  console.log(chalk.yellow("\u26A0"), message);
}
function error(message) {
  console.error(chalk.red("\u2717"), message);
}

// src/exec.ts
function exec(command, options) {
  try {
    const result = execSync(command, {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "pipe"],
      ...options
    });
    return typeof result === "string" ? result.trim() : result.toString().trim();
  } catch (err) {
    const execError = err;
    error(`Command failed: ${command}`);
    if (execError.stderr) {
      error(execError.stderr.toString());
    }
    process.exit(execError.status ?? 1);
  }
}
function execQuiet(command) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
  } catch {
    return "";
  }
}
function execInteractive(command) {
  try {
    execSync(command, {
      stdio: "inherit"
    });
  } catch (err) {
    const execError = err;
    process.exit(execError.status ?? 1);
  }
}

// src/git.ts
var WORKTREE_DIR = ".worktrees";
var DEFAULT_BASE_BRANCH = "main";
function checkGitRepo() {
  const result = execQuiet("git rev-parse --git-dir");
  if (!result) {
    throw new Error("Not a git repository");
  }
}
function getProjectRoot() {
  return exec("git rev-parse --show-toplevel");
}
function resolveBranch(branch) {
  let remoteCandidate;
  let cleanBranchName;
  if (branch.startsWith("origin/")) {
    remoteCandidate = branch;
    cleanBranchName = branch.replace("origin/", "");
  } else if (branch.startsWith("remotes/origin/")) {
    remoteCandidate = branch.replace("remotes/", "");
    cleanBranchName = branch.replace("remotes/origin/", "");
  } else {
    remoteCandidate = `origin/${branch}`;
    cleanBranchName = branch;
  }
  if (branchExists(remoteCandidate)) {
    info(`Found remote branch: ${remoteCandidate}`);
    return {
      type: "remote",
      foundBranch: remoteCandidate,
      cleanBranchName
    };
  } else if (branchExists(cleanBranchName)) {
    info(`Found local branch: ${cleanBranchName}`);
    return {
      type: "local",
      foundBranch: cleanBranchName,
      cleanBranchName
    };
  } else {
    info(`Branch '${cleanBranchName}' not found on remote or locally`);
    info("Will create new branch from base");
    return {
      type: "new",
      foundBranch: "",
      cleanBranchName
    };
  }
}
function branchExists(branch) {
  const result = execQuiet(`git rev-parse --verify ${branch}`);
  return result !== "";
}
function getBranchRef(branch) {
  return execQuiet(`git rev-parse --verify ${branch}`);
}
function getBranchName(worktreePath) {
  return execQuiet(`cd "${worktreePath}" && git rev-parse --abbrev-ref HEAD`);
}
function getBranchInfo(worktreePath) {
  const branch = getBranchName(worktreePath);
  const tracking = execQuiet(
    `cd "${worktreePath}" && git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null`
  ).replace(/^origin\//, "");
  return {
    branch,
    tracking: tracking && tracking !== "@{u}" ? tracking : void 0
  };
}
function fetchRemote() {
  const result = execQuiet("git fetch --quiet origin");
  if (result === "") {
    return;
  }
}
function sanitizeBranchName(branch) {
  return branch.replace(/[^a-zA-Z0-9_-]/g, "-");
}
function getWorktreeName(branch) {
  return sanitizeBranchName(branch.replace(/^origin\//, ""));
}
function getWorktreePath(worktreeDir, branch) {
  const name = getWorktreeName(branch);
  return join(worktreeDir, name);
}
function ensureTracking(worktreePath, branchName, remoteBranch) {
  const upstream = execQuiet(
    `cd "${worktreePath}" && git rev-parse --abbrev-ref --symbolic-full-name @{u}`
  );
  if (!upstream) {
    info(`Setting up tracking: ${branchName} -> ${remoteBranch}`);
    exec(`cd "${worktreePath}" && git branch --set-upstream-to="${remoteBranch}"`);
  }
}
function createWorktreeWithExistingBranch(worktreePath, branchName, remoteBranch) {
  info(`Using existing local branch: ${branchName}`);
  exec(`git worktree add "${worktreePath}" "${branchName}"`);
  ensureTracking(worktreePath, branchName, remoteBranch);
  success("Worktree created!");
  info(`Branch: ${branchName} (tracking ${remoteBranch})`);
}
function createWorktreeWithNewTrackingBranch(worktreePath, branchName, remoteBranch) {
  info(`Creating local tracking branch: ${branchName} -> ${remoteBranch}`);
  exec(`git worktree add -b "${branchName}" "${worktreePath}" "${remoteBranch}"`);
  exec(`cd "${worktreePath}" && git branch --set-upstream-to="${remoteBranch}"`);
  success("Worktree created!");
  info(`Branch: ${branchName} (tracking ${remoteBranch})`);
}
function createFromRemoteBranch(worktreePath, resolution) {
  const trackingBranchName = resolution.foundBranch.replace("origin/", "");
  if (branchExists(trackingBranchName)) {
    createWorktreeWithExistingBranch(worktreePath, trackingBranchName, resolution.foundBranch);
  } else {
    createWorktreeWithNewTrackingBranch(worktreePath, trackingBranchName, resolution.foundBranch);
  }
}
function createFromLocalBranch(worktreePath, resolution) {
  info(`Using existing local branch: ${resolution.foundBranch}`);
  exec(`git worktree add "${worktreePath}" "${resolution.foundBranch}"`);
  success("Worktree created!");
  info(`Branch: ${resolution.foundBranch}`);
}
function createNewBranch(worktreePath, resolution, baseBranchOption) {
  const baseBranch = baseBranchOption || DEFAULT_BASE_BRANCH;
  if (!branchExists(baseBranch)) {
    error(`Base branch not found: ${baseBranch}`);
    info("Available branches:");
    execInteractive("git branch -a | head -20");
    process.exit(1);
  }
  const branchRef = getBranchRef(baseBranch);
  info(`Creating new branch '${resolution.cleanBranchName}' from: ${baseBranch}`);
  exec(`git worktree add -b "${resolution.cleanBranchName}" "${worktreePath}" "${branchRef}"`);
  success("Worktree created!");
  info(`Branch: ${resolution.cleanBranchName} (new from ${baseBranch})`);
}
function ensureGitignore(projectRoot, worktreeDir) {
  const gitignorePath = join(projectRoot, ".gitignore");
  const pattern = `${worktreeDir}/`;
  if (!existsSync(gitignorePath)) {
    warning(".gitignore not found, creating one");
    writeFileSync(gitignorePath, `${pattern}
`);
    success(`Added ${pattern} to .gitignore`);
    return;
  }
  const content = readFileSync(gitignorePath, "utf8");
  const regex = new RegExp(`^${worktreeDir}/?$`, "m");
  if (!regex.test(content)) {
    warning(`${pattern} not found in .gitignore`);
    appendFileSync(gitignorePath, `
# git worktrees
${pattern}
`);
    success(`Added ${pattern} to .gitignore`);
  }
}

// src/commands.ts
import { existsSync as existsSync3, mkdirSync } from "node:fs";
import { join as join3 } from "node:path";

// src/autorun.ts
import { existsSync as existsSync2, accessSync, constants, readFileSync as readFileSync2 } from "node:fs";
import { execSync as execSync2 } from "node:child_process";
import { join as join2 } from "node:path";
function detectSetupScript(worktreePath) {
  const candidates = [
    "script/setup",
    "script/bootstrap",
    "bin/setup",
    "setup.sh",
    "bootstrap.sh",
    "scripts/setup.sh",
    "scripts/bootstrap.sh"
  ];
  for (const candidate of candidates) {
    const fullPath = join2(worktreePath, candidate);
    if (isExecutable(fullPath)) {
      return fullPath;
    }
  }
  const makefilePath = join2(worktreePath, "Makefile");
  if (hasMakeTarget(makefilePath, ["setup", "bootstrap"])) {
    return "make setup";
  }
  return null;
}
function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.F_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function hasMakeTarget(makefilePath, targets) {
  if (!existsSync2(makefilePath)) {
    return false;
  }
  try {
    const content = readFileSync2(makefilePath, "utf-8");
    for (const target of targets) {
      if (new RegExp(`^${target}:`, "m").test(content)) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}
function runSetup(worktreePath, setupMode) {
  if (setupMode === "none") {
    info("Skipping setup (--no-setup flag set)");
    return true;
  }
  console.log("");
  let setupScript;
  if (setupMode === "default") {
    setupScript = detectSetupScript(worktreePath);
    if (!setupScript) {
      info("No setup script found (checked: script/setup, script/bootstrap, bin/setup, setup.sh, etc.)");
      info("To use a custom script, run: workspace <branch> -s /path/to/script.sh");
      return true;
    }
    success(`Found setup script: ${setupScript}`);
  } else {
    setupScript = setupMode;
  }
  if (!existsSync2(setupScript)) {
    warning(`Setup script not found: ${setupScript}`);
    return true;
  }
  try {
    accessSync(setupScript, constants.X_OK);
  } catch {
    warning(`Setup script is not executable: ${setupScript}`);
    info(`Run: chmod +x ${setupScript}`);
    return true;
  }
  console.log("");
  info(`Running setup script: ${setupScript}`);
  const startTime = Date.now();
  try {
    execSync2(`"${setupScript}"`, {
      stdio: "inherit",
      cwd: worktreePath,
      env: {
        ...process.env,
        WORKSPACE_DIR: worktreePath
      }
    });
    const duration = Math.floor((Date.now() - startTime) / 1e3);
    success(`Setup complete! (${duration}s)`);
    return true;
  } catch {
    error("Setup script exited with error");
    warning("Worktree created but setup failed");
    return false;
  }
}

// src/commands.ts
function prepareWorktreePaths(branch) {
  const projectRoot = getProjectRoot();
  const dirName = getWorktreeName(branch);
  const worktreePath = getWorktreePath(join3(projectRoot, WORKTREE_DIR), branch);
  return { projectRoot, dirName, worktreePath };
}
function ensureWorktreeDir(projectRoot) {
  const worktreePath = join3(projectRoot, WORKTREE_DIR);
  if (!existsSync3(worktreePath)) {
    info(`Creating ${WORKTREE_DIR}/ directory`);
    mkdirSync(worktreePath, { recursive: true });
    success(`Created ${WORKTREE_DIR}/ directory`);
  }
}
function setupPrerequisites(projectRoot) {
  ensureGitignore(projectRoot, WORKTREE_DIR);
  ensureWorktreeDir(projectRoot);
  fetchRemote();
}
function handleExistingWorktree(worktreePath, dirName, options) {
  const setupMode = options.skipSetup ? "none" : options.setupScript || "default";
  if (!runSetup(worktreePath, setupMode)) {
    process.exit(1);
  }
  const branchInfo = getBranchInfo(worktreePath);
  const branchDesc = branchInfo.tracking ? `${branchInfo.branch} \u2192 ${branchInfo.tracking}` : branchInfo.branch;
  console.log("");
  success(`Worktree ready: ${WORKTREE_DIR}/${dirName}`);
  detail(`Branch: ${branchDesc}`);
  console.log("");
}
function createWorktree(branch, options) {
  const { projectRoot, dirName, worktreePath } = prepareWorktreePaths(branch);
  if (existsSync3(worktreePath)) {
    handleExistingWorktree(worktreePath, dirName, options);
    return;
  }
  setupPrerequisites(projectRoot);
  const resolution = resolveBranch(branch);
  switch (resolution.type) {
    case "remote":
      createFromRemoteBranch(worktreePath, resolution);
      break;
    case "local":
      createFromLocalBranch(worktreePath, resolution);
      break;
    case "new":
      createNewBranch(worktreePath, resolution, options.baseBranch);
      break;
  }
  const setupMode = options.skipSetup ? "none" : options.setupScript || "default";
  if (!runSetup(worktreePath, setupMode)) {
    process.exit(1);
  }
  const branchInfo = getBranchInfo(worktreePath);
  const branchDesc = branchInfo.tracking ? `${branchInfo.branch} \u2192 ${branchInfo.tracking}` : branchInfo.branch;
  console.log("");
  success(`Worktree ready: ${WORKTREE_DIR}/${dirName}`);
  detail(`Branch: ${branchDesc}`);
  console.log("");
}
function removeWorktree(name) {
  const projectRoot = getProjectRoot();
  const worktreePath = join3(projectRoot, WORKTREE_DIR, name);
  if (!existsSync3(worktreePath)) {
    error(`Worktree not found: ${WORKTREE_DIR}/${name}`);
    info("Available worktrees:");
    execInteractive("git worktree list");
    process.exit(1);
  }
  const branchName = execQuiet(`cd "${worktreePath}" && git rev-parse --abbrev-ref HEAD`);
  exec(`git worktree remove "${worktreePath}" --force`);
  let deletedBranch = false;
  if (branchName && branchName !== "HEAD") {
    const result = execQuiet(`git branch -D "${branchName}"`);
    deletedBranch = !!result;
  }
  console.log("");
  success(`Removed: ${WORKTREE_DIR}/${name}`);
  if (deletedBranch) {
    detail(`Deleted branch: ${branchName}`);
  }
  console.log("");
  execInteractive("git worktree list");
}
function listWorktrees() {
  info("Git worktrees:");
  console.log("");
  execInteractive("git worktree list");
}
function pruneWorktrees() {
  info("Pruning stale worktrees");
  execInteractive("git worktree prune -v");
  success("Stale worktrees pruned");
  console.log("");
  listWorktrees();
}

// src/index.ts
var program = new Command();
program.name("workspace").description("Easily create isolated workspaces that fit your git workflow \u2014 comes with automatic and configurable setup detection. Perfect for AI sandboxed coding and testing.").version("0.0.1").option("-v, --verbose", "Show detailed operation logs");
program.argument("[branch]", "Branch name to create worktree for").option("-n, --no-setup", "Skip setup script (fastest, git operations only)").option("-s, --setup <path>", "Use custom setup script").option("-b, --base <branch>", "Create new branch from custom base (default: main)").action((branch, options) => {
  try {
    if (options.verbose) setVerbose(true);
    checkGitRepo();
    if (!branch) {
      program.help();
      return;
    }
    const createOptions = {
      skipSetup: options.setup === false,
      setupScript: typeof options.setup === "string" ? options.setup : void 0,
      baseBranch: options.base
    };
    createWorktree(branch, createOptions);
  } catch (err) {
    if (err instanceof Error) {
      error(err.message);
    }
    process.exit(1);
  }
});
program.command("list").alias("ls").description("List all worktrees").option("-v, --verbose", "Show detailed operation logs").action((options) => {
  try {
    if (options.verbose) setVerbose(true);
    checkGitRepo();
    listWorktrees();
  } catch (err) {
    if (err instanceof Error) {
      error(err.message);
    }
    process.exit(1);
  }
});
program.command("remove <name>").alias("rm").alias("delete").description("Remove a worktree").option("-v, --verbose", "Show detailed operation logs").action((name, options) => {
  try {
    if (options.verbose) setVerbose(true);
    checkGitRepo();
    removeWorktree(name);
  } catch (err) {
    if (err instanceof Error) {
      error(err.message);
    }
    process.exit(1);
  }
});
program.command("prune").alias("clean").description("Clean up stale worktrees").option("-v, --verbose", "Show detailed operation logs").action((options) => {
  try {
    if (options.verbose) setVerbose(true);
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
//# sourceMappingURL=index.js.map
