import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("desktop renderer is fully local and exposes only the narrow preload API", async () => {
  const [index, preload, storage] = await Promise.all([
    readFile(new URL("desktop/index.html", root), "utf8"),
    readFile(new URL("desktop/electron/preload.cjs", root), "utf8"),
    readFile(new URL("app/storage.ts", root), "utf8"),
  ]);

  assert.match(index, /connect-src 'none'/);
  assert.match(preload, /contextBridge\.exposeInMainWorld/);
  assert.match(preload, /loadWorkspace/);
  assert.match(preload, /saveWorkspace/);
  assert.match(preload, /getSaveInfo/);
  assert.match(preload, /openSaveFolder/);
  assert.doesNotMatch(preload, /exposeInMainWorld\([^)]*ipcRenderer/s);
  assert.match(storage, /window\.akisDesktop\.loadWorkspace/);
  assert.match(storage, /window\.akisDesktop\.saveWorkspace/);
});

test("desktop main process writes verified atomic saves and recovers from safe copies", async () => {
  const main = await readFile(new URL("desktop/electron/main.cjs", root), "utf8");

  assert.match(main, /app\.getPath\("documents"\)/);
  assert.match(main, /"Akış", "Save"/);
  assert.match(main, /workspace\.tmp\.akis\.json/);
  assert.match(main, /workspace\.previous\.akis\.json/);
  assert.match(main, /handle\.sync\(\)/);
  assert.match(main, /sha256:/);
  assert.match(main, /SAVE_VERIFICATION_FAILED/);
  assert.match(main, /requestSingleInstanceLock/);
  assert.match(main, /saveQueue\.finally/);
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /assertTrustedFrame/);
});

test("Windows installer creates shortcuts without deleting user saves on uninstall", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));

  assert.equal(packageJson.main, "desktop/electron/main.cjs");
  assert.equal(packageJson.build.productName, "Akış");
  assert.equal(packageJson.build.nsis.createDesktopShortcut, "always");
  assert.equal(packageJson.build.nsis.createStartMenuShortcut, true);
  assert.equal(packageJson.build.nsis.deleteAppDataOnUninstall, false);
  assert.match(packageJson.scripts["desktop:dist"], /electron-builder/);
});
