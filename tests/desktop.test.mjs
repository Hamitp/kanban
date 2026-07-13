import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Tauri renderer is local, permits packaged assets and exposes only the required IPC surface", async () => {
  const [index, storage, capability, tauriText, reportSource] = await Promise.all([
    readFile(new URL("desktop/index.html", root), "utf8"),
    readFile(new URL("app/storage.ts", root), "utf8"),
    readFile(new URL("src-tauri/capabilities/main-workspace.json", root), "utf8"),
    readFile(new URL("src-tauri/tauri.conf.json", root), "utf8"),
    readFile(new URL("app/problemReports.ts", root), "utf8"),
  ]);

  assert.match(index, /default-src 'self'/);
  assert.match(index, /connect-src 'self' ipc: http:\/\/ipc\.localhost/);
  assert.doesNotMatch(index, /https:\/\//);
  assert.match(JSON.parse(tauriText).app.security.csp, /connect-src 'self' ipc: http:\/\/ipc\.localhost/);
  assert.match(reportSource, /new URL\("\.\.\/public\/fonts\/Vera\.ttf", import\.meta\.url\)/);
  assert.match(reportSource, /PDF_FONT_ASSET_UNAVAILABLE/);
  assert.match(storage, /invoke<TauriLoadResult>\("load"\)/);
  assert.match(storage, /invoke\("save", \{ data: normalized \}\)/);
  assert.match(storage, /WORKSPACE_RECOVERY_REQUIRED/);
  assert.match(storage, /WORKSPACE_DEEP_VALIDATION_FAILED/);

  const parsedCapability = JSON.parse(capability);
  assert.deepEqual(parsedCapability.windows, ["main"]);
  assert.ok(parsedCapability.permissions.includes("allow-load"));
  assert.ok(parsedCapability.permissions.includes("allow-save"));
  assert.ok(parsedCapability.permissions.includes("allow-info"));
  assert.ok(parsedCapability.permissions.includes("allow-open-save-folder"));
  assert.ok(parsedCapability.permissions.includes("core:window:allow-destroy"));
});

test("Rust persistence keeps the established Save format and recovery chain", async () => {
  const [rustStorage, rustApp] = await Promise.all([
    readFile(new URL("src-tauri/src/storage.rs", root), "utf8"),
    readFile(new URL("src-tauri/src/lib.rs", root), "utf8"),
  ]);

  assert.match(rustStorage, /"Akış"/);
  assert.match(rustStorage, /"Save"/);
  assert.match(rustStorage, /workspace\.akis\.json/);
  assert.match(rustStorage, /workspace\.previous\.akis\.json/);
  assert.match(rustStorage, /workspace\.tmp\.akis\.json/);
  assert.match(rustStorage, /sha256:/);
  assert.match(rustStorage, /sync_all\(\)/);
  assert.match(rustStorage, /MoveFileExW/);
  assert.match(rustStorage, /Recovery/);
  assert.match(rustStorage, /MAX_BACKUPS: usize = 60/);
  assert.match(rustApp, /tauri_plugin_single_instance/);
});

test("Windows distribution uses a compact current-user NSIS installer", async () => {
  const [packageText, tauriText, mainText] = await Promise.all([
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("src-tauri/tauri.conf.json", root), "utf8"),
    readFile(new URL("src-tauri/src/main.rs", root), "utf8"),
  ]);
  const packageJson = JSON.parse(packageText);
  const tauri = JSON.parse(tauriText);

  assert.equal(packageJson.version, tauri.version);
  assert.match(packageJson.scripts["desktop:dist"], /tauri build/);
  assert.equal(packageJson.dependencies.electron, undefined);
  assert.deepEqual(tauri.bundle.targets, ["nsis"]);
  assert.equal(tauri.bundle.windows.nsis.installMode, "currentUser");
  assert.equal(tauri.identifier, "com.hamitparlak.akis");
  assert.equal(tauri.app.windows[0].dragDropEnabled, false);
  assert.match(mainText, /windows_subsystem = "windows"/);
});
