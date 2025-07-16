/**
 * @fileoverview Parses OpenAPI specifications and converts them into a format
 * usable by the APIBridge MCP Server.
 * This enhanced version includes robust $ref resolution, required field handling,
 * and improved data generation for automated workflows.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';

export class OpenAPIParser {
  constructor() {
    this.spec = null;
    this.endpoints = new Map();
    this.workflows = new Map();
  }

  /**
   * Parses an OpenAPI specification from a file.
   * @param {string} filePath - The path to the OpenAPI file (.yml, .yaml, or .json).
   * @returns {Promise<object>} An object containing the parsed endpoints, workflows, and API info.
   */
  async parseFromFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.yml' || ext === '.yaml') {
        this.spec = yaml.parse(content);
      } else if (ext === '.json') {
        this.spec = JSON.parse(content);
      } else {
        throw new Error(`Unsupported file format: ${ext}. Use .yml, .yaml, or .json`);
      }

      this.generateEndpoints();
      this.generateWorkflows();

      return {
        endpoints: Object.fromEntries(this.endpoints),
        workflows: Object.fromEntries(this.workflows),
        info: this.spec.info || {},
        servers: this.spec.servers || [],
      };
    } catch (error) {
      console.error(`Failed to parse OpenAPI spec: ${error.message}`);
      throw new Error(`Failed to parse OpenAPI spec: ${error.message}`);
    }
  }

  /**
   * Resolves a JSON schema $ref pointer.
   * @param {object} schemaOrRef - The schema object or a reference object.
   * @returns {object|null} The resolved schema object, or null if resolution fails.
   */
  resolveSchemaReference(schemaOrRef) {
    if (!schemaOrRef) return null;

    if (schemaOrRef.$ref) {
      const refPath = schemaOrRef.$ref.replace(/^#\//, '').split('/');
      let resolved = this.spec;
      for (const part of refPath) {
        if (resolved && typeof resolved === 'object' && part in resolved) {
          resolved = resolved[part];
        } else {
          console.warn(`Could not resolve reference: ${schemaOrRef.$ref}`);
          return null;
        }
      }
      // Recursively resolve if the resolved part is also a reference
      return this.resolveSchemaReference(resolved);
    }

    // If it's an object with properties, resolve any nested references
    if (schemaOrRef.type === 'object' && schemaOrRef.properties) {
        const resolvedProperties = {};
        for (const [key, value] of Object.entries(schemaOrRef.properties)) {
            resolvedProperties[key] = this.resolveSchemaReference(value);
        }
        return { ...schemaOrRef, properties: resolvedProperties };
    }
    
    // If it's an array with items, resolve the items schema
    if (schemaOrRef.type === 'array' && schemaOrRef.items) {
        return { ...schemaOrRef, items: this.resolveSchemaReference(schemaOrRef.items) };
    }

    return schemaOrRef;
  }

  /**
   * Extracts a schema from a request body, resolving any references.
   * @param {object} requestBody - The requestBody object from the OpenAPI spec.
   * @returns {object|null} The resolved schema.
   */
  extractSchemaFromRequestBody(requestBody) {
    if (!requestBody?.content?.['application/json']?.schema) {
      return null;
    }
    return this.resolveSchemaReference(requestBody.content['application/json'].schema);
  }

  /**
   * Generates endpoint configurations from the OpenAPI paths.
   */
  generateEndpoints() {
    if (!this.spec.paths) {
      throw new Error('No paths found in OpenAPI specification');
    }

    for (const [pathTemplate, pathItem] of Object.entries(this.spec.paths)) {
      const endpointName = this.extractEndpointName(pathTemplate);
      let endpoint = this.endpoints.get(endpointName) || {
        name: endpointName,
        path: pathTemplate,
        methods: [],
        operations: {},
        schema: null,
      };

      const methods = Object.keys(pathItem)
        .map(m => m.toUpperCase())
        .filter(m => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m));
      
      endpoint.methods = [...new Set([...endpoint.methods, ...methods])];

      for (const [method, operation] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;

        const methodKey = method.toUpperCase();
        const isCollectionPath = !pathTemplate.endsWith('}');
        const operationKey = isCollectionPath && methodKey === 'GET' ? 'GET_COLLECTION' : methodKey;

        endpoint.operations[operationKey] = {
          operationId: operation.operationId || this.generateOperationId(method, pathTemplate),
          summary: operation.summary,
          description: operation.description,
          parameters: operation.parameters || [],
          requestBody: operation.requestBody,
          responses: operation.responses || {},
          path: pathTemplate,
          isCollection: isCollectionPath,
        };
      }

      // Set primary schema from POST or PUT operation
      const postOp = pathItem.post || pathItem.put;
      if (postOp?.requestBody && !endpoint.schema) {
        endpoint.schema = this.extractSchemaFromRequestBody(postOp.requestBody);
      }
      
      // Prioritize collection path for the main endpoint path
      if (!pathTemplate.includes('{') || endpoint.path.includes('{')) {
        endpoint.path = pathTemplate;
      }

      this.endpoints.set(endpointName, endpoint);
    }
  }

  /**
   * Generates a descriptive operation ID if one is not provided.
   * @param {string} method - The HTTP method.
   * @param {string} path - The URL path.
   * @returns {string} A generated operation ID.
   */
  generateOperationId(method, path) {
    const pathParts = path.split('/').filter(p => p && !p.startsWith('{'));
    const resource = pathParts.pop() || 'root';
    const singularResource = resource.endsWith('s') ? resource.slice(0, -1) : resource;
    const isCollection = !path.endsWith('}');

    let action;
    switch (method.toUpperCase()) {
      case 'GET': action = isCollection ? 'list' : 'get'; break;
      case 'POST': action = 'create'; break;
      case 'PUT': case 'PATCH': action = 'update'; break;
      case 'DELETE': action = 'delete'; break;
      default: action = method.toLowerCase();
    }

    const resourceName = isCollection ? resource : singularResource;
    return `${action}_${resourceName}`;
  }

  /**
   * Extracts a clean endpoint name from a path template.
   * @param {string} pathTemplate - The path template (e.g., /users/{id}).
   * @returns {string} A clean name (e.g., users).
   */
  extractEndpointName(pathTemplate) {
    return pathTemplate
      .replace(/^\//, '')
      .replace(/\{[^}]+\}.*$/, '') // Remove path parameters and anything after
      .replace(/\/$/, '') // remove trailing slash
      .replace(/[\/-]/g, '_') || 'root';
  }

  /**
   * Generates sample data for a given schema, respecting required fields.
   * @param {object} schema - The resolved OpenAPI schema.
   * @param {string} endpointName - The current endpoint name for context
   * @returns {object} An object with sample data.
   */
  generateSampleData(schema, endpointName = '') {
    if (!schema || schema.type !== 'object' || !schema.properties) {
      return {};
    }

    const sampleData = {};
    const { properties, required = [] } = schema;

    // Ensure all required properties are generated
    for (const propName of required) {
      if (properties[propName]) {
        // Skip read-only fields that shouldn't be in requests
        if (properties[propName].readOnly) continue;
        sampleData[propName] = this.generateSampleValueForProp(propName, properties[propName], endpointName);
      }
    }

    // Generate other properties that are not required
    for (const [propName, propSchema] of Object.entries(properties)) {
      // Skip if already generated (because it was required) or if it's read-only
      if (sampleData.hasOwnProperty(propName) || propSchema.readOnly) {
        continue;
      }
      sampleData[propName] = this.generateSampleValueForProp(propName, propSchema, endpointName);
    }

    return sampleData;
  }

  /**
   * Generates a single sample value for a property.
   * @param {string} propName - The name of the property.
   * @param {object} propSchema - The schema for the property.
   * @param {string} endpointName - The current endpoint name for context
   * @returns {*} A sample value.
   */
  generateSampleValueForProp(propName, propSchema, endpointName = '') {
    if (propSchema.example !== undefined) return propSchema.example;
    if (propSchema.enum) return propSchema.enum[0];

    const { type, format } = propSchema;
    const lowerPropName = propName.toLowerCase();

    switch (type) {
      case 'string':
        if (format === 'email' || lowerPropName.includes('email')) return 'workflow.test@example.com';
        if (format === 'date') return '2025-01-01';
        if (format === 'date-time') return '2025-01-01T10:00:00Z';
        if (format === 'uuid') {
          // Detect foreign key relationships dynamically
          const foreignKeyInfo = this.detectForeignKeyRelationship(propName, propSchema, endpointName);
          if (foreignKeyInfo) {
            return `{{DYNAMIC_${foreignKeyInfo.targetEndpoint.toUpperCase()}_ID}}`;
          }
          return '123e4567-e89b-12d3-a456-426614174000';
        }
        if (format === 'password' || lowerPropName.includes('password')) return 'WorkflowTestPass123!';
        if (format === 'uri' || lowerPropName.includes('url')) return 'https://example.com/test';
        
        if (lowerPropName.includes('firstname') || lowerPropName.includes('first_name')) return 'Workflow';
        if (lowerPropName.includes('lastname') || lowerPropName.includes('last_name')) return 'TestUser';
        if (lowerPropName.includes('fullname') || lowerPropName.includes('full_name')) return 'Workflow TestUser';
        if (lowerPropName.includes('username')) return 'workflow_tester';
        if (lowerPropName.includes('title')) return 'Sample Workflow Title';
        if (lowerPropName.includes('description')) return 'This is a sample description generated for testing.';
        if (lowerPropName.includes('content')) return 'This is sample content for a test entry.';
        if (lowerPropName.includes('phone')) return '123-456-7890';
        if (lowerPropName.includes('address')) return '123 Test St, Sample City';
        if (lowerPropName.includes('city')) return 'Sample City';
        if (lowerPropName.includes('country')) return 'USA';
        if (lowerPropName.includes('zip') || lowerPropName.includes('postal')) return '12345';
        if (lowerPropName.includes('name')) return `Sample ${propName}`;
        
        return `test_${lowerPropName}`;

      case 'integer':
      case 'number':
        return propSchema.minimum !== undefined ? propSchema.minimum : 10;

      case 'boolean':
        return true;

      case 'array':
        if (propSchema.items) {
          return [this.generateSampleValueForProp(`${propName}_item`, propSchema.items, endpointName)];
        }
        return [];

      case 'object':
        return this.generateSampleData(propSchema, endpointName);

      default:
        return null;
    }
  }

  /**
   * Detects foreign key relationships based on property name patterns and OpenAPI spec
   * @param {string} propName - The property name
   * @param {object} propSchema - The property schema
   * @param {string} currentEndpoint - The current endpoint name
   * @returns {object|null} Foreign key relationship info or null
   */
  detectForeignKeyRelationship(propName, propSchema, currentEndpoint) {
    const lowerPropName = propName.toLowerCase();
    
    // Common foreign key patterns: authorId, userId, categoryId, etc.
    const fkPatterns = [
      /^(.+)id$/i,           // authorId -> author
      /^(.+)_id$/i,          // author_id -> author  
      /^id_(.+)$/i,          // id_author -> author
    ];

    for (const pattern of fkPatterns) {
      const match = propName.match(pattern);
      if (match && propSchema.format === 'uuid') {
        let targetResource = match[1].toLowerCase();
        
        // Handle special cases and common mappings
        const resourceMappings = {
          'author': 'users',     // authorId -> users endpoint
          'user': 'users',       // userId -> users endpoint  
          'owner': 'users',      // ownerId -> users endpoint
          'creator': 'users',    // creatorId -> users endpoint
          'category': 'categories',
          'tag': 'tags'
        };
        
        let targetEndpoint = resourceMappings[targetResource] || this.pluralize(targetResource);
        
        // Check if this endpoint exists in our parsed endpoints
        if (this.endpoints.has(targetEndpoint)) {
          return {
            sourceProperty: propName,
            targetEndpoint: targetEndpoint,
            targetResource: targetResource
          };
        }
      }
    }

    return null;
  }

  /**
   * Simple pluralization for common English words
   * @param {string} word - The singular word
   * @returns {string} The plural form
   */
  pluralize(word) {
    if (word.endsWith('y')) {
      return word.slice(0, -1) + 'ies';
    } else if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z') || 
               word.endsWith('ch') || word.endsWith('sh')) {
      return word + 'es';
    } else {
      return word + 's';
    }
  }

  /**
   * Generates CRUD workflows from the parsed endpoints.
   */
  generateWorkflows() {
    for (const [endpointName, endpoint] of this.endpoints) {
      // A full CRUD cycle requires at least GET (one), GET (list), POST, and DELETE
      const hasList = endpoint.operations.GET_COLLECTION;
      const hasGet = endpoint.operations.GET;
      const hasCreate = endpoint.operations.POST;
      const hasUpdate = endpoint.operations.PUT || endpoint.operations.PATCH;
      const hasDelete = endpoint.operations.DELETE;

      if (hasList && hasGet && hasCreate && hasDelete) {
        const singularName = this.getSingularName(endpointName);
        const contextVar = `created_${singularName}`;
        
        const createData = this.generateWorkflowSampleData(endpoint, 'POST', endpointName);
        const updateData = this.generateWorkflowSampleData(endpoint, hasUpdate ? (endpoint.operations.PUT ? 'PUT' : 'PATCH') : null, endpointName);

        const steps = [];

        // Dynamically detect and resolve foreign key dependencies
        const foreignKeyDeps = this.analyzeForeignKeyDependencies(createData);
        
        // Add pre-steps to fetch required foreign key data (deduplicated)
        const addedContextKeys = new Set();
        for (const dep of foreignKeyDeps) {
          const contextKey = `existing_${dep.targetEndpoint}`;
          if (!addedContextKeys.has(contextKey)) {
            steps.push({
              action: `list_${dep.targetEndpoint}`,
              description: `Get existing ${dep.targetEndpoint} for ${dep.sourceProperty} reference`,
              args: {
                saveToContext: contextKey
              }
            });
            addedContextKeys.add(contextKey);
          }
        }

        // 1. Create
        const createArgs = { saveToContext: contextVar, ...createData };
        
        // Add dynamic resolution flags for any foreign keys (deduplicated)
        if (foreignKeyDeps.length > 0) {
          // Remove duplicates based on marker
          const uniqueDeps = foreignKeyDeps.filter((dep, index, arr) => 
            arr.findIndex(d => d.marker === dep.marker) === index
          );
          createArgs._dynamicForeignKeys = uniqueDeps;
        }
        
        steps.push({
          action: `create_${singularName}`,
          description: `Create a new ${singularName}`,
          args: createArgs,
        });

        // 2. List
        steps.push({
          action: `list_${endpointName}`,
          description: `List all ${endpointName} to verify creation`,
        });
        
        // 3. Get single
        steps.push({
            action: `get_${singularName}`,
            description: `Get the created ${singularName} by ID`,
            args: { fromContext: contextVar }
        });

        // 4. Update
        if (hasUpdate && Object.keys(updateData).length > 1) { // check for more than just 'data'
          steps.push({
            action: `update_${singularName}`,
            description: `Update the created ${singularName}`,
            args: {
              fromContext: contextVar,
              ...updateData,
            },
          });
        }

        // 5. Delete
        steps.push({
          action: `delete_${singularName}`,
          description: `Delete the created ${singularName}`,
          args: { fromContext: contextVar },
        });

        this.workflows.set(`${endpointName}_crud_workflow`, {
          name: `${endpointName}_crud_workflow`,
          description: `Full CRUD workflow for the ${endpointName} endpoint.`,
          steps,
        });
      }
    }
  }

  /**
   * Analyze foreign key dependencies in the sample data
   * @param {object} sampleData - The generated sample data
   * @returns {Array} Array of foreign key dependency objects
   */
  analyzeForeignKeyDependencies(sampleData) {
    const dependencies = [];
    const dataStr = JSON.stringify(sampleData);
    
    // Find all dynamic foreign key markers
    const matches = dataStr.match(/\{\{DYNAMIC_(\w+)_ID\}\}/g) || [];
    
    for (const match of matches) {
      const targetEndpoint = match.match(/\{\{DYNAMIC_(\w+)_ID\}\}/)[1].toLowerCase();
      
      // Find the property name that contains this marker
      const findPropertyWithMarker = (obj, marker, path = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          if (typeof value === 'string' && value === marker) {
            return { property: key, path: currentPath };
          } else if (typeof value === 'object' && value !== null) {
            const result = findPropertyWithMarker(value, marker, currentPath);
            if (result) return result;
          }
        }
        return null;
      };

      const propertyInfo = findPropertyWithMarker(sampleData, match);
      if (propertyInfo) {
        dependencies.push({
          sourceProperty: propertyInfo.property,
          targetEndpoint: targetEndpoint,
          marker: match
        });
      }
    }

    return dependencies;
  }

  /**
   * Check if the data contains any dynamic foreign key placeholders
   * @param {object} data - The sample data
   * @returns {boolean} True if it needs dynamic foreign key resolution
   */
  needsForeignKeyResolution(data) {
    const dataStr = JSON.stringify(data);
    return /\{\{DYNAMIC_\w+_ID\}\}/.test(dataStr);
  }

  /**
   * Generates sample data for a workflow step.
   * @param {object} endpoint - The endpoint configuration.
   * @param {string} method - The HTTP method (e.g., 'POST', 'PUT').
   * @param {string} endpointName - The endpoint name for context.
   * @returns {object} An object containing the sample data.
   */
  generateWorkflowSampleData(endpoint, method, endpointName) {
    if (!method || !endpoint.operations[method]) {
      return {};
    }

    const operation = endpoint.operations[method];
    if (operation.requestBody) {
      const schema = this.extractSchemaFromRequestBody(operation.requestBody);
      if (schema) {
        const sampleData = this.generateSampleData(schema, endpointName);
        // Provide data both as a single object and as individual fields
        return {
          data: sampleData,
          ...sampleData,
        };
      }
    }
    return {};
  }

  /**
   * Converts a plural endpoint name to singular.
   * @param {string} name - The plural name.
   * @returns {string} The singular name.
   */
  getSingularName(name) {
    if (name.endsWith('s') && !name.endsWith('ss')) {
      return name.slice(0, -1);
    }
    // Add more sophisticated rules if needed
    return name;
  }
}
