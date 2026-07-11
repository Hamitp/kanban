/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const APP_ID = "com.hamitparlak.akis";
const BACKUP_INTERVAL_MS = 60 * 60 * 1000;
const MAX_BACKUPS = 60;
const MAX_WORKSPACE_BYTES = 50 * 1024 * 1024;

let mainWindow;
let saveQueue = Promise.resolve();
let latestRevision = 0;
let quitAfterSaves = false;

function storagePaths() {
  const saveDirectory = path.join(app.getPath("documents"), "Akış", "Save");
  return {
    saveDirectory,
    backupDirectory: path.join(saveDirectory, "Backups"),
    recoveryDirectory: path.join(saveDirectory, "Recovery"),
    dataFile: path.join(saveDirectory, "workspace.akis.json"),
    previousFile: path.join(saveDirectory, "workspace.previous.akis.json"),
    temporaryFile: path.join(saveDirectory, "workspace.tmp.akis.json"),
  };
}

function validateWorkspace(data) {
  return (
    data &&
    typeof data === "object" &&
    data.version === 1 &&
    Array.isArray(data.projects) &&
    Array.isArray(data.boards) &&
    Array.isArray(data.mindMaps) &&
    Array.isArray(data.members) &&
    Array.isArray(data.labels)
  );
}

function checksum(data) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex")}`;
}

function assertTrustedFrame(event) {
  if (!mainWindow || event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error("UNTRUSTED_FRAME");
  }
}

async function ensureDirectories() {
  const { saveDirectory, backupDirectory, recoveryDirectory } = storagePaths();
  await fs.mkdir(saveDirectory, { recursive: true });
  await fs.mkdir(backupDirectory, { recursive: true });
  await fs.mkdir(recoveryDirectory, { recursive: true });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readWorkspaceFile(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    if (Buffer.byteLength(text, "utf8") > MAX_WORKSPACE_BYTES) return null;
    const payload = JSON.parse(text);
    const data = payload?.data ?? payload;
    if (!validateWorkspace(data)) return null;
    if (payload?.checksum && payload.checksum !== checksum(data)) return null;
    return {
      data,
      revision: Number.isSafeInteger(payload?.revision) ? payload.revision : 0,
      savedAt: typeof payload?.savedAt === "string" ? payload.savedAt : undefined,
      filePath,
    };
  } catch {
    return null;
  }
}

async function listBackups() {
  const { backupDirectory } = storagePaths();
  try {
    const entries = await fs.readdir(backupDirectory, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const filePath = path.join(backupDirectory, entry.name);
          const stat = await fs.stat(filePath);
          return { filePath, mtimeMs: stat.mtimeMs };
        }),
    );
    return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function createBackupIfDue(currentRecord) {
  if (!currentRecord) return;
  const { backupDirectory } = storagePaths();
  const backups = await listBackups();
  if (backups[0] && Date.now() - backups[0].mtimeMs < BACKUP_INTERVAL_MS) return;

  const newestRecord = backups[0] ? await readWorkspaceFile(backups[0].filePath) : null;
  if (newestRecord && checksum(newestRecord.data) === checksum(currentRecord.data)) return;

  const backupFile = path.join(backupDirectory, `akis-otomatik-${timestamp()}.akis.json`);
  await fs.copyFile(currentRecord.filePath, backupFile);
  const refreshed = await listBackups();
  await Promise.all(refreshed.slice(MAX_BACKUPS).map((entry) => fs.rm(entry.filePath, { force: true })));
}

async function replaceFileWithRetry(source, destination) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await fs.rename(source, destination);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 0 && ["EEXIST", "EPERM", "EACCES"].includes(error?.code)) {
        await fs.rm(destination, { force: true });
      }
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function writeWorkspace(data) {
  if (!validateWorkspace(data)) throw new Error("INVALID_WORKSPACE");
  const serializedData = JSON.stringify(data);
  if (Buffer.byteLength(serializedData, "utf8") > MAX_WORKSPACE_BYTES) {
    throw new Error("WORKSPACE_TOO_LARGE");
  }

  await ensureDirectories();
  const { dataFile, previousFile, temporaryFile, saveDirectory, backupDirectory } = storagePaths();
  const currentRecord = await readWorkspaceFile(dataFile);
  if (currentRecord) await createBackupIfDue(currentRecord);

  const revision = Math.max(latestRevision, currentRecord?.revision ?? 0) + 1;
  const payload = JSON.stringify(
    {
      format: "akis-workspace",
      formatVersion: 1,
      revision,
      savedAt: new Date().toISOString(),
      checksum: checksum(data),
      data,
    },
    null,
    2,
  );

  const handle = await fs.open(temporaryFile, "w");
  try {
    await handle.writeFile(payload, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  const verified = await readWorkspaceFile(temporaryFile);
  if (!verified || verified.revision !== revision) {
    await fs.rm(temporaryFile, { force: true });
    throw new Error("SAVE_VERIFICATION_FAILED");
  }

  if (currentRecord) await fs.copyFile(dataFile, previousFile);
  await replaceFileWithRetry(temporaryFile, dataFile);
  latestRevision = revision;

  return {
    savedAt: verified.savedAt,
    saveDirectory,
    dataFile,
    backupDirectory,
    automaticBackups: true,
    isDesktop: true,
  };
}

async function quarantineCorruptPrimary() {
  const { dataFile, recoveryDirectory } = storagePaths();
  if (!(await exists(dataFile))) return;
  await fs.copyFile(dataFile, path.join(recoveryDirectory, `workspace-bozuk-${timestamp()}.akis.json`));
}

async function loadWorkspace() {
  await ensureDirectories();
  const { dataFile, previousFile } = storagePaths();
  const primaryExists = await exists(dataFile);
  const primary = await readWorkspaceFile(dataFile);
  if (primary) {
    latestRevision = primary.revision;
    return primary.data;
  }

  const previousExists = await exists(previousFile);
  if (primaryExists) await quarantineCorruptPrimary();
  const previous = await readWorkspaceFile(previousFile);
  if (previous) {
    latestRevision = previous.revision;
    return previous.data;
  }

  const backups = await listBackups();
  for (const backup of backups) {
    const recovered = await readWorkspaceFile(backup.filePath);
    if (recovered) {
      latestRevision = recovered.revision;
      return recovered.data;
    }
  }

  if (primaryExists || previousExists || backups.length) throw new Error("WORKSPACE_RECOVERY_REQUIRED");
  return null;
}

function registerIpc() {
  ipcMain.handle("workspace:load", (event) => {
    assertTrustedFrame(event);
    return loadWorkspace();
  });
  ipcMain.handle("workspace:save", (event, data) => {
    assertTrustedFrame(event);
    const operation = saveQueue.then(() => writeWorkspace(data));
    saveQueue = operation.catch(() => undefined);
    return operation;
  });
  ipcMain.handle("workspace:info", async (event) => {
    assertTrustedFrame(event);
    await ensureDirectories();
    const { saveDirectory, backupDirectory, dataFile } = storagePaths();
    return { isDesktop: true, saveDirectory, backupDirectory, dataFile, automaticBackups: true };
  });
  ipcMain.handle("workspace:open-folder", async (event) => {
    assertTrustedFrame(event);
    await ensureDirectories();
    return shell.openPath(storagePaths().saveDirectory);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f5f4f0",
    title: "Akış",
    icon: path.join(app.getAppPath(), "desktop", "resources", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const appPage = path.join(app.getAppPath(), "desktop-dist", "index.html");
  mainWindow.loadFile(appPage);
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== pathToFileURL(appPage).href) event.preventDefault();
  });
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    registerIpc();
    createWindow();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on("before-quit", (event) => {
    if (quitAfterSaves) return;
    event.preventDefault();
    saveQueue.finally(() => {
      quitAfterSaves = true;
      app.quit();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
