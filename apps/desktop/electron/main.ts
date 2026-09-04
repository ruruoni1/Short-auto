import {app, BrowserWindow} from "electron";
import {join} from "node:path";

const createWindow = async (): Promise<void> => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {contextIsolation: true, sandbox: true},
  });
  const developmentUrl = process.env["NIHON_ZUPZUP_DEV_URL"] ?? "http://127.0.0.1:5173";
  if (!app.isPackaged) await window.loadURL(developmentUrl);
  else await window.loadFile(join(app.getAppPath(), "dist-renderer", "index.html"));
};

app.whenReady().then(async () => {
  await createWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
