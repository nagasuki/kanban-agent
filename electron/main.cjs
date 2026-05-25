const { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } = require("electron");
const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const secretsFilePath = () => path.join(app.getPath("userData"), "secure-api-keys.json");

const readPackageJson = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
  } catch {
    return {};
  }
};

const compareVersions = (current, latest) => {
  const currentParts = String(current || "0.0.0").replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const latestParts = String(latest || "0.0.0").replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(currentParts.length, latestParts.length); index += 1) {
    const currentPart = currentParts[index] ?? 0;
    const latestPart = latestParts[index] ?? 0;
    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }
  return false;
};

const normalizeGitHubRepo = (value) => {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (/^[\w.-]+\/[\w.-]+$/.test(clean)) return clean;

  const httpsMatch = clean.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?/i);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  const sshMatch = clean.match(/git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?/i);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  return "";
};

const resolveGitHubRepo = () => {
  const packageJson = readPackageJson();
  const configuredRepo =
    process.env.KANBAN_AGENT_GITHUB_REPO ||
    packageJson.githubRepo ||
    packageJson.repository?.url ||
    packageJson.repository ||
    "";
  const normalizedRepo = normalizeGitHubRepo(configuredRepo);
  if (normalizedRepo) {
    return normalizedRepo;
  }

  try {
    const remote = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
      windowsHide: true
    }).trim();
    return normalizeGitHubRepo(remote);
  } catch {
    return "";
  }
};

const resolveGitHubReleasesUrl = () => {
  const repo = resolveGitHubRepo();
  return repo ? `https://api.github.com/repos/${repo}/releases/latest` : "";
};

const resolveGitHubReleasePageUrl = () => {
  const repo = resolveGitHubRepo();
  return repo ? `https://github.com/${repo}/releases/latest` : "";
};

let lastUpdateCheck = {
  checkedAt: "",
  currentVersion: app.getVersion(),
  latestVersion: "",
  updateAvailable: false,
  downloadUrl: "",
  installerUrl: "",
  message: "Update check has not run yet."
};

const installerExtensionsForPlatform = () => {
  if (process.platform === "win32") return [".msi", ".exe"];
  if (process.platform === "darwin") return [".dmg", ".zip"];
  return [".appimage", ".deb", ".rpm", ".tar.gz"];
};

const selectInstallerAsset = (assets = []) => {
  const extensions = installerExtensionsForPlatform();
  const archHints = process.arch === "x64" ? ["x64", "amd64", "win"] : [process.arch];
  const candidates = assets
    .map((asset) => ({
      name: String(asset.name || ""),
      url: asset.browser_download_url || asset.url || ""
    }))
    .filter((asset) => asset.name && asset.url)
    .filter((asset) => extensions.some((extension) => asset.name.toLowerCase().endsWith(extension)));

  return (
    candidates.find((asset) => archHints.some((hint) => asset.name.toLowerCase().includes(hint))) ||
    candidates[0] ||
    null
  );
};

const normalizeUpdatePayload = (payload) => {
  if (Array.isArray(payload)) {
    const release = payload.find((item) => !item.draft && !item.prerelease) || payload[0] || {};
    const installer = selectInstallerAsset(release.assets || []);
    return {
      version: release.tag_name || release.name || release.version || "",
      downloadUrl: release.html_url || release.assets?.[0]?.browser_download_url || "",
      installerUrl: installer?.url || "",
      notes: release.body || ""
    };
  }

  const installer = selectInstallerAsset(payload.assets || []);
  return {
    version: payload.version || payload.latestVersion || payload.tag_name || payload.name || "",
    downloadUrl: payload.url || payload.downloadUrl || payload.html_url || payload.assets?.[0]?.browser_download_url || "",
    installerUrl: payload.installerUrl || installer?.url || "",
    notes: payload.notes || payload.body || ""
  };
};

const safeUpdateFilename = (url, version) => {
  const rawName = decodeURIComponent(String(url || "").split("?")[0].split("/").pop() || `kanban-agent-${version}`);
  return rawName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
};

const downloadUpdateInstaller = async (updateInfo) => {
  if (!updateInfo.installerUrl) {
    throw new Error("No installable release asset was found for this platform.");
  }

  const response = await fetch(updateInfo.installerUrl, {
    headers: {
      Accept: "application/octet-stream",
      "User-Agent": "kanban-agent-update-checker"
    }
  });
  if (!response.ok) {
    throw new Error(`Installer download failed with HTTP ${response.status}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const updateDir = path.join(app.getPath("temp"), "kanban-agent-updates");
  fs.mkdirSync(updateDir, { recursive: true });
  const installerPath = path.join(updateDir, safeUpdateFilename(updateInfo.installerUrl, updateInfo.latestVersion));
  fs.writeFileSync(installerPath, Buffer.from(arrayBuffer));
  return installerPath;
};

const launchInstaller = (installerPath) => {
  const extension = path.extname(installerPath).toLowerCase();
  if (process.platform === "win32" && extension === ".msi") {
    const child = spawn("msiexec.exe", ["/i", installerPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: false
    });
    child.unref();
    app.quit();
    return;
  }

  if (process.platform === "win32" && extension === ".exe") {
    const child = spawn(installerPath, [], {
      detached: true,
      stdio: "ignore",
      windowsHide: false
    });
    child.unref();
    app.quit();
    return;
  }

  void shell.openPath(installerPath);
};

const promptForAppUpdate = async (updateInfo) => {
  if (!updateInfo.updateAvailable) {
    return updateInfo;
  }

  const targetUrl = updateInfo.downloadUrl || resolveGitHubReleasePageUrl();
  const result = await dialog.showMessageBox(BrowserWindow.getFocusedWindow() || undefined, {
    type: "info",
    buttons: updateInfo.installerUrl ? ["Download and Install", "Open Release", "Later"] : ["Open Release", "Later"],
    defaultId: 0,
    cancelId: updateInfo.installerUrl ? 2 : 1,
    title: "Kanban Agent update available",
    message: `Kanban Agent ${updateInfo.latestVersion} is available.`,
    detail: [
      `Current version: ${updateInfo.currentVersion}`,
      `Latest version: ${updateInfo.latestVersion}`,
      "",
      updateInfo.installerUrl ? "Download the installer from GitHub Releases and start installation now?" : "No installable asset was found. Open the GitHub release page?"
    ].join("\n")
  });

  if (updateInfo.installerUrl && result.response === 0) {
    try {
      const installerPath = await downloadUpdateInstaller(updateInfo);
      launchInstaller(installerPath);
    } catch (error) {
      await dialog.showMessageBox(BrowserWindow.getFocusedWindow() || undefined, {
        type: "error",
        buttons: ["Open Release", "Close"],
        defaultId: 0,
        cancelId: 1,
        title: "Update install failed",
        message: "Kanban Agent could not download or start the installer.",
        detail: error instanceof Error ? error.message : "Unknown update install error."
      }).then((fallbackResult) => {
        if (fallbackResult.response === 0 && targetUrl) {
          void shell.openExternal(targetUrl);
        }
      });
    }
    return updateInfo;
  }

  const openReleaseResponse = updateInfo.installerUrl ? 1 : 0;
  if (result.response === openReleaseResponse && targetUrl) {
    await shell.openExternal(targetUrl);
  }

  return updateInfo;
};

const checkForAppUpdate = async (options = {}) => {
  const currentVersion = app.getVersion();
  const updateUrl = resolveGitHubReleasesUrl();
  if (!updateUrl) {
    lastUpdateCheck = {
      checkedAt: new Date().toISOString(),
      currentVersion,
      latestVersion: "",
      updateAvailable: false,
      downloadUrl: "",
      installerUrl: "",
      message: "No GitHub release source configured."
    };
    return options.prompt ? promptForAppUpdate(lastUpdateCheck) : lastUpdateCheck;
  }

  try {
    const response = await fetch(updateUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "kanban-agent-update-checker"
      }
    });
    if (!response.ok) {
      throw new Error(`Update server returned HTTP ${response.status}.`);
    }
    const payload = normalizeUpdatePayload(await response.json());
    const latestVersion = String(payload.version || "").replace(/^v/i, "");
    const updateAvailable = latestVersion ? compareVersions(currentVersion, latestVersion) : false;
    lastUpdateCheck = {
      checkedAt: new Date().toISOString(),
      currentVersion,
      latestVersion,
      updateAvailable,
      downloadUrl: payload.downloadUrl,
      installerUrl: payload.installerUrl,
      message: updateAvailable ? `GitHub release ${latestVersion} is available.` : "You are on the latest GitHub release."
    };
    return options.prompt ? promptForAppUpdate(lastUpdateCheck) : lastUpdateCheck;
  } catch (error) {
    lastUpdateCheck = {
      checkedAt: new Date().toISOString(),
      currentVersion,
      latestVersion: "",
      updateAvailable: false,
      downloadUrl: "",
      installerUrl: "",
      message: error instanceof Error ? error.message : "Update check failed."
    };
    return options.prompt ? promptForAppUpdate(lastUpdateCheck) : lastUpdateCheck;
  }
};

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

const registerUpdateHandlers = () => {
  ipcMain.handle("updates:get-info", async () => ({
    ...lastUpdateCheck,
    currentVersion: app.getVersion()
  }));

  ipcMain.handle("updates:check", async (_event, options) => checkForAppUpdate({ prompt: Boolean(options?.prompt) }));
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
    const branches = execFileSync("git", ["-C", repoPath, "branch", "--format=%(refname:short)"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const status = execFileSync("git", ["-C", repoPath, "status", "--short"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      versionControlProvider: "git",
      isGitRepo: true,
      isPlasticWorkspace: false,
      currentBranch: currentBranch || "(detached)",
      branches,
      dirty: status.length > 0,
      changedFiles: status.map((line) => line.slice(3).trim())
    };
  } catch {
    return {
      versionControlProvider: "none",
      isGitRepo: false,
      isPlasticWorkspace: false,
      currentBranch: "",
      branches: [],
      dirty: false,
      changedFiles: []
    };
  }
};

const runCommandSync = (command, args, cwd) => {
  const env = commandEnvironment();
  const executable = resolveExecutable(command, env);
  if (!executable.found && process.platform === "win32") {
    return {
      ok: false,
      stdout: "",
      stderr: commandNotFoundMessage(command, executable.searched)
    };
  }

  try {
    const invocation = prepareCommandInvocation(executable.command, args);
    const stdout = execFileSync(invocation.command, invocation.args, {
      cwd,
      encoding: "utf8",
      env,
      windowsHide: true
    });
    return { ok: true, stdout, stderr: "" };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString?.() || "",
      stderr: error.stderr?.toString?.() || error.message
    };
  }
};

const normalizePlasticBranch = (branch) => {
  const clean = String(branch || "").trim();
  if (!clean) return "";
  if (clean.startsWith("br:")) return clean.slice(3);
  return clean;
};

const parsePlasticCurrentBranch = (output) => {
  const branchMatch =
    output.match(/Branch:\s*(\/[^\r\n]+)/i) ||
    output.match(/branch\s+['"]?(\/[^\s'"\r\n]+)/i) ||
    output.match(/br:(\/[^\s'"\r\n]+)/i);
  return branchMatch?.[1]?.trim() || "";
};

const inspectPlastic = (repoPath) => {
  const status = runCommandSync("cm", ["status", repoPath, "--short"], repoPath);
  if (!status.ok) {
    return {
      versionControlProvider: "none",
      isGitRepo: false,
      isPlasticWorkspace: false,
      currentBranch: "",
      branches: [],
      dirty: false,
      changedFiles: [],
      warning: status.stderr || "Plastic SCM workspace was not detected."
    };
  }

  const header = runCommandSync("cm", ["status", repoPath], repoPath);
  const branchList = runCommandSync("cm", ["find", "branches", "--format={name}", "--nototal"], repoPath);
  const currentBranch = parsePlasticCurrentBranch(header.stdout) || "/main";
  const branches = (branchList.ok ? branchList.stdout : "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Total:"));
  const changedFiles = status.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    versionControlProvider: "plastic",
    isGitRepo: false,
    isPlasticWorkspace: true,
    currentBranch,
    branches: branches.length > 0 ? branches : [currentBranch],
    dirty: changedFiles.length > 0,
    changedFiles
  };
};

const inspectVersionControl = (repoPath, requestedProvider) => {
  if (requestedProvider === "git") {
    return inspectGit(repoPath);
  }

  if (requestedProvider === "plastic") {
    return inspectPlastic(repoPath);
  }

  const git = inspectGit(repoPath);
  if (git.isGitRepo) {
    return git;
  }

  return inspectPlastic(repoPath);
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
    const requestedVersionControlProvider = String(options.versionControlProvider || "auto");
    if (!repoPath || !fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
      return {
        ok: false,
        message: "Repo path is not a readable directory.",
        repoPath,
        scannedAt: new Date().toISOString(),
        versionControlProvider: "none",
        requestedVersionControlProvider,
        isGitRepo: false,
        isPlasticWorkspace: false,
        currentBranch: "",
        branches: [],
        dirty: false,
        changedFiles: [],
        fileTree: [],
        warnings: ["Repo path is not a readable directory."]
      };
    }

    const blockedPatterns = parseCsv(options.blockedFilePatterns);
    const allowedFolders = parseCsv(options.allowedEditableFolders);
    const tree = readFileTree(repoPath, blockedPatterns, allowedFolders);
    const versionControl = inspectVersionControl(repoPath, requestedVersionControlProvider);
    const warnings = [...tree.warnings];
    if (versionControl.versionControlProvider === "none") {
      warnings.push(
        requestedVersionControlProvider === "plastic"
          ? "Plastic workspace was not detected. Install Unity Version Control CLI (cm) or choose a Plastic workspace."
          : requestedVersionControlProvider === "git"
            ? "Git repository was not detected."
            : "No Git repository or Plastic workspace was detected."
      );
    }
    if (versionControl.dirty) {
      warnings.push("Repository has uncommitted changes.");
    }

    return {
      ok: true,
      message: "Repository inspected.",
      repoPath,
      scannedAt: new Date().toISOString(),
      requestedVersionControlProvider,
      ...versionControl,
      fileTree: tree.fileTree,
      warnings
    };
  });

  ipcMain.handle("repo:switch-branch", async (_event, options) => {
    const repoPath = String(options.repoPath || "");
    const provider = String(options.versionControlProvider || "");
    const branch = String(options.branch || "").trim();
    if (!repoPath || !fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
      return { ok: false, output: "Repo path is not readable." };
    }
    if (!branch) {
      return { ok: false, output: "Branch is required." };
    }

    const result =
      provider === "plastic"
        ? await runCommand("cm", ["switch", `br:${normalizePlasticBranch(branch)}`, `--workspace=${repoPath}`, "--noinput"], repoPath, "", 120000)
        : await runCommand("git", ["-C", repoPath, "checkout", branch], repoPath, "", 120000);

    return {
      ok: result.ok,
      output: [result.stdout, result.stderr].filter(Boolean).join("\n") || (result.ok ? `Switched to ${branch}.` : "Branch switch failed.")
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
    const patchText = sanitizePatchText(String(options.patchText || ""));
    const provider = String(options.versionControlProvider || "git");
    const blockedPatterns = parseCsv(options.blockedFilePatterns);
    const allowedFolders = parseCsv(options.allowedEditableFolders);

    if (!repoPath || !fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
      return { ok: false, output: "Repo path is not readable.", backupPath: "" };
    }

    const touchedFiles = extractPatchFiles(patchText);
    if (touchedFiles.length === 0 || !looksLikeUnifiedPatch(patchText)) {
      return {
        ok: false,
        output: "No valid patch was found. Apply Patch requires a unified diff with file headers such as diff --git, ---/+++, and @@ hunks.",
        backupPath: ""
      };
    }

    const blockedFile = touchedFiles.find(
      (file) => matchesPattern(file, blockedPatterns) || !isAllowedPath(file, allowedFolders)
    );
    if (blockedFile) {
      return { ok: false, output: `${blockedFile} is blocked by workspace safety settings.`, backupPath: "" };
    }

    const backupPath = createPatchBackup(repoPath, touchedFiles);
    if (provider === "plastic") {
      const patchFile = writeTempPatchFile(patchText);
      const apply = await runCommand("cm", ["patch", "--apply", patchFile], repoPath, "", 120000);
      try {
        fs.rmSync(path.dirname(patchFile), { recursive: true, force: true });
      } catch {
        // Best effort cleanup only.
      }

      return {
        ok: apply.ok,
        output:
          [apply.stdout, apply.stderr].filter(Boolean).join("\n") ||
          (apply.ok
            ? "Plastic patch applied."
            : "Plastic patch apply failed. Make sure Unity Version Control CLI and GNU patch are available in PATH."),
        backupPath
      };
    }

    const check = await runCommand("git", ["-C", repoPath, "apply", "--check", "--recount"], repoPath, patchText, 30000);
    if (!check.ok) {
      return { ok: false, output: check.stderr || check.stdout || "Patch check failed.", backupPath };
    }

    const apply = await runCommand("git", ["-C", repoPath, "apply", "--recount", "--whitespace=fix"], repoPath, patchText, 30000);
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

  ipcMain.handle("repo:commit-changes", async (_event, options) => {
    const repoPath = String(options.repoPath || "");
    const provider = String(options.versionControlProvider || "git");
    const message = String(options.message || "").trim();
    if (!message) {
      return { ok: false, output: "Commit message is required." };
    }

    const result =
      provider === "plastic"
        ? await runCommand("cm", ["checkin", "-c", message, "--all"], repoPath, "", 120000)
        : await runCommand("git", ["-C", repoPath, "add", "-A"], repoPath, "", 30000).then(async (add) =>
            add.ok ? runCommand("git", ["-C", repoPath, "commit", "-m", message], repoPath, "", 30000) : add
          );

    return {
      ok: result.ok,
      output: [result.stdout, result.stderr].filter(Boolean).join("\n") || (result.ok ? "Changes committed." : "Commit failed.")
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

  ipcMain.handle("repo:rollback-files", async (_event, options) => {
    const repoPath = String(options.repoPath || "");
    const provider = String(options.versionControlProvider || "git");
    const files = String(options.files || "")
      .split(",")
      .map((file) => file.trim())
      .filter(Boolean);

    if (files.length === 0) {
      return { ok: false, output: "No files configured for rollback." };
    }

    const result =
      provider === "plastic"
        ? await runCommand("cm", ["undo", ...files], repoPath, "", 30000)
        : await runCommand("git", ["-C", repoPath, "checkout", "--", ...files], repoPath, "", 30000);

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
    if (line.startsWith("Index: ")) {
      cleanPatchPath(line.slice("Index: ".length))?.forEach((file) => files.add(file));
    }
    if (line.startsWith("diff --git ")) {
      const parts = line.trim().split(/\s+/);
      cleanPatchPath(parts[3] || parts[2])?.forEach((file) => files.add(file));
    }
    if (line.startsWith("+++ b/")) {
      files.add(line.slice("+++ b/".length).trim());
    } else if (line.startsWith("+++ ")) {
      cleanPatchPath(line.slice("+++ ".length))?.forEach((file) => files.add(file));
    }
    if (line.startsWith("--- a/")) {
      files.add(line.slice("--- a/".length).trim());
    } else if (line.startsWith("--- ")) {
      cleanPatchPath(line.slice("--- ".length))?.forEach((file) => files.add(file));
    }
  }
  return Array.from(files).filter((file) => file && file !== "/dev/null");
};

const cleanPatchPath = (value) => {
  const clean = String(value || "")
    .trim()
    .replace(/^"|"$/g, "")
    .split(/\t|\s+\d{4}-\d{2}-\d{2}/)[0]
    .trim();
  if (!clean || clean === "/dev/null") {
    return [];
  }
  return [clean.replace(/^[ab]\//, "")];
};

const looksLikeUnifiedPatch = (patchText) =>
  /(^|\n)(diff --git |Index: |--- )/.test(patchText) && /(^|\n)\+\+\+ /.test(patchText) && /(^|\n)@@ /.test(patchText);

const sanitizePatchText = (patchText) => sanitizePatchLines(String(patchText || "").split(/\r?\n/)).join("\n").trim() + "\n";

const sanitizePatchLines = (lines) => {
  const firstPatchLine = lines.findIndex(
    (line) => line.startsWith("diff --git ") || line.startsWith("--- ") || line.startsWith("Index: ")
  );
  if (firstPatchLine < 0) {
    return [];
  }

  const patchLines = [];
  let inHunk = false;
  let oldTarget = 0;
  let newTarget = 0;
  let oldCount = 0;
  let newCount = 0;

  for (const line of lines.slice(firstPatchLine)) {
    if (line.startsWith("```")) {
      break;
    }

    if (isPatchHeaderLine(line)) {
      inHunk = false;
      patchLines.push(line);
      continue;
    }

    if (line.startsWith("@@ ")) {
      const counts = parseHunkCounts(line);
      inHunk = true;
      oldTarget = counts.oldCount;
      newTarget = counts.newCount;
      oldCount = 0;
      newCount = 0;
      patchLines.push(line);
      continue;
    }

    if (!inHunk) {
      if (line.trim() === "") {
        continue;
      }
      break;
    }

    const normalizedLine = line === "" ? " " : /^[ +\-\\]/.test(line) ? line : ` ${line}`;
    if (normalizedLine.startsWith("\\ ")) {
      patchLines.push(normalizedLine);
      continue;
    }
    if (!normalizedLine.startsWith("+")) {
      oldCount += 1;
    }
    if (!normalizedLine.startsWith("-")) {
      newCount += 1;
    }
    patchLines.push(normalizedLine);
    if (oldCount >= oldTarget && newCount >= newTarget) {
      inHunk = false;
    }
  }

  return patchLines;
};

const isPatchHeaderLine = (line) =>
  line.startsWith("diff --git ") ||
  line.startsWith("Index: ") ||
  line.startsWith("====") ||
  line.startsWith("index ") ||
  line.startsWith("--- ") ||
  line.startsWith("+++ ") ||
  line.startsWith("new file mode ") ||
  line.startsWith("deleted file mode ") ||
  line.startsWith("old mode ") ||
  line.startsWith("new mode ") ||
  line.startsWith("similarity index ") ||
  line.startsWith("rename from ") ||
  line.startsWith("rename to ") ||
  line.startsWith("copy from ") ||
  line.startsWith("copy to ");

const parseHunkCounts = (line) => {
  const match = line.match(/^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/);
  return {
    oldCount: Number.parseInt(match?.[1] ?? "1", 10),
    newCount: Number.parseInt(match?.[2] ?? "1", 10)
  };
};

const writeTempPatchFile = (patchText) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-agent-patch-"));
  const patchFile = path.join(directory, "changes.patch");
  fs.writeFileSync(patchFile, patchText, "utf8");
  return patchFile;
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

const activeProviderProcesses = new Map();
const providerResolutionCache = new Map();

const uniqueExistingDirs = (dirs) => {
  const seen = new Set();
  return dirs
    .filter(Boolean)
    .map((dir) => path.normalize(dir))
    .filter((dir) => {
      const key = dir.toLowerCase();
      if (seen.has(key) || !fs.existsSync(dir)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const existingClaudeDirs = () => {
  const root = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".claude") : "";
  if (!root || !fs.existsSync(root)) {
    return [];
  }

  return uniqueExistingDirs([
    root,
    path.join(root, "bin"),
    path.join(root, "local"),
    path.join(root, "local", "bin"),
    path.join(root, "local", "node_modules", ".bin")
  ]);
};

const extraExecutableDirs = () =>
  uniqueExistingDirs([
    process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32") : "",
    process.env.windir ? path.join(process.env.windir, "System32") : "",
    process.env.APPDATA ? path.join(process.env.APPDATA, "npm") : "",
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Microsoft", "WindowsApps") : "",
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "nodejs") : "",
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "AppData", "Roaming", "npm") : "",
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".cargo", "bin") : "",
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".local", "bin") : "",
    process.env.HOME ? path.join(process.env.HOME, ".npm-global", "bin") : "",
    process.env.HOME ? path.join(process.env.HOME, ".local", "bin") : "",
    process.env.HOME ? path.join(process.env.HOME, ".cargo", "bin") : "",
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    ...existingClaudeDirs(),
    "C:\\Program Files\\nodejs",
    "C:\\Program Files\\PlasticSCM5\\client",
    "C:\\Program Files\\Unity Version Control\\client"
  ]);

const parseEnvironmentVariables = (value) => {
  if (!value) {
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [String(key).trim(), String(item)])
        .filter(([key]) => Boolean(key))
    );
  }

  const parsed = {};
  for (const line of String(value).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    parsed[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1);
  }
  return parsed;
};

const commandEnvironment = (environmentVariables) => {
  const currentPath = process.env.PATH || process.env.Path || "";
  const pathParts = [...extraExecutableDirs(), ...currentPath.split(path.delimiter).filter(Boolean)];
  const nextPath = uniqueExistingDirs(pathParts).join(path.delimiter);
  return {
    ...process.env,
    ...parseEnvironmentVariables(environmentVariables),
    PATH: nextPath,
    Path: nextPath
  };
};

const stripWrappingQuotes = (value) => {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const commandHasPath = (command) => command.includes("\\") || command.includes("/") || path.isAbsolute(command);

const executableCandidates = (command) => {
  const clean = stripWrappingQuotes(command);
  if (process.platform !== "win32" || path.extname(clean)) {
    return [clean];
  }

  return [clean, `${clean}.cmd`, `${clean}.exe`, `${clean}.bat`, `${clean}.ps1`];
};

const isRunnableFile = (candidate) => {
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
};

const normalizeCacheKey = (command, env) => {
  const pathValue = env.PATH || env.Path || "";
  return `${process.platform}:${stripWrappingQuotes(command).toLowerCase()}:${pathValue}`;
};

const systemLookupExecutable = (command, env) => {
  const clean = stripWrappingQuotes(command);
  if (!clean || commandHasPath(clean)) {
    return [];
  }

  try {
    const lookupCommand = process.platform === "win32" ? "where" : "which";
    return execFileSync(lookupCommand, [clean], {
      encoding: "utf8",
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"]
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((candidate, index, candidates) => candidates.indexOf(candidate) === index);
  } catch {
    return [];
  }
};

const resolveExecutable = (command, env) => {
  const clean = stripWrappingQuotes(command);
  const cacheKey = normalizeCacheKey(clean, env);
  if (providerResolutionCache.has(cacheKey)) {
    return providerResolutionCache.get(cacheKey);
  }

  const pathValue = env.PATH || env.Path || "";
  const pathDirs = pathValue.split(path.delimiter).filter(Boolean);

  if (commandHasPath(clean)) {
    const resolvedCandidates = executableCandidates(clean);
    const found = resolvedCandidates.find((candidate) => isRunnableFile(candidate));
    const result = {
      command: found || clean,
      found: Boolean(found),
      searched: resolvedCandidates,
      source: found ? "explicit" : "missing"
    };
    if (result.found) {
      providerResolutionCache.set(cacheKey, result);
    }
    return result;
  }

  const systemMatches = systemLookupExecutable(clean, env);
  const systemFound = systemMatches.find((candidate) => isRunnableFile(candidate));
  if (systemFound) {
    const result = {
      command: systemFound,
      found: true,
      searched: systemMatches,
      source: process.platform === "win32" ? "where" : "which"
    };
    providerResolutionCache.set(cacheKey, result);
    return result;
  }

  const searched = [...systemMatches];
  for (const dir of pathDirs) {
    for (const candidate of executableCandidates(clean)) {
      const absoluteCandidate = path.join(dir, candidate);
      searched.push(absoluteCandidate);
      if (isRunnableFile(absoluteCandidate)) {
        const result = {
          command: absoluteCandidate,
          found: true,
          searched,
          source: "path"
        };
        providerResolutionCache.set(cacheKey, result);
        return result;
      }
    }
  }

  const result = {
    command: clean,
    found: false,
    searched,
    source: "missing"
  };
  return result;
};

const prepareCommandInvocation = (command, args) => {
  const extension = path.extname(command).toLowerCase();
  if (process.platform === "win32" && extension === ".ps1") {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", command, ...args],
      shell: false
    };
  }

  return {
    command,
    args,
    shell: process.platform === "win32" && [".cmd", ".bat"].includes(extension)
  };
};

const installHintForCommand = (command) => {
  const clean = stripWrappingQuotes(command).toLowerCase();
  if (clean.includes("claude")) {
    return "npm install -g @anthropic-ai/claude-code";
  }
  if (clean.includes("codex")) {
    return "npm install -g @openai/codex";
  }
  return "Install the CLI, then confirm it is available on PATH.";
};

const commandNotFoundMessage = (command, searched) => {
  const searchedPreview = searched.slice(0, 8).join("\n");
  const more = searched.length > 8 ? `\n...and ${searched.length - 8} more PATH entries.` : "";
  return [
    `${displayNameForCommand(command)} command not found.`,
    "",
    `Suggested install:\n${installHintForCommand(command)}`,
    "",
    "On Windows npm global CLIs are often under %APPDATA%\\npm, for example C:\\Users\\<you>\\AppData\\Roaming\\npm\\claude.cmd.",
    "You can also set Settings > CLI Agents > Resolved executable path to a real executable file.",
    searchedPreview ? `Possible detected paths:\n${searchedPreview}${more}` : ""
  ]
    .filter(Boolean)
    .join("\n");
};

const displayNameForCommand = (command) => {
  const clean = stripWrappingQuotes(command);
  if (clean.toLowerCase().includes("claude")) return "Claude";
  if (clean.toLowerCase().includes("codex")) return "Codex";
  return clean || "CLI";
};

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

const isCmdWrapper = (command) => {
  const base = path.basename(stripWrappingQuotes(command)).toLowerCase();
  return process.platform === "win32" && (base === "cmd" || base === "cmd.exe");
};

const isPosixShellWrapper = (command) => {
  const base = path.basename(stripWrappingQuotes(command)).toLowerCase();
  return process.platform !== "win32" && ["sh", "bash", "zsh"].includes(base);
};

const extractShellTarget = (command, args) => {
  if (isCmdWrapper(command)) {
    const markerIndex = args.findIndex((arg) => arg.toLowerCase() === "/c");
    if (markerIndex >= 0 && args[markerIndex + 1]) {
      return { command: args[markerIndex + 1], index: markerIndex + 1 };
    }
  }

  if (isPosixShellWrapper(command)) {
    const markerIndex = args.findIndex((arg) => arg === "-c");
    if (markerIndex >= 0 && args[markerIndex + 1]) {
      const [target] = splitArgs(args[markerIndex + 1]);
      return target ? { command: target, index: markerIndex + 1, inline: true } : null;
    }
  }

  return null;
};

const hasShellControlOperator = (value) => /(^|[\s])(&&?|\|\|?|[<>]|;)([\s]|$)/.test(String(value));

const parseArgs = (args) => (Array.isArray(args) ? args.map(String) : splitArgs(args));

const createProviderInvocation = (options) => {
  const env = commandEnvironment(options.environmentVariables);
  const args = parseArgs(options.args);
  const command = String(options.command || "").trim();
  const explicitPath = stripWrappingQuotes(options.resolvedExecutablePath || "");

  if (!command) {
    return { ok: false, stderr: "CLI command is required.", env, searched: [] };
  }

  const shellTarget = extractShellTarget(command, args);
  let executable = resolveExecutable(command, env);
  let targetResolution = null;
  const invocationArgs = [...args];

  if (shellTarget) {
    const shellPayload = shellTarget.inline ? invocationArgs[shellTarget.index] : invocationArgs.slice(shellTarget.index).join(" ");
    if (hasShellControlOperator(shellPayload)) {
      return {
        ok: false,
        stderr: "CLI shell arguments contain unsupported shell control operators. Configure command and args as structured tokens instead.",
        env,
        executable,
        targetResolution,
        searched: []
      };
    }

    targetResolution =
      explicitPath && isRunnableFile(explicitPath)
        ? { command: explicitPath, found: true, searched: [explicitPath], source: "explicit" }
        : resolveExecutable(shellTarget.command, env);

    if (!targetResolution.found) {
      return {
        ok: false,
        stderr: commandNotFoundMessage(shellTarget.command, targetResolution.searched),
        env,
        executable,
        targetResolution,
        searched: targetResolution.searched
      };
    }

    if (shellTarget.inline) {
      const inlineArgs = splitArgs(invocationArgs[shellTarget.index]);
      inlineArgs[0] = targetResolution.command;
      invocationArgs[shellTarget.index] = inlineArgs.map(quoteShellArg).join(" ");
    } else {
      invocationArgs[shellTarget.index] = targetResolution.command;
    }
  } else if (explicitPath && isRunnableFile(explicitPath)) {
    executable = { command: explicitPath, found: true, searched: [explicitPath], source: "explicit" };
  }

  if (!executable.found) {
    return {
      ok: false,
      stderr: commandNotFoundMessage(command, executable.searched),
      env,
      executable,
      targetResolution,
      searched: executable.searched
    };
  }

  const invocation = prepareCommandInvocation(executable.command, invocationArgs);
  return {
    ok: true,
    command,
    args: invocationArgs,
    env,
    invocation,
    executable,
    targetResolution,
    resolvedExecutablePath: targetResolution?.command || executable.command,
    searched: targetResolution?.searched || executable.searched
  };
};

const quoteShellArg = (value) => {
  const text = String(value);
  if (!/[\s"'&|<>]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll("\"", "\\\"")}"`;
};

const emitProviderOutput = (runId, stream, chunk) => {
  if (!runId) {
    return;
  }
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("cli:output", {
      runId,
      stream,
      chunk,
      timestamp: new Date().toISOString()
    });
  }
};

const runProviderProcess = (options) =>
  new Promise((resolve) => {
    const invocationResult = createProviderInvocation(options);
    if (!invocationResult.ok) {
      resolve({
        ok: false,
        stdout: "",
        stderr: invocationResult.stderr,
        timedOut: false,
        exitCode: null,
        resolvedExecutablePath: "",
        logs: []
      });
      return;
    }

    const cwd = options.cwd || app.getPath("home");
    const child = spawn(invocationResult.invocation.command, invocationResult.invocation.args, {
      cwd,
      shell: invocationResult.invocation.shell,
      windowsHide: true,
      env: invocationResult.env
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let cancelled = false;
    const logs = [
      {
        stream: "system",
        chunk: `Resolved executable: ${invocationResult.resolvedExecutablePath}`,
        timestamp: new Date().toISOString()
      }
    ];

    if (options.runId) {
      activeProviderProcesses.set(options.runId, child);
    }

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      logs.push({ stream: "stdout", chunk: text, timestamp: new Date().toISOString() });
      emitProviderOutput(options.runId, "stdout", text);
      options.onStdout?.(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      logs.push({ stream: "stderr", chunk: text, timestamp: new Date().toISOString() });
      emitProviderOutput(options.runId, "stderr", text);
      options.onStderr?.(text);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      if (options.runId) {
        activeProviderProcesses.delete(options.runId);
      }
      const stderrText =
        error.code === "ENOENT" ? commandNotFoundMessage(options.command, invocationResult.searched) : error.message;
      resolve({
        ok: false,
        stdout,
        stderr: stderrText,
        timedOut,
        cancelled,
        exitCode: null,
        resolvedExecutablePath: invocationResult.resolvedExecutablePath,
        logs
      });
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      if (options.runId) {
        activeProviderProcesses.delete(options.runId);
      }
      cancelled = signal === "SIGTERM" && !timedOut;
      resolve({
        ok: exitCode === 0 && !timedOut && !cancelled,
        stdout,
        stderr: timedOut ? `${stderr}\nCLI command timed out.`.trim() : stderr,
        timedOut,
        cancelled,
        exitCode,
        resolvedExecutablePath: invocationResult.resolvedExecutablePath,
        logs
      });
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();
  });

const runCommand = (command, args, cwd, stdin, timeoutMs) =>
  runProviderProcess({ command, args, cwd, stdin, timeoutMs });

const cancelProviderProcess = (runId) => {
  const child = activeProviderProcesses.get(runId);
  if (!child) {
    return { ok: false, message: "No running CLI process was found for this session." };
  }
  child.kill();
  return { ok: true, message: "CLI process cancellation requested." };
};

const collectVersion = async (options, cwd) => {
  const invocation = createProviderInvocation(options);
  if (!invocation.ok) {
    return "";
  }
  const target = extractShellTarget(options.command, parseArgs(options.args));
  const versionCommand = target ? invocation.resolvedExecutablePath : invocation.executable.command;
  const versionResult = await runProviderProcess({
    command: versionCommand,
    args: ["--version"],
    cwd,
    stdin: "",
    timeoutMs: 10000,
    environmentVariables: options.environmentVariables
  });
  return [versionResult.stdout, versionResult.stderr].filter(Boolean).join("\n").trim().split(/\r?\n/)[0] || "";
};

const validateProviderCommand = async (options) => {
  const command = String(options.command || "").trim();
  const cwd = String(options.cwd || options.workingDirectory || app.getPath("home"));
  const timeoutMs = Math.max(10, Number(options.timeoutSeconds || 60)) * 1000;
  if (!command) {
    return {
      ok: false,
      message: "CLI command is required.",
      resolvedExecutablePath: "",
      version: "",
      stdout: "",
      stderr: "CLI command is required.",
      exitCode: null
    };
  }

  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    return {
      ok: false,
      message: "CLI working directory is not readable.",
      resolvedExecutablePath: "",
      version: "",
      stdout: "",
      stderr: `Working directory not found: ${cwd}`,
      exitCode: null
    };
  }

  const preflight = createProviderInvocation(options);
  if (!preflight.ok) {
    return {
      ok: false,
      message: preflight.stderr,
      resolvedExecutablePath: "",
      version: "",
      stdout: "",
      stderr: preflight.stderr,
      exitCode: null
    };
  }

  const version = await collectVersion(options, cwd);
  const testPrompt = "Reply with OK to confirm stdin and stdout are working.";
  const result = await runProviderProcess({
    ...options,
    cwd,
    stdin: testPrompt,
    timeoutMs,
    runId: `validation-${Date.now()}`
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  const ok = result.ok && Boolean(output);
  const providerName = displayNameForCommand(preflight.targetResolution?.command || preflight.command);

  return {
    ok,
    message: ok
      ? `${providerName} detected successfully`
      : `${providerName} validation failed${result.timedOut ? " after timing out" : ""}.`,
    resolvedExecutablePath: result.resolvedExecutablePath,
    version,
    stdout: result.stdout,
    stderr: result.stderr || (ok ? "" : "Command produced no output."),
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    logs: result.logs
  };
};

const registerCliHandlers = () => {
  ipcMain.handle("cli:run", async (_event, options) => {
    const command = String(options.command || "").trim();
    const prompt = String(options.prompt || "");
    const cwd = String(options.cwd || options.workingDirectory || app.getPath("home"));
    const timeoutMs = Math.max(10, Number(options.timeoutSeconds || 300)) * 1000;

    if (!command) {
      return { ok: false, exitCode: null, stdout: "", stderr: "CLI command is required.", timedOut: false, logs: [] };
    }

    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      return {
        ok: false,
        exitCode: null,
        stdout: "",
        stderr: "CLI working directory is not readable.",
        timedOut: false,
        logs: []
      };
    }

    const maxOutput = 180000;
    const trimOutput = (value) => (value.length > maxOutput ? value.slice(value.length - maxOutput) : value);
    let stdout = "";
    let stderr = "";

    const result = await runProviderProcess({
      command,
      args: options.args,
      cwd,
      stdin: prompt,
      timeoutMs,
      runId: String(options.runId || ""),
      environmentVariables: options.environmentVariables,
      resolvedExecutablePath: options.resolvedExecutablePath,
      onStdout: (chunk) => {
        stdout = trimOutput(stdout + chunk);
      },
      onStderr: (chunk) => {
        stderr = trimOutput(stderr + chunk);
      }
    });

    return {
      ...result,
      stdout: stdout || result.stdout,
      stderr: stderr || result.stderr
    };
  });

  ipcMain.handle("cli:cancel", async (_event, options) => cancelProviderProcess(String(options.runId || "")));

  ipcMain.handle("cli:test", async (_event, options) => validateProviderCommand(options));
};

const createWindow = () => {
  const appIcon = path.join(__dirname, "../build/icon.ico");
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 720,
    title: "kanban-agent",
    backgroundColor: "#0b0f14",
    icon: appIcon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
    return;
  }

  win.loadFile(path.join(__dirname, "../dist/index.html"));
};

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerSecureKeyHandlers();
  registerUpdateHandlers();
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
