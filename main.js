const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let serverProcess;

// Path to the NestJS server executable
const getServerPath = () => {
  return path.join(__dirname, 'dist', 'apps', 'hotwallet', 'main.js');
};

// Path to the frontend build directory
const getFrontendPath = () => {
  return path.join(__dirname, 'webapp', 'dist');
};

// Create and setup the Express server to serve the frontend
function startFrontEnd() {
  const frontendServer = express();
  const frontendPort = process.env.FRONTEND_PORT || 4000;
  
  // Serve static files from the frontend build directory
  frontendServer.use(express.static(getFrontendPath()));
  
  // For any other route, serve the index.html (for SPA routing)
  frontendServer.get('*', (req, res) => {
    res.sendFile(path.join(getFrontendPath(), 'index.html'));
  });
  
  // Start the frontend server
  frontendServer.listen(frontendPort, () => {
    console.log(`Frontend server running on http://localhost:${frontendPort}`);
  });
  
  return frontendPort;
}

// Start the NestJS server
function startServer() {
  const serverPath = getServerPath();
  
  // Check if the server executable exists
  if (!fs.existsSync(serverPath)) {
    console.error(`Server executable not found at: ${serverPath}`);
    process.exit(1);
  }
  
  console.log(`Starting server from: ${serverPath}`);
  
  // Spawn the server process
  serverProcess = spawn('node', [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production'
    },
    stdio: 'pipe'
  });
  
  // Log server output
  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
  
  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
    process.exit(code);
  });
  
  return serverProcess;
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT. Graceful shutdown...');
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Graceful shutdown...');
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});

// Start the application
console.log('Starting Runepool DEX server...');

// Start the NestJS server first
startServer();

// Setup Express server to serve the frontend
startFrontEnd();

console.log('Runepool DEX server is running');
