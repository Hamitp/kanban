# Akış / Flow — Windows Installation Guide

This guide is for end users. You do not need coding experience or developer tools.

## Install for the first time

1. Open the [latest Akış release](https://github.com/Hamitp/kanban/releases/latest).
2. Scroll to **Assets**. Do not use the “Source code” ZIP files; they contain development source, not the ready-to-use app.
3. Download the file named `Akis-Setup-...-x64.exe`.
4. Double-click the downloaded file and follow the installer.
5. Open **Akış** from its desktop shortcut or the Windows Start menu.
6. On the first screen, choose **English** or **Türkçe**. You can change this later under **Settings → Language and region**.

If Windows SmartScreen appears, verify that the file came from `github.com/Hamitp/kanban`, choose **More info**, then **Run anyway**. Akış is open source, but its installer may not yet have a commercial code-signing certificate.

## Where your work is saved

Akış saves automatically. You do not need to press Save, run PowerShell, or create manual backups.

```text
Documents\Akış\Save\workspace.akis.json
```

Hourly safety copies are stored in:

```text
Documents\Akış\Save\Backups
```

The latest 60 valid copies are retained. Installing an update or uninstalling Akış does not remove this Save folder.

## Update Akış

1. Close Akış.
2. Download the newest setup file from the [latest release](https://github.com/Hamitp/kanban/releases/latest).
3. Run it normally. It replaces the program files while preserving your Save folder.
4. Open Akış and confirm that your projects are present.

## Move to another computer

1. Install Akış on the new computer using the steps above.
2. Close Akış on both computers.
3. Copy the entire `Documents\Akış\Save` folder from the old computer.
4. Replace the new computer's `Documents\Akış\Save` folder with that copy.
5. Open Akış. Your workspaces, projects, boards, mind maps, people, and finance records should appear.

Keep the copied Save folder until you have confirmed everything on the new computer.

## Currency behavior

Each project can use TRY, USD, EUR, or GBP independently. The default for new projects is selected in Settings. Akış does not invent exchange rates, so dashboard amounts in different currencies remain separate. A project's currency is locked after its first payment record to protect financial history.

## Troubleshooting

- If the app does not open, restart Windows and try the Start menu shortcut.
- If a black command window opens, make sure you installed the release setup file rather than launching a development script.
- If data looks missing, stop using the app and inspect `Documents\Akış\Save`; do not overwrite or delete it.
- For a reproducible problem, open an issue in the [GitHub repository](https://github.com/Hamitp/kanban/issues) and include your Akış version and Windows version. Do not attach your Save file if it contains private or financial information.
