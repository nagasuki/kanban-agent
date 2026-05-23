const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require("electron");
const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const secretsFilePath = () => path.join(app.getPath("userData"), "secure-api-keys.json");

const readSecrets = () => {
  try {
    return JSON.parse(fs.readFileSync(secretsFilePath(), "utf8"));
  } catch {
    return {};
  }
};

const writeSecrets = (secrets) => {
  fs.mkdirSync(path.dirname(secretsFilePath()), { recursive: true });
  fs.writeFileSync(secretsFilePath(), JSON.stringify(secrets, null, 2));
};

const registerSecureKeyHandlers = () => {
  ipcMain.handle("secure-key:set", async (_event, key, value) => {
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, message: "Secure storage is not available on this system." };
    }

    const secrets = readSecrets();
    secrets[key] = safeStorage.encryptString(value).toString("base64");
    writeSecrets(secrets);
    return { ok: true, message: "API key stored securely." };
  });

  ipcMain.handle("secure-key:get", async (_event, key) => {
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, value: null, message: "Secure storage is not available on this system." };
    }

    const encrypted = readSecrets()[key];
    if (!encrypted) {
      return { ok: true, value: null, message: "No API key stored." };
    }

    try {
      return {
        ok: true,
        value: safeStorage.decryptString(Buffer.from(encrypted, "base64")),
        message: "API key loaded."
      };
    } catch {
      return { ok: false, value: null, message: "Stored API key could not be decrypted." };
    }
  });

  ipcMain.handle("secure-key:delete", async (_event, key) => {
    const secrets = readSecrets();
    delete secrets[key];
    writeSecrets(secrets);
    return { ok: true, message: "API key removed." };
  });

  ipcMain.handle("secure-key:has", async (_event, key) => ({
    ok: true,
    hasKey: Boolean(readSecrets()[key]),
    encryptionAvailable: safeStorage.isEncryptionAvailable()
  }));
};

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim().replaceAll("\\", "/"))
    .filter(Boolean);

const toPosixRelative = (basePath, absolutePath) => path.relative(basePath, absolutePath).replaceAll("\\", "/");

const defaultIgnoredNames = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".vite",
  "coverage",
  ".turbo",
  ".cache"
]);

const matchesPattern = (relativePath, patterns) => {
  const normalized = relativePath.replaceAll("\\", "/");
  return patterns.some((pattern) => {
    const clean = pattern.replaceAll("\\", "/");
    if (!clean) return false;
    if (clean.includes("*")) {
      const escaped = clean.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
      return new RegExp(`(^|/)${escaped}$`).test(normalized);
    }
    return normalized === clean || normalized.endsWith(`/${clean}`) || normalized.includes(clean);
  });
};

const isAllowedPath = (relativePath, allowedFolders) => {
  if (allowedFolders.length === 0) {
    return true;
  }

  return allowedFolders.some((folder) => relativePath === folder || relativePath.startsWith(`${folder}/`));
};

const readFileTree = (repoPath, blockedPatterns, allowedFolders) => {
  const warnings = [];
  let count = 0;
  const maxEntries = 300;

  const visit = (absolutePath, depth) => {
    if (count >= maxEntries) {
      return undefined;
    }

    const stats = fs.statSync(absolutePath);
    const relativePath = toPosixRelative(repoPath, absolutePath) || ".";
    const name = path.basename(absolutePath);

    if (relativePath !== "." && stats.isDirectory() && defaultIgnoredNames.has(name)) {
      return undefined;
    }

    const blocked =
      relativePath !== "." &&
      (matchesPattern(relativePath, blockedPatterns) || !isAllowedPath(relativePath, allowedFolders));

    count += 1;

    if (!stats.isDirectory()) {
      return {
        path: relativePath,
        name,
        type: "file",
        blocked
      };
    }

    const node = {
      path: relativePath,
      name: relativePath === "." ? path.basename(repoPath) : name,
      type: "directory",
      blocked,
      children: []
    };

    if (depth >= 4 || blocked) {
      return node;
    }

    const entries = fs
      .readdirSync(absolutePath, { withFileTypes: true })
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (count >= maxEntries) {
        warnings.push(`File tree truncated at ${maxEntries} entries.`);
        break;
      }

      const child = visit(path.join(absolutePath, entry.name), depth + 1);
      if (child) {
        node.children.push(child);
      }
    }

    return node;
  };

  const root = visit(repoPath, 0);
  return {
    fileTree: root?.children || [],
    warnings
  };
};

const inspectGit = (repoPath) => {
  try {
    execFileSync("git", ["-C", repoPath, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" }).trim();
    const currentBranch = execFileSync("git", ["-C", repoPath, "branch", "--show-current"], { encoding: "utf8" }).trim();
    const status = execFileSync("git", ["-C", repoPath, "status", "--short"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      isGitRepo: true,
      currentBranch: currentBranch || "(detached)",
      dirty: status.length > 0,
      changedFiles: status.map((line) => line.slice(3).trim())
    };
  } catch {
    return {
      isGitRepo: false,
      currentBranch: "",
      dirty: false,
      changedFiles: []
    };
  }
};

const registerRepoHandlers = () => {
  ipcMain.handle("repo:select-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select repository folder"
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, path: null, message: "No folder selected." };
    }

    return { ok: true, path: result.filePaths[0], message: "Repository folder selected." };
  });

  ipcMain.handle("repo:inspect", async (_event, options) => {
    const repoPath = String(options.repoPath || "");
    if (!repoPath || !fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
      return {
        ok: false,
        message: "Repo path is not a readable directory.",
        repoPath,
        scannedAt: new Date().toISOString(),
        isGitRepo: false,
        currentBranch: "",
        dirty: false,
        changedFiles: [],
        fileTree: [],
        warnings: ["Repo path is not a readable directory."]
      };
    }

    const blockedPatterns = parseCsv(options.blockedFilePatterns);
    const allowedFolders = parseCsv(options.allowedEditableFolders);
    const tree = readFileTree(repoPath, blockedPatterns, allowedFolders);
    const git = inspectGit(repoPath);
    const warnings = [...tree.warnings];
    if (git.dirty) {
      warnings.push("Repository has uncommitted changes.");
    }

    return {
      ok: true,
      message: "Repository inspected.",
      repoPath,
      scannedAt: new Date().toISOString(),
      ...git,
      fileTree: tree.fileTree,
      warnings
    };
  });

  ipcMain.handle("repo:read-file", async (_event, options) => {
    const repoPath = String(options.repoPath || "");
    const relativePath = String(options.relativePath || "").replaceAll("\\", "/");
    const blockedPatterns = parseCsv(options.blockedFilePatterns);
    const allowedFolders = parseCsv(options.allowedEditableFolders);

    if (!repoPath || !relativePath || relativePath.includes("..")) {
      return { ok: false, content: "", message: "Invalid file path." };
    }

    if (matchesPattern(relativePath, blockedPatterns) || !isAllowedPath(relativePath, allowedFolders)) {
      return { ok: false, content: "", message: `${relativePath} is blocked by workspace safety settings.` };
    }

    const absolutePath = path.resolve(repoPath, relativePath);
    const resolvedRepo = path.resolve(repoPath);
    if (!absolutePath.startsWith(resolvedRepo) || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      return { ok: false, content: "", message: `${relativePath} is not a readable file.` };
    }

    const content = fs.readFileSync(absolutePath, "utf8");
    const maxChars = 32000;
    return {
      ok: true,
      content: content.length > maxChars ? `${content.slice(0, maxChars)}\n\n[Truncated at ${maxChars} chars]` : content,
      message: `${relativePath} loaded.`
    };
  });

  ipcMain.handle("repo:apply-patch", async (_event, options) => {
    const repoPath = String(options.repoPath || "");
    const patchText = String(options.patchText || "");
    const blockedPatterns = parseCsv(options.blockedFilePatterns);
    const allowedFolders = parseCsv(options.allowedEditableFolders);

    if (!repoPath || !fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
      return { ok: false, output: "Repo path is not readable.", backupPath: "" };
    }

    const touchedFiles = extractPatchFiles(patchText);
    const blockedFile = touchedFiles.find(
      (file) => matchesPattern(file, blockedPatterns) || !isAllowedPath(file, allowedFolders)
    );
    if (blockedFile) {
      return { ok: false, output: `${blockedFile} is blocked by workspace safety settings.`, backupPath: "" };
    }

    const backupPath = createPatchBackup(repoPath, touchedFiles);
    const check = await runCommand("git", ["-C", repoPath, "apply", "--check"], repoPath, patchText, 30000);
    if (!check.ok) {
      return { ok: false, output: check.stderr || check.stdout || "Patch check failed.", backupPath };
    }

    const apply = await runCommand("git", ["-C", repoPath, "apply"], repoPath, patchText, 30000);
    return {
      ok: apply.ok,
      output: [apply.stdout, apply.stderr].filter(Boolean).join("\n") || (apply.ok ? "Patch applied." : "Patch apply failed."),
      backupPath
    };
  });

  ipcMain.handle("repo:run-command", async (_event, options) => {
    const repoPath = String(options.repoPath || "");
    const commandLine = String(options.command || "");
    if (!repoPath || !fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
      return { ok: false, output: "Repo path is not readable." };
    }

    const [command, ...args] = splitArgs(commandLine);
    if (!command) {
      return { ok: false, output: "Command is not configured." };
    }

    const result = await runCommand(command, args, repoPath, "", 120000);
    return {
      ok: result.ok,
      output: [result.stdout, result.stderr].filter(Boolean).join("\n")
    };
  });

  ipcMain.handle("repo:git-commit", async (_event, options) => {
    const repoPath = String(options.repoPath || "");
    const message = String(options.message || "").trim();
    if (!message) {
      return { ok: false, output: "Commit message is required." };
    }

    const add = await runCommand("git", ["-C", repoPath, "add", "-A"], repoPath, "", 30000);
    if (!add.ok) {
      return { ok: false, output: add.stderr || add.stdout || "git add failed." };
    }

    const commit = await runCommand("git", ["-C", repoPath, "commit", "-m", message], repoPath, "", 30000);
    return {
      ok: commit.ok,
      output: [commit.stdout, commit.stderr].filter(Boolean).join("\n")
    };
  });

  ipcMain.handle("repo:git-checkout-files", async (_event, options) => {
    const repoPath = String(options.repoPath || "");
    const files = String(options.files || "")
      .split(",")
      .map((file) => file.trim())
      .filter(Boolean);

    if (files.length === 0) {
      return { ok: false, output: "No files configured for rollback." };
    }

    const result = await runCommand("git", ["-C", repoPath, "checkout", "--", ...files], repoPath, "", 30000);
    return {
      ok: result.ok,
      output: [result.stdout, result.stderr].filter(Boolean).join("\n") || (result.ok ? "Files rolled back." : "Rollback failed.")
    };
  });

  ipcMain.handle("repo:github-pr", async (_event, options) => {
    const repoPath = String(options.repoPath || "");
    const title = String(options.title || "").trim();
    const body = String(options.body || "").trim();
    if (!title) {
      return { ok: false, url: "", output: "PR title is required." };
    }

    const result = await runCommand("gh", ["pr", "create", "--draft", "--title", title, "--body", body], repoPath, "", 120000);
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    const urlMatch = output.match(/https?:\/\/\S+/);
    return {
      ok: result.ok,
      url: urlMatch?.[0] ?? "",
      output: output || (result.ok ? "Draft PR created." : "PR creation failed.")
    };
  });
};

const extractPatchFiles = (patchText) => {
  const files = new Set();
  for (const line of patchText.split(/\r?\n/)) {
    if (line.startsWith("+++ b/")) {
      files.add(line.slice("+++ b/".length).trim());
    }
    if (line.startsWith("--- a/")) {
      files.add(line.slice("--- a/".length).trim());
    }
  }
  return Array.from(files).filter((file) => file && file !== "/dev/null");
};

const createPatchBackup = (repoPath, files) => {
  const backupRoot = path.join(app.getPath("userData"), "backups", `${Date.now()}`);
  for (const file of files) {
    const source = path.resolve(repoPath, file);
    if (!source.startsWith(path.resolve(repoPath)) || !fs.existsSync(source) || !fs.statSync(source).isFile()) {
      continue;
    }

    const target = path.join(backupRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }

  return backupRoot;
};

const runCommand = (command, args, cwd, stdin, timeoutMs) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: process.env
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: error.message, timedOut, exitCode: null });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ ok: exitCode === 0 && !timedOut, stdout, stderr, timedOut, exitCode });
    });

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });

const splitArgs = (value) => {
  const args = [];
  const input = String(value || "");
  let current = "";
  let quote = null;

  for (const char of input) {
    if ((char === "\"" || char === "'") && !quote) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = null;
      continue;
    }

    if (/\s/.test(char) && !quote) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    args.push(current);
  }

  return args;
};

const registerCliHandlers = () => {
  ipcMain.handle("cli:run", async (_event, options) => {
    const command = String(options.command || "").trim();
    const prompt = String(options.prompt || "");
    const cwd = String(options.cwd || app.getPath("home"));
    const timeoutMs = Math.max(10, Number(options.timeoutSeconds || 300)) * 1000;

    if (!command) {
      return { ok: false, exitCode: null, stdout: "", stderr: "CLI command is required.", timedOut: false };
    }

    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      return { ok: false, exitCode: null, stdout: "", stderr: "CLI working directory is not readable.", timedOut: false };
    }

    return new Promise((resolve) => {
      const child = spawn(command, splitArgs(options.args), {
        cwd,
        shell: false,
        windowsHide: true,
        env: process.env
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const maxOutput = 180000;

      const trimOutput = (value) => (value.length > maxOutput ? value.slice(value.length - maxOutput) : value);

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout = trimOutput(stdout + chunk.toString());
      });

      child.stderr.on("data", (chunk) => {
        stderr = trimOutput(stderr + chunk.toString());
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        resolve({ ok: false, exitCode: null, stdout, stderr: error.message, timedOut });
      });

      child.on("close", (exitCode) => {
        clearTimeout(timer);
        resolve({
          ok: exitCode === 0 && !timedOut,
          exitCode,
          stdout,
          stderr: timedOut ? `${stderr}\nCLI command timed out.`.trim() : stderr,
          timedOut
        });
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  });
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 720,
    title: "kanban-agent",
    backgroundColor: "#0b0f14",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
    return;
  }

  win.loadFile(path.join(__dirname, "../dist/index.html"));
};

app.whenReady().then(() => {
  registerSecureKeyHandlers();
  registerRepoHandlers();
  registerCliHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
