const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const { scanProfile } = require("./recover");
// recherche de sauvegardes perdues : le profil de l'application et ceux des noms qu'elle a pu porter
ipcMain.handle("scan-saves", () => {
  const roots = new Set([app.getPath("userData")]);
  for (const n of ["Esports Manager", "esports-manager", "EsportsManager", "Electron"]) roots.add(path.join(app.getPath("appData"), n));
  const out = [];
  for (const r of roots) for (const s of scanProfile(r)) out.push({ from: r, raw: s });
  return out;
});
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({ width: 1400, height: 900, minWidth: 900, minHeight: 600, backgroundColor: "#0b0e17", title: "Esports Manager — CEO Edition", autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js") } });
  win.loadFile(path.join(__dirname, "index.html"));
});
app.on("window-all-closed", () => app.quit());
