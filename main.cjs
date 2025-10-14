const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const simpleGit = require('simple-git');

let win;

const repoPath = path.join(app.getPath('userData'), 'clinicaGynebe');
const repoSSH = 'git@github.com:gynebe/gynebe.github.io.git';
const logFile = path.join(app.getPath('userData'), 'log.txt');

// ---------------------
// Logging
// ---------------------
async function log(message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    console.log(line.trim());
    await fs.appendFile(logFile, line);
}

ipcMain.handle('log-message', async (event, message) => {
    await log(`[RENDERER] ${message}`);
});

// ---------------------
// Create window
// ---------------------
function createWindow() {
    win = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile(path.join(__dirname, 'index.html'));
}

// ---------------------
// Clone or pull repo
// ---------------------
async function prepareRepo() {
    try {
        // Tell renderer to show loading overlay
        win.webContents.send('repo-loading', 'Checking repository...');

        if (!(await fs.pathExists(repoPath))) {
            await log(`Repository not found. Cloning from ${repoSSH}...`);
            win.webContents.send('repo-loading', 'Cloning repository...');
            await simpleGit().clone(repoSSH, repoPath);
            await log('Repository cloned.');
        } else {
            win.webContents.send('repo-loading', 'Pulling latest updates...');
            await simpleGit(repoPath).pull();
            await log('Repository updated.');
        }

        // Ensure calendar file exists
        const calendarFile = path.join(repoPath, 'calendar-rules.json');
        if (!(await fs.pathExists(calendarFile))) {
            await fs.writeJson(calendarFile, { holidays: {}, holidaysMessage: "Estamos de férias!" }, { spaces: 4 });
            await log('calendar-rules.json created.');
        }

        // Send calendar to renderer
        const data = await fs.readJson(calendarFile);
        win.webContents.send('repo-synced', data);
    } catch (err) {
        await log(`Error preparing repo: ${err.message}`);
        win.webContents.send('repo-sync-error', err.message);
    }
}

// ---------------------
// Renderer ready
// ---------------------
ipcMain.handle('renderer-ready', async () => {
    await prepareRepo();
});

// ---------------------
// Save calendar rules
// ---------------------
ipcMain.handle('save-calendar-rules', async (event, calendarData, commitMessage = 'Update calendar') => {
    try {
        const calendarFile = path.join(repoPath, 'calendar-rules.json');
        const bundleFile = path.join(repoPath, 'js', 'bundle.js');
        const repoGit = simpleGit(repoPath);

        await fs.writeJson(calendarFile, calendarData, { spaces: 4 });
        await log('calendar-rules.json updated');

        // Update version number if found
        let bundleContent = await fs.readFile(bundleFile, 'utf8');
        const versionRegex = /we\s*=\s*["'](\d+\.\d+\.\d+)["']/;
        const match = bundleContent.match(versionRegex);
        if (match) {
            const oldVersion = match[1];
            const newVersion = bumpPatchVersion(oldVersion);
            bundleContent = bundleContent.replace(versionRegex, `we="${newVersion}"`);
            await fs.writeFile(bundleFile, bundleContent, 'utf8');
            await log(`Version updated in bundle.js: ${oldVersion} → ${newVersion}`);
        }

        await repoGit.add(['calendar-rules.json', 'js/bundle.js']);
        await repoGit.commit(commitMessage);
        await repoGit.push('origin', 'main');
        await log('Changes committed and pushed');
        return { success: true };
    } catch (err) {
        await log(`Error saving calendar rules: ${err.message}`);
        return { success: false, error: err.message };
    }
});

function bumpPatchVersion(version) {
    const parts = version.split('.').map(Number);
    if (parts.length === 3) parts[2] += 1;
    return parts.join('.');
}

// ---------------------
// App lifecycle
// ---------------------
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});