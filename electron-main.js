const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Config
const SERVER_PORT = 3000;
let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        backgroundColor: '#0f1117', // Match dark theme
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        title: "LinkScope",
        icon: path.join(__dirname, 'public/favicon.ico')
    });

    // Load the dashboard
    // We wait a bit for the server to start, or retry
    const loadDashboard = () => {
        mainWindow.loadURL(`http://localhost:${SERVER_PORT}`).catch(() => {
            console.log('Server not ready, retrying...');
            setTimeout(loadDashboard, 1000);
        });
    };

    loadDashboard();

    // Open links in external browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

function startServer() {
    console.log('Starting internal server...');

    // Path to the server script
    const serverScript = path.join(__dirname, 'dist', 'server.js');

    // We need to run the compiled JS server, not TS
    // Requires 'npm run build' before packaging
    serverProcess = spawn('node', [serverScript], {
        env: { ...process.env, PORT: SERVER_PORT, ELECTRON_RUN: 'true' },
        stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (data) => {
        console.log(`[Server]: ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`[Server Error]: ${data}`);
    });
}

app.whenReady().then(() => {
    startServer();
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
