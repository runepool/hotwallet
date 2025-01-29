const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const express = require('express');

let mainWindow;
let serverProcess;

app.on('ready', () => {
  // Check the mode (desktop or server)
  const mode = process.env.APP_MODE || 'desktop';
  process.env.BITCOIN_NETWORK = process.env.BITCOIN_NETWORK || 'mainnet';

  // Set up database path in user data directory
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'exchange.db');
  process.env.DATABASE_NAME = dbPath;

  // Start the NestJS server with SQLite support
  const serverPath = path.join(__dirname, 'dist/apps/liquidium-dex/main.js'); // Path to NestJS compiled file
  const frontendPort = process.env.FRONTEND_PORT || 4000; // Default port for frontend

  serverProcess = fork(serverPath)

  // Log server output
  serverProcess.on('message', (message) => console.log('Server:', message));
  serverProcess.on('error', (error) => console.error('Server Error:', error));
  serverProcess.on('exit', (code) => console.log(`Server exited with code: ${code}`));

  if (mode === 'desktop') {
    // Create Electron Window in desktop mode
    mainWindow = new BrowserWindow({
      width: 1600,
      height: 800,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Load React app's built frontend
    const frontendPath = path.join(__dirname, 'webapp/dist/index.html'); // Path to React build output
    setTimeout(() => {
      mainWindow.loadFile(frontendPath);
    }, 3000);
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } else {
    console.log(`Running in server mode. Frontend will be served on port ${frontendPort}.`);

    // Create a separate Express server to serve the React frontend
    const frontendServer = express();
    const reactBuildPath = path.join(__dirname, 'webapp/dist');

    frontendServer.use(express.static(reactBuildPath));

    frontendServer.get('*', (req, res) => {
      res.sendFile(path.join(reactBuildPath, 'index.html'));
    });

    frontendServer.listen(frontendPort, () => {
      console.log(`Frontend is being served on http://localhost:${frontendPort}`);
    });
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill('SIGINT'); // Ensure server stops with Electron
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null && process.env.APP_MODE === 'desktop') {
    app.emit('ready');
  }
});
