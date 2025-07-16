/**
 * @fileoverview Manages configuration for the APIBridge MCP Server.
 * Loads, merges, and validates configuration from various sources.
 */

import fs from 'fs/promises';

export class ConfigManager {
  constructor() {
    this.config = {};
  }

  /**
   * Load configuration from various sources
   */
  async loadConfig(options = {}) {
    // Default configuration
    this.config = {
      name: 'APIBridge MCP Server',
      version: '1.0.0',
      apiBaseUrl: options.baseUrl || process.env.API_BASE_URL || 'http://localhost:3000/api',
      apiKey: options.apiKey || process.env.API_KEY || '',
      timeout: 10000,
      retryAttempts: 3,
      enableLogging: options.verbose || true,
      enableMetrics: true,
      configFile: options.configFile || './apibridge.config.json',
      openApiFile: options.openApiFile || null,
      endpoints: {},
      workflows: {}
    };

    // Load from config file if it exists
    if (options.configFile) {
      await this.loadFromFile(options.configFile);
    }

    // Override with command line options
    if (options.baseUrl) {
      this.config.apiBaseUrl = options.baseUrl;
    }
    
    if (options.apiKey) {
      this.config.apiKey = options.apiKey;
    }

    if (options.verbose) {
      this.config.enableLogging = true;
    }

    // Command line openApiFile takes priority over config file
    if (options.openApiFile) {
      this.config.openApiFile = options.openApiFile;
    }

    return this.config;
  }

  /**
   * Load configuration from JSON file
   */
  async loadFromFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileConfig = JSON.parse(content);
      
      // Merge with existing config
      this.config = { ...this.config, ...fileConfig };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Warning: Could not load config file ${filePath}: ${error.message}`);
      }
    }
  }

  /**
   * Merge OpenAPI-generated configuration
   */
  mergeOpenAPIConfig(openApiConfig) {
    if (openApiConfig.info) {
      this.config.name = openApiConfig.info.title || this.config.name;
      this.config.version = openApiConfig.info.version || this.config.version;
    }

    if (openApiConfig.servers && openApiConfig.servers.length > 0) {
      // Use the first server as base URL if not already set
      const firstServer = openApiConfig.servers[0];
      if (firstServer.url && !this.config.apiBaseUrl.includes('localhost')) {
        this.config.apiBaseUrl = firstServer.url;
      }
    }

    // Merge endpoints and workflows
    this.config.endpoints = { ...this.config.endpoints, ...openApiConfig.endpoints };
    this.config.workflows = { ...this.config.workflows, ...openApiConfig.workflows };
  }

  /**
   * Get configuration value
   */
  get(key, defaultValue = null) {
    return this.config[key] || defaultValue;
  }

  /**
   * Set configuration value
   */
  set(key, value) {
    this.config[key] = value;
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Validate configuration
   */
  validate() {
    const errors = [];

    if (!this.config.apiBaseUrl) {
      errors.push('apiBaseUrl is required');
    }

    if (!this.config.name) {
      errors.push('name is required');
    }

    if (!this.config.version) {
      errors.push('version is required');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Save current configuration to file
   */
  async saveToFile(filePath) {
    try {
      const configToSave = { ...this.config };
      delete configToSave.openApiFile; // Don't save runtime options
      
      await fs.writeFile(filePath, JSON.stringify(configToSave, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config to ${filePath}: ${error.message}`);
    }
  }
}
