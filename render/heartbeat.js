const dotenv = require('dotenv');
const path = require('path');
const http = require('http'); // Use http or https depending on the URL
const https = require('https');

// Load environment variables from .env file in the same directory
dotenv.config({ path: path.resolve(__dirname, '.env') });

const backendUrl = process.env.RENDER_BACKEND_URL;
const pingInterval = parseInt(process.env.PING_INTERVAL || '300000', 10); // Default to 5 minutes
const targetPath = '/api/health'; // Updated to /api/health

if (!backendUrl) {
  console.error('Error: RENDER_BACKEND_URL is not defined in .env file.');
  process.exit(1);
}

console.log(`Heartbeat service started.`);
console.log(`Targeting: ${backendUrl}${targetPath}`);
console.log(`Ping interval: ${pingInterval / 1000 / 60} minutes.`);

function sendPing() {
  const url = new URL(backendUrl);
  const protocol = url.protocol === 'https:' ? https : http;
  const fullUrl = `${backendUrl}${targetPath}`;

  console.log(`[${new Date().toISOString()}] Pinging ${fullUrl}...`);

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: targetPath,
    method: 'GET',
    timeout: 10000, // 10 seconds timeout
  };

  const req = protocol.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[${new Date().toISOString()}] Ping successful to ${fullUrl}. Status: ${res.statusCode}`);
      } else {
        console.warn(`[${new Date().toISOString()}] Ping to ${fullUrl} returned status: ${res.statusCode}. Response: ${data.substring(0, 100)}...`);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`[${new Date().toISOString()}] Ping error to ${fullUrl}: ${e.message}`);
  });

  req.on('timeout', () => {
    req.destroy();
    console.error(`[${new Date().toISOString()}] Ping timeout to ${fullUrl} after ${options.timeout / 1000} seconds.`);
  });

  req.end();
}

// Send the first ping immediately, then set the interval
sendPing();
setInterval(sendPing, pingInterval);

// Basic error handling for the process
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});