#!/usr/bin/env node

/**
 * Script to start Next.js commands with the configured NODE_MODULES_PATH from .env
 * This script allows dynamically changing which node_modules directory is used
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the command to run (dev, build, start, lint)
const command = process.argv[2];

if (!command) {
  console.error('Please provide a command: dev, build, start, or lint');
  process.exit(1);
}

// Get the node modules path from environment variable
// Default to regular node_modules if not set
const nodeModulesPath = process.env.NODE_MODULES_PATH || './node_modules';

console.log(`Using node modules from: ${nodeModulesPath}`);

// Check if the directory exists
const fullModulesPath = path.resolve(process.cwd(), nodeModulesPath);
if (!fs.existsSync(fullModulesPath)) {
  console.warn(`Warning: Node modules directory not found at ${fullModulesPath}`);
  console.warn('Packages may not be available. Consider installing them first.');
}

// Map commands to the actual Next.js commands
const commandMap = {
  dev: 'next dev -p 3001',
  build: 'next build',
  start: 'next start -p 3001',
  lint: 'next lint'
};

const nextCommand = commandMap[command];
if (!nextCommand) {
  console.error(`Unknown command: ${command}`);
  console.error('Available commands: dev, build, start, lint');
  process.exit(1);
}

// Create the full command with NODE_PATH set to the specified modules directory
const fullCommand = `NODE_PATH=${nodeModulesPath} ${nextCommand}`;

console.log(`Executing: ${fullCommand}`);

// Run the command
const [cmd, ...args] = fullCommand.split(' ');
const proc = spawn(cmd, args, { 
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

// Handle process exit
proc.on('close', (code) => {
  process.exit(code);
});
