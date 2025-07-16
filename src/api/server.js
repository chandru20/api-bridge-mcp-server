/**
 * @fileoverview Main server class for the APIBridge MCP Server.
 * Orchestrates the entire application, from configuration to tool handling.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import { fileURLToPath } from 'url';

import { OpenAPIParser } from '../services/openapi-parser.js';
import { ConfigManager } from '../config/config-manager.js';
import { ToolManager } from '../tools/tool-manager.js';
import { HttpClient } from '../utils/http-client.js';
import { Logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);

export class APIBridgeMCPServer {
  constructor(options = {}) {
    this.configManager = new ConfigManager();
    this.openApiParser = new OpenAPIParser();
    this.toolManager = new ToolManager();
    this.httpClient = new HttpClient();
    this.logger = new Logger();
    
    this.server = null;
    this.config = {};
    this.testContext = new Map();
    this.metrics = new Map();
    this.startTime = Date.now();
    
    this.options = options;
  }

  /**
   * Initialize and start the server
   */
  async start() {
    try {
      await this.initialize();
      await this.startMCPServer();
    } catch (error) {
      this.logger.error(`Failed to start server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize the server components
   */
  async initialize() {
    // Load configuration
    this.config = await this.configManager.loadConfig(this.options);
    
    // Initialize logger
    this.logger.initialize(this.config);
    
    this.logger.info('🚀 Initializing APIBridge MCP Server...');

    // Parse OpenAPI specification if provided (command line takes priority over config)
    const openApiFile = this.options.openApiFile || this.config.openApiFile;
    if (openApiFile) {
      this.logger.info(`📖 Parsing OpenAPI specification: ${openApiFile}`);
      const openApiConfig = await this.openApiParser.parseFromFile(openApiFile);
      this.configManager.mergeOpenAPIConfig(openApiConfig);
      this.config = this.configManager.getAll();
    }

    // Validate configuration
    this.configManager.validate();

    // Initialize HTTP client
    this.httpClient.initialize(this.config);

    // Initialize tool manager
    this.toolManager.initialize(this.config, this.httpClient, this.logger);

    // Initialize MCP server
    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Setup handlers
    this.setupToolHandlers();
    this.setupErrorHandling();
    this.setupMetrics();

    this.logger.info(`✅ Server initialized successfully`);
    this.logger.info(`📊 Loaded ${Object.keys(this.config.endpoints || {}).length} endpoints`);
    this.logger.info(`🔄 Loaded ${Object.keys(this.config.workflows || {}).length} workflows`);
  }

  /**
   * Setup MCP tool handlers
   */
  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = await this.toolManager.generateTools(this.config);
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      
      try {
        this.recordMetric('requests_total', 1);
        
        const result = await this.toolManager.handleToolCall(
          request.params.name,
          request.params.arguments || {},
          this.testContext,
          this.metrics
        );
        
        const responseTime = Date.now() - startTime;
        this.recordMetric('response_times', responseTime);
        this.recordMetric('requests_successful', 1);
        
        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        this.recordMetric('response_times', responseTime);
        this.recordMetric('requests_failed', 1);
        this.recordMetric('errors', 1);
        
        this.logger.error(`Tool call failed: ${error.message}`);
        
        return {
          content: [{
            type: 'text',
            text: `❌ Error: ${error.message}`
          }],
          isError: true
        };
      }
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    this.server.onerror = (error) => {
      this.logger.error(`MCP Server error: ${error.message}`);
      this.recordMetric('critical_errors', 1);
    };

    process.on('SIGINT', async () => {
      this.logger.info('🛑 Shutting down gracefully...');
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      this.logger.error(`Uncaught exception: ${error.message}`);
      this.recordMetric('critical_errors', 1);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
      this.recordMetric('critical_errors', 1);
    });
  }

  /**
   * Setup metrics collection
   */
  setupMetrics() {
    this.metrics.set('requests_total', 0);
    this.metrics.set('requests_successful', 0);
    this.metrics.set('requests_failed', 0);
    this.metrics.set('response_times', []);
    this.metrics.set('errors', 0);
    this.metrics.set('critical_errors', 0);
  }

  /**
   * Record a metric
   */
  recordMetric(key, value) {
    if (key === 'response_times') {
      const times = this.metrics.get(key) || [];
      times.push(value);
      // Keep only the last 100 response times
      if (times.length > 100) {
        times.shift();
      }
      this.metrics.set(key, times);
    } else if (this.metrics.has(key)) {
      this.metrics.set(key, this.metrics.get(key) + value);
    } else {
      this.metrics.set(key, value);
    }
  }

  /**
   * Start the MCP server
   */
  async startMCPServer() {
    this.logger.info(`🚀 ${this.config.name} v${this.config.version} starting...`);
    this.logger.info(`🔗 API Base URL: ${this.config.apiBaseUrl}`);
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    this.logger.info('👂 Server is listening for MCP requests on stdio.');
  }
}
