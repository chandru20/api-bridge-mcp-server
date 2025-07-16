#!/usr/bin/env node

/**
 * @fileoverview Main entry point for the APIBridge MCP Server.
 * @version 1.0.0
 */

import { APIBridgeMCPServer } from './src/api/server.js';
import { parseArguments } from './src/utils/cli.js';

// Main execution block
(async () => {
  try {
    const args = parseArguments();
    const server = new APIBridgeMCPServer(args);
    await server.start();
  } catch (error) {
    console.error(`[FATAL] Failed to start APIBridge MCP Server: ${error.message}`);
    process.exit(1);
  }
})();
