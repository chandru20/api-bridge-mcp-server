/**
 * @fileoverview A simple logger utility for the server, with support for
 * different log levels and file-based logging.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Logger {
  constructor() {
    this.config = {};
    this.logFile = null;
  }

  /**
   * Initialize the logger
   */
  async initialize(config) {
    this.config = config;
    
    if (config.enableLogging) {
      await this.setupFileLogging();
    }
  }

  /**
   * Setup file logging
   */
  async setupFileLogging() {
    const logsDir = path.join(process.cwd(), 'logs');
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    this.logFile = path.join(logsDir, `apibridge-${timestamp}.log`);
    
    try {
      await fs.mkdir(logsDir, { recursive: true });
      await this.writeToFile(`[${new Date().toISOString()}] Logger initialized\n`);
    } catch (error) {
      console.error(`Warning: Could not setup file logging: ${error.message}`);
      this.logFile = null;
    }
  }

  /**
   * Write message to log file
   */
  async writeToFile(message) {
    if (this.logFile) {
      try {
        await fs.appendFile(this.logFile, message);
      } catch (error) {
        // Silently fail file writing to avoid recursive logging
      }
    }
  }

  /**
   * Format log message
   */
  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Log info message
   */
  async info(message) {
    const formatted = this.formatMessage('info', message);
    console.error(formatted);
    await this.writeToFile(formatted + '\n');
  }

  /**
   * Log warning message
   */
  async warn(message) {
    const formatted = this.formatMessage('warn', message);
    console.error(formatted);
    await this.writeToFile(formatted + '\n');
  }

  /**
   * Log error message
   */
  async error(message) {
    const formatted = this.formatMessage('error', message);
    console.error(formatted);
    await this.writeToFile(formatted + '\n');
  }

  /**
   * Log debug message (only if verbose enabled)
   */
  async debug(message) {
    if (this.config.enableLogging) {
      const formatted = this.formatMessage('debug', message);
      console.error(formatted);
      await this.writeToFile(formatted + '\n');
    }
  }

  /**
   * Log generic message with custom level
   */
  async log(message, level = 'info') {
    switch (level.toLowerCase()) {
      case 'error':
        await this.error(message);
        break;
      case 'warn':
      case 'warning':
        await this.warn(message);
        break;
      case 'debug':
        await this.debug(message);
        break;
      default:
        await this.info(message);
        break;
    }
  }
}
