// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Save calendar rules
    saveCalendar: (data, message) => ipcRenderer.invoke('save-calendar-rules', data, message),

    // Ask main to prepare repo and send calendar
    readyToReceive: () => ipcRenderer.invoke('renderer-ready'),

    // Listen for repo synced
    onRepoSynced: (callback) => ipcRenderer.on('repo-synced', (event, data) => callback(data)),

    // Listen for repo errors
    onRepoSyncError: (callback) => ipcRenderer.on('repo-sync-error', (event, msg) => callback(msg)),

    // Listen for repo loading messages
    onRepoLoading: (callback) => ipcRenderer.on('repo-loading', (event, msg) => callback(msg)),

    // Send logs to main (optional)
    logMessage: (msg) => ipcRenderer.invoke('log-message', msg)
});
