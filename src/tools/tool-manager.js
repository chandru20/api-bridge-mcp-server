/**
 * @fileoverview Manages the generation and execution of tools, both core and
 * dynamically generated from the OpenAPI specification.
 */

export class ToolManager {
  constructor() {
    this.config = null;
    this.httpClient = null;
    this.logger = null;
    this.coreTools = new Map();
    this.endpointTools = new Map();
  }

  /**
   * Initialize the tool manager
   */
  initialize(config, httpClient, logger) {
    this.config = config;
    this.httpClient = httpClient;
    this.logger = logger;
    this.setupCoreTools();
  }

  /**
   * Setup core API testing tools
   */
  setupCoreTools() {
    this.coreTools.set('ping_api', {
      name: 'ping_api',
      description: 'Check API health and connectivity',
      inputSchema: {
        type: 'object',
        properties: {
          endpoint: { type: 'string', description: 'Specific endpoint to ping (e.g., /health)' },
          detailed: { type: 'boolean', description: 'Include detailed diagnostics' }
        }
      },
      handler: this.handlePingApi.bind(this)
    });

    this.coreTools.set('validate_api', {
      name: 'validate_api',
      description: 'Comprehensive API validation',
      inputSchema: {
        type: 'object',
        properties: {
          endpoints: { type: 'array', items: { type: 'string' }, description: 'Array of endpoint names to validate. Defaults to all.' },
          includeEdgeCases: { type: 'boolean', default: true },
          generateReport: { type: 'boolean', default: false }
        }
      },
      handler: this.handleValidateApi.bind(this)
    });

    this.coreTools.set('run_workflow', {
      name: 'run_workflow',
      description: 'Execute a pre-defined test workflow',
      inputSchema: {
        type: 'object',
        properties: {
          workflow: { 
            type: 'string', 
            enum: Object.keys(this.config?.workflows || {}),
            description: 'The name of the workflow to execute' 
          },
          stopOnError: { type: 'boolean', default: true },
          saveResults: { type: 'boolean', default: false }
        },
        required: ['workflow']
      },
      handler: this.handleRunWorkflow.bind(this)
    });

    this.coreTools.set('get_metrics', {
      name: 'get_metrics',
      description: 'Get server metrics and performance statistics',
      inputSchema: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['json', 'table', 'summary'], default: 'summary' }
        }
      },
      handler: this.handleGetMetrics.bind(this)
    });
  }

  /**
   * Generate all available tools
   */
  async generateTools(config) {
    const tools = [];

    // Add core tools
    for (const tool of this.coreTools.values()) {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      });
    }

    // Generate endpoint-specific tools
    if (config.endpoints) {
      for (const [endpointName, endpoint] of Object.entries(config.endpoints)) {
        const endpointTools = this.generateEndpointTools(endpointName, endpoint);
        tools.push(...endpointTools);
      }
    }

    return tools;
  }

  /**
   * Generate tools for a specific endpoint
   */
  generateEndpointTools(endpointName, endpoint) {
    const tools = [];

    // Generate tools for each operation (including GET_COLLECTION)
    for (const [operationKey, operation] of Object.entries(endpoint.operations || {})) {
      if (!operation) continue;

      const toolName = this.generateToolName(operationKey, endpointName);
      const tool = {
        name: toolName,
        description: this.generateToolDescription(operationKey, endpointName, endpoint),
        inputSchema: this.generateToolSchema(operationKey, endpoint)
      };

      tools.push(tool);
      
      // Store the tool handler with operation-specific details
      this.endpointTools.set(toolName, {
        ...tool,
        endpoint: endpointName,
        method: operationKey, // This could be GET, GET_COLLECTION, POST, etc.
        operation: operation, // Store the specific operation
        handler: this.handleEndpointTool.bind(this)
      });
    }

    return tools;
  }

  /**
   * Generate tool name based on HTTP method and endpoint
   */
  generateToolName(method, endpointName) {
    const singularName = endpointName.endsWith('s') ? endpointName.slice(0, -1) : endpointName;

    const methodMap = {
      'GET': `get_${singularName}`, // Individual resource GET
      'GET_COLLECTION': `list_${endpointName}`, // Collection GET
      'POST': `create_${singularName}`,
      'PUT': `update_${singularName}`,
      'PATCH': `patch_${singularName}`,
      'DELETE': `delete_${singularName}`
    };

    return methodMap[method] || `${method.toLowerCase()}_${endpointName}`;
  }

  /**
   * Generate tool description
   */
  generateToolDescription(method, endpointName, endpoint) {
    const singularName = endpointName.endsWith('s') ? endpointName.slice(0, -1) : endpointName;
    
    const descriptions = {
      'GET': `Get ${singularName} by ID`,
      'GET_COLLECTION': `List all ${endpointName}`,
      'POST': `Create a new ${singularName}`,
      'PUT': `Update an existing ${singularName}`,
      'PATCH': `Partially update an existing ${singularName}`,
      'DELETE': `Delete an existing ${singularName}`
    };

    let desc = descriptions[method] || `${method} operation on ${endpointName}`;
    
    if (endpoint.operations && endpoint.operations[method]) {
      const operation = endpoint.operations[method];
      if (operation.summary) {
        desc = operation.summary;
      } else if (operation.description) {
        desc = operation.description;
      }
    }

    return desc;
  }

  /**
   * Generate tool input schema
   */
  generateToolSchema(method, endpoint) {
    const schema = {
      type: 'object',
      properties: {}
    };

    // Add common properties
    if (['PUT', 'PATCH', 'DELETE', 'GET'].includes(method) && method !== 'GET_COLLECTION') {
      schema.properties.id = {
        type: 'string',
        description: 'The ID of the resource to modify'
      };
    }

    // Add request body for POST/PUT/PATCH - make data input seamless
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      // Add individual fields based on the endpoint schema for easier data input
      if (endpoint.schema && endpoint.schema.properties) {
        for (const [key, value] of Object.entries(endpoint.schema.properties)) {
          // Skip internal fields for POST operations
          if (method === 'POST' && ['id', 'createdAt', 'updatedAt'].includes(key)) {
            continue;
          }
          schema.properties[key] = value;
        }
      }
      
      // Add a convenience property for raw data input
      schema.properties.data = {
        type: 'object',
        description: 'Raw data object to send in the request body (alternative to individual fields)',
        additionalProperties: true
      };
    }

    // Add query parameters
    schema.properties.queryParams = {
      type: 'object',
      description: 'Query parameters to include in the request',
      additionalProperties: true
    };

    // Add context saving/loading
    schema.properties.saveToContext = {
      type: 'string',
      description: 'Save the response to context with this key'
    };

    schema.properties.fromContext = {
      type: 'string',
      description: 'Load data from context using this key'
    };

    return schema;
  }

  /**
   * Handle tool call requests
   */
  async handleToolCall(toolName, args, testContext, metrics) {
    // Check core tools first
    if (this.coreTools.has(toolName)) {
      const tool = this.coreTools.get(toolName);
      return await tool.handler(args, testContext, metrics);
    }

    // Check endpoint tools
    if (this.endpointTools.has(toolName)) {
      const tool = this.endpointTools.get(toolName);
      return await tool.handler(toolName, args, testContext);
    }

    throw new Error(`Unknown tool: ${toolName}`);
  }

  /**
   * Handle ping API tool
   */
  async handlePingApi(args, testContext, metrics) {
    const results = [];
    const startTime = Date.now();
    const url = args.endpoint ? 
      `${this.config.apiBaseUrl.replace(/\/api$/, '')}${args.endpoint}` : 
      this.config.apiBaseUrl.replace('/api', '/health');

    try {
      const response = await this.httpClient.request('GET', url);
      const duration = Date.now() - startTime;
      
      results.push(`✅ API Health Check Successful`);
      results.push(`🔗 URL: ${url}`);
      results.push(`⏱️ Response Time: ${duration}ms`);
      results.push(`📊 Status: ${response.status}`);
      
      if (args.detailed && response.data) {
        results.push(`📋 Response: ${JSON.stringify(response.data, null, 2)}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      results.push(`❌ API Health Check Failed`);
      results.push(`🔗 URL: ${url}`);
      results.push(`⏱️ Response Time: ${duration}ms`);
      results.push(`💥 Error: ${error.message}`);
    }

    return {
      content: [{
        type: 'text',
        text: results.join('\n')
      }]
    };
  }

  /**
   * Handle validate API tool
   */
  async handleValidateApi(args, testContext, metrics) {
    const results = [];
    const endpointsToTest = args.endpoints && args.endpoints.length > 0 
      ? args.endpoints 
      : Object.keys(this.config.endpoints || {});
    
    results.push('🔍 Starting API validation...\n');

    for (const endpointName of endpointsToTest) {
      const endpoint = this.config.endpoints[endpointName];
      if (!endpoint) {
        results.push(`❌ Endpoint not found: ${endpointName}`);
        continue;
      }

      results.push(`🔍 Testing endpoint: ${endpointName}`);
      await this.validateEndpoint(endpoint, results, args.includeEdgeCases);
      results.push('');
    }

    return {
      content: [{
        type: 'text',
        text: results.join('\n')
      }]
    };
  }

  /**
   * Validate a single endpoint
   */
  async validateEndpoint(endpoint, results, includeEdgeCases) {
    for (const method of endpoint.methods) {
      try {
        const baseUrl = `${this.config.apiBaseUrl}${endpoint.path.replace(/\{[^}]+\}/g, 'test-id')}`;
        const response = await this.httpClient.request(method, baseUrl);
        results.push(`  ✅ ${method}: ${response.status}`);
      } catch (error) {
        results.push(`  ❌ ${method}: ${error.message}`);
      }
    }
  }

  /**
   * Handle run workflow tool
   */
  async handleRunWorkflow(args, testContext, metrics) {
    const workflow = this.config.workflows[args.workflow];
    if (!workflow) {
      throw new Error(`Unknown workflow: ${args.workflow}`);
    }

    const results = [];
    const startTime = Date.now();
    
    results.push(`🚀 Starting workflow: ${workflow.name}`);
    results.push(`📋 ${workflow.description}\n`);

    // Execute steps
    for (let i = 0; i < (workflow.steps || []).length; i++) {
      const step = workflow.steps[i];
      
      try {
        const stepName = `Step ${i + 1}: ${step.description || step.action}`;
        results.push(`📍 ${stepName}`);
        
        // Execute the step
        const stepResult = await this.handleToolCall(step.action, step.args || {}, testContext, metrics);
        if (stepResult.content && stepResult.content[0].text) {
          results.push(stepResult.content[0].text.split('\n').map(line => `  | ${line}`).join('\n'));
        }
        
        results.push(`✅ Completed`);
      } catch (error) {
        results.push(`❌ Failed: ${error.message}`);
        if (args.stopOnError) {
          break;
        }
      }
      
      results.push('');
    }

    const duration = Date.now() - startTime;
    results.push(`\n🎉 Workflow finished in ${duration}ms.`);

    return {
      content: [{
        type: 'text',
        text: results.join('\n')
      }]
    };
  }

  /**
   * Handle get metrics tool
   */
  async handleGetMetrics(args, testContext, metrics) {
    const uptime = Date.now() - this.startTime;
    const metricsData = {
      uptime: `${Math.floor(uptime / 1000)}s`,
      requests: {
        total: metrics.get('requests_total') || 0,
        successful: metrics.get('requests_successful') || 0,
        failed: metrics.get('requests_failed') || 0
      },
      performance: {
        averageResponseTime: this.calculateAverageResponseTime(metrics),
        errors: (metrics.get('errors') || 0) + (metrics.get('critical_errors') || 0),
      },
      context: {
        activeItems: testContext.size,
        endpoints: Object.keys(this.config.endpoints || {}).length,
        workflows: Object.keys(this.config.workflows || {}).length
      }
    };

    let text;
    switch (args.format) {
      case 'json':
        text = JSON.stringify(metricsData, null, 2);
        break;
      case 'table':
        text = this.formatMetricsTable(metricsData);
        break;
      default:
        text = this.formatMetricsSummary(metricsData);
    }

    return {
      content: [{
        type: 'text',
        text
      }]
    };
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime(metrics) {
    const times = metrics.get('response_times') || [];
    return times.length > 0 
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) 
      : 0;
  }

  /**
   * Format metrics as summary
   */
  formatMetricsSummary(metrics) {
    return `📊 APIBridge MCP Server Metrics

⏱️ Uptime: ${metrics.uptime}
🔄 Requests: ${metrics.requests.total} total (${metrics.requests.successful} successful, ${metrics.requests.failed} failed)
⚡ Avg Response Time: ${metrics.performance.averageResponseTime}ms
❌ Errors: ${metrics.performance.errors}

🔧 Configuration:
- Endpoints: ${metrics.context.endpoints}
- Workflows: ${metrics.context.workflows}
- Active Context Items: ${metrics.context.activeItems}`;
  }

  /**
   * Format metrics as table
   */
  formatMetricsTable(metrics) {
    const pad = (str, len) => String(str).padEnd(len);
    return `┌─────────────────────┬─────────────┐
│ Metric              │ Value       │
├─────────────────────┼─────────────┤
│ Uptime              │ ${pad(metrics.uptime, 11)} │
│ Total Requests      │ ${pad(metrics.requests.total, 11)} │
│ Successful Requests │ ${pad(metrics.requests.successful, 11)} │
│ Failed Requests     │ ${pad(metrics.requests.failed, 11)} │
│ Avg Response (ms)   │ ${pad(metrics.performance.averageResponseTime, 11)} │
│ Errors              │ ${pad(metrics.performance.errors, 11)} │
├─────────────────────┼─────────────┤
│ Endpoints           │ ${pad(metrics.context.endpoints, 11)} │
│ Workflows           │ ${pad(metrics.context.workflows, 11)} │
│ Context Items       │ ${pad(metrics.context.activeItems, 11)} │
└─────────────────────┴─────────────┘`;
  }

  /**
   * Handle endpoint-specific tool calls
   */
  async handleEndpointTool(toolName, args, testContext) {
    const tool = this.endpointTools.get(toolName);
    const endpoint = this.config.endpoints[tool.endpoint];
    
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${tool.endpoint}`);
    }

    // Resolve context references
    const resolvedArgs = this.resolveContextReferences(args, testContext);

    // Use the operation-specific path directly from the tool's operation
    const operation = tool.operation;
    const pathToUse = operation.path;

    // Build URL - use the operation-specific path
    let url = `${this.config.apiBaseUrl}${pathToUse}`;
    
    // For operations that require an ID (parameterized paths)
    if (pathToUse.includes('{')) {
      if (!resolvedArgs.id) {
        throw new Error(`ID parameter is required for ${tool.method} operation on ${pathToUse}`);
      }
      // Replace path parameters with actual ID
      url = url.replace(/\{[^}]+\}/g, resolvedArgs.id);
    }

    // Add query parameters
    if (resolvedArgs.queryParams) {
      const params = new URLSearchParams(resolvedArgs.queryParams);
      url += `?${params.toString()}`;
    }

    // Prepare request data
    let data = null;
    const httpMethod = tool.method === 'GET_COLLECTION' ? 'GET' : tool.method;
    if (['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
      // Start with a clean data object
      data = {};
      
      // If there's a raw data object, use it as the base
      if (resolvedArgs.data && typeof resolvedArgs.data === 'object') {
        data = { ...resolvedArgs.data };
      }
      
      // Then overlay any individual field parameters (these take precedence)
      for (const [key, value] of Object.entries(resolvedArgs)) {
        if (!['id', 'queryParams', 'saveToContext', 'fromContext', 'data'].includes(key) && value !== undefined) {
          data[key] = value;
        }
      }
      
      // Ensure we have some data for POST operations
      if (httpMethod === 'POST' && Object.keys(data).length === 0) {
        throw new Error(`No data provided for ${tool.method} operation. Provide either individual fields or a 'data' object.`);
      }
    }

    try {
      // Map the tool method to HTTP method
      const httpMethod = tool.method === 'GET_COLLECTION' ? 'GET' : tool.method;
      const response = await this.httpClient.request(httpMethod, url, data);
      
      // Save to context if requested
      if (args.saveToContext && response.data) {
        testContext.set(args.saveToContext, response.data);
      }

      return this.formatResponse(httpMethod, tool.endpoint, response);
    } catch (error) {
      throw new Error(`${tool.method} ${url} failed: ${error.message}`);
    }
  }

  /**
   * Resolve context references in arguments
   */
  resolveContextReferences(args, testContext) {
    const resolved = { ...args };
    
    if (args.fromContext && testContext.has(args.fromContext)) {
      const contextData = testContext.get(args.fromContext);
      
      // First, merge in the context data (this will be overridden by explicit args)
      if (contextData && typeof contextData === 'object') {
        Object.assign(resolved, contextData);
      }
      
      // Then overlay the explicit arguments (these take precedence)
      Object.assign(resolved, args);
      
      // Special handling for ID extraction - if contextData has an id and we don't have one explicitly
      if (contextData && typeof contextData === 'object' && contextData.id && !args.id) {
        resolved.id = contextData.id;
      }
    }

    // Handle dynamic foreign key resolution generically
    if (args._dynamicForeignKeys && Array.isArray(args._dynamicForeignKeys)) {
      for (const fkDep of args._dynamicForeignKeys) {
        const contextKey = `existing_${fkDep.targetEndpoint}`;
        
        if (testContext.has(contextKey)) {
          const targetData = testContext.get(contextKey);
          
          if (Array.isArray(targetData) && targetData.length > 0) {
            // Use the first item's ID as the foreign key value
            const foreignKeyValue = targetData[0].id;
            
            // Replace the dynamic marker in all data fields
            const replaceDynamicMarker = (obj, marker, value) => {
              if (typeof obj === 'string') {
                return obj.replace(marker, value);
              } else if (Array.isArray(obj)) {
                return obj.map(item => replaceDynamicMarker(item, marker, value));
              } else if (obj && typeof obj === 'object') {
                const newObj = {};
                for (const [key, val] of Object.entries(obj)) {
                  newObj[key] = replaceDynamicMarker(val, marker, value);
                }
                return newObj;
              }
              return obj;
            };

            // Apply the replacement to all resolved args
            for (const [key, value] of Object.entries(resolved)) {
              if (key !== '_dynamicForeignKeys') {
                resolved[key] = replaceDynamicMarker(value, fkDep.marker, foreignKeyValue);
              }
            }
          }
        }
      }
      
      // Remove the dynamic foreign keys flag
      delete resolved._dynamicForeignKeys;
    }

    // Legacy support for the old hardcoded _dynamicAuthorId flag
    if (args._dynamicAuthorId && testContext.has('existing_users')) {
      const users = testContext.get('existing_users');
      if (Array.isArray(users) && users.length > 0) {
        // Use the first user's ID as the author
        const authorId = users[0].id;
        
        // Replace the placeholder in all data fields
        const replaceDynamicIds = (obj) => {
          if (typeof obj === 'string') {
            return obj.replace('{{EXISTING_USER_ID}}', authorId);
          } else if (Array.isArray(obj)) {
            return obj.map(replaceDynamicIds);
          } else if (obj && typeof obj === 'object') {
            const newObj = {};
            for (const [key, value] of Object.entries(obj)) {
              newObj[key] = replaceDynamicIds(value);
            }
            return newObj;
          }
          return obj;
        };

        // Apply the replacement to all resolved args
        for (const [key, value] of Object.entries(resolved)) {
          if (key !== '_dynamicAuthorId') {
            resolved[key] = replaceDynamicIds(value);
          }
        }
        
        // Remove the dynamic flag
        delete resolved._dynamicAuthorId;
      }
    }

    return resolved;
  }

  /**
   * Format HTTP response for display
   */
  formatResponse(method, endpointName, response) {
    const icon = this.getMethodIcon(method);
    const status = response.status;
    const data = response.data;
    
    let text = `${icon} ${method} ${endpointName} | Status: ${status}\n\n`;
    
    if (typeof data === 'string') {
      text += data;
    } else {
      text += JSON.stringify(data, null, 2);
    }

    return {
      content: [{
        type: 'text',
        text
      }]
    };
  }

  /**
   * Get emoji icon for HTTP method
   */
  getMethodIcon(method) {
    const icons = {
      'GET': '🔍',
      'POST': '✨',
      'PUT': '🔄',
      'PATCH': '🔧',
      'DELETE': '🗑️'
    };
    return icons[method] || '🔗';
  }
}
