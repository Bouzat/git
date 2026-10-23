// pont vers le processus principal : seule la recherche de sauvegardes est exposée à la page
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("emDesktop", { scanSaves: () => ipcRenderer.invoke("scan-saves") });
