const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({ width: 1400, height: 900, minWidth: 900, minHeight: 600, backgroundColor: "#0b0e17", title: "Esports Manager — CEO Edition", autoHideMenuBar: true });
  win.loadFile(path.join(__dirname, "index.html"));
});
app.on("window-all-closed", () => app.quit());
