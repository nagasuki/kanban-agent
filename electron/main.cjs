const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require("electron");
const { execFileSync } = require("child_process");
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
