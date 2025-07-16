#!/usr/bin/env node

/**
 * @fileoverview Comprehensive test suite for the OpenAPI parser and workflow generator.
 * It covers successful workflow generation, error handling, utility functions, and edge cases.
 * Can also be used as a standalone validator for a user-provided OpenAPI specification.
 */

import { OpenAPIParser } from '../src/services/openapi-parser.js';
import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';

const testDir = path.resolve('./test');

// #region Test Helpers
/**
 * A simple assertion helper to make tests more readable.
 */
function check(condition, message) {
  try {
    assert.ok(condition, message);
    console.log(`✅ ${message}`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    throw error; // Re-throw to fail the test suite
  }
}

/**
 * Checks if an async function throws an expected error.
 */
async function checkThrows(asyncFn, expectedErrorMessage, description) {
  try {
    await asyncFn();
    const failMessage = `❌ ${description} (Expected to throw, but did not)`;
    console.error(failMessage);
    throw new Error(failMessage);
  } catch (error) {
    if (error.message.includes(expectedErrorMessage)) {
      console.log(`✅ ${description}`);
    } else {
      const failMessage = `❌ ${description} (Threw unexpected error: ${error.message})`;
      console.error(failMessage);
      throw new Error(failMessage);
    }
  }
}
// #endregion

// #region Test Suites

/**
 * Test Suite 1: Core workflow generation with a valid OpenAPI spec.
 * @param {string} filePath - The path to the OpenAPI file to test.
 */
async function testSuccessfulWorkflowGeneration(filePath) {
  console.log(`\n🧪 Running Test Suite 1: Core Workflow Generation for ${filePath}...`);
  console.log('==================================================================\n');
  const parser = new OpenAPIParser();
  const config = await parser.parseFromFile(filePath);

  console.log('📊 API Parsing and Initial Setup:');
  check(config.endpoints, 'Successfully parsed OpenAPI specification and found endpoints.');
  check(config.workflows, 'Successfully generated workflows.');
  check(Object.keys(config.endpoints).length > 0, 'Found at least one endpoint.');
  check(Object.keys(config.workflows).length > 0, 'Generated at least one workflow.');

  // Generic checks for any valid workflow
  for (const workflowName in config.workflows) {
    console.log(`\n🔍 Analyzing '${workflowName}':`);
    const workflow = config.workflows[workflowName];
    check(workflow.steps.length > 0, `Workflow '${workflowName}' should have at least one step.`);
    const createStep = workflow.steps.find(s => s.action.startsWith('create'));
    if (createStep) {
      check(createStep.args.data, `CREATE step in '${workflowName}' should have a 'data' object.`);
    }
  }
}

/**
 * Test Suite 2: Error handling for invalid inputs.
 */
async function testErrorHandling() {
  console.log('\n🧪 Running Test Suite 2: Error Handling...');
  console.log('============================================\n');
  const parser = new OpenAPIParser();

  await checkThrows(
    () => parser.parseFromFile('./non-existent-file.yml'),
    'Failed to parse OpenAPI spec',
    'Should throw an error for a non-existent file.'
  );

  const tempTxtFile = path.join(testDir, 'test.txt');
  await fs.writeFile(tempTxtFile, 'hello world');
  await checkThrows(
    () => parser.parseFromFile(tempTxtFile),
    'Unsupported file format: .txt',
    'Should throw an error for an unsupported file extension.'
  );
  await fs.unlink(tempTxtFile);

  const malformedYmlFile = path.join(testDir, 'malformed.yml');
  await fs.writeFile(malformedYmlFile, 'key: value:\n  nested: oops');
  await checkThrows(
    () => parser.parseFromFile(malformedYmlFile),
    'Failed to parse OpenAPI spec',
    'Should throw an error for a malformed YAML file.'
  );
  await fs.unlink(malformedYmlFile);
  
  const noPathsFile = path.join(testDir, 'no-paths.yml');
  await fs.writeFile(noPathsFile, 'openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0');
  await checkThrows(
    () => parser.parseFromFile(noPathsFile),
    'No paths found in OpenAPI specification',
    'Should throw an error for a spec with no paths.'
  );
  await fs.unlink(noPathsFile);
}

/**
 * Test Suite 3: Coverage for utility functions and edge cases.
 */
async function testUtilitiesAndEdgeCases() {
  console.log('\n🧪 Running Test Suite 3: Utilities and Edge Cases...');
  console.log('=====================================================\n');
  const parser = new OpenAPIParser();

  // Test getSingularName
  check(parser.getSingularName('users') === 'user', 'getSingularName should correctly singularize "users".');
  check(parser.getSingularName('posts') === 'post', 'getSingularName should correctly singularize "posts".');
  check(parser.getSingularName('address') === 'address', 'getSingularName should not change non-plural word.');

  // Test generateOperationId
  check(
    parser.generateOperationId('get', '/users') === 'list_users',
    `generateOperationId should produce 'list_users' for GET /users.`
  );
  check(
    parser.generateOperationId('post', '/users') === 'create_users', // Note: naive singularization doesn't apply here
    `generateOperationId should produce 'create_users' for POST /users.`
  );
  check(
    parser.generateOperationId('get', '/users/{userId}') === 'get_user',
    `generateOperationId should produce 'get_user' for GET /users/{userId}.`
  );

  // Test data generation edge cases
  const edgeCaseSchema = {
    type: 'object',
    properties: {
      isActive: { type: 'boolean' },
      values: { type: 'array', items: { type: 'integer' } },
      config: { type: 'object', properties: { setting: { type: 'string' } } },
      defaultValue: { type: 'string' } // No format or special name
    }
  };
  const sampleData = parser.generateSampleData(edgeCaseSchema);
  check(typeof sampleData.isActive === 'boolean', 'generateSampleData should create boolean values.');
  check(Array.isArray(sampleData.values), 'generateSampleData should create array values.');
  check(typeof sampleData.values[0] === 'number', 'generateSampleData should create correct array item types.');
  check(typeof sampleData.config === 'object', 'generateSampleData should create nested object values.');
  check(sampleData.defaultValue === 'test_defaultvalue', 'generateSampleData should handle default string cases.');
}

/**
 * Test Suite 4: Tool schema generation validation.
 * This suite specifically tests the JSON schema generation for MCP tools to catch 
 * invalid schema structures that would cause MCP server startup failures.
 */
async function testToolSchemaGeneration() {
  console.log('\n🧪 Running Test Suite 4: Tool Schema Generation...');
  console.log('==================================================\n');
  
  // Import ToolManager to test schema generation
  const { ToolManager } = await import('../src/tools/tool-manager.js');
  const parser = new OpenAPIParser();
  
  // Parse a sample API to get endpoints
  const config = await parser.parseFromFile('./demo-api/sample-api.yml');
  
  const toolManager = new ToolManager();
  toolManager.initialize(config, null, null);
  
  // Generate all tools and validate their schemas
  const tools = await toolManager.generateTools(config);
  
  check(tools.length > 0, 'Should generate at least one tool.');
  
  for (const tool of tools) {
    console.log(`\n🔍 Validating tool: ${tool.name}`);
    
    // Basic tool structure validation
    check(tool.name && typeof tool.name === 'string', `Tool ${tool.name} should have a valid name.`);
    check(tool.description && typeof tool.description === 'string', `Tool ${tool.name} should have a description.`);
    check(tool.inputSchema && typeof tool.inputSchema === 'object', `Tool ${tool.name} should have an inputSchema.`);
    
    // Schema structure validation
    const schema = tool.inputSchema;
    check(schema.type === 'object', `Tool ${tool.name} schema should have type 'object'.`);
    check(schema.properties && typeof schema.properties === 'object', `Tool ${tool.name} schema should have properties object.`);
    
    // Validate each property in the schema
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      validateSchemaProperty(tool.name, propName, propSchema);
    }
    
    // Check for the specific issues that were causing validation errors
    checkForSchemaIssues(tool.name, schema);
  }
}

/**
 * Recursively validate a schema property to ensure it's a valid JSON Schema.
 */
function validateSchemaProperty(toolName, propName, propSchema) {
  check(
    propSchema && typeof propSchema === 'object', 
    `Tool ${toolName} property ${propName} should be an object.`
  );
  
  // Check that type is a string, not an object
  if (propSchema.type !== undefined) {
    check(
      typeof propSchema.type === 'string', 
      `Tool ${toolName} property ${propName} type should be a string, got ${typeof propSchema.type}.`
    );
  }
  
  // Check that description is a string, not an object
  if (propSchema.description !== undefined) {
    check(
      typeof propSchema.description === 'string', 
      `Tool ${toolName} property ${propName} description should be a string, got ${typeof propSchema.description}.`
    );
  }
  
  // Check that required is an array, not a string
  if (propSchema.required !== undefined) {
    check(
      Array.isArray(propSchema.required), 
      `Tool ${toolName} property ${propName} required should be an array, got ${typeof propSchema.required}.`
    );
  }
  
  // Check that properties is an object (if it exists)
  if (propSchema.properties !== undefined) {
    check(
      typeof propSchema.properties === 'object' && !Array.isArray(propSchema.properties), 
      `Tool ${toolName} property ${propName} properties should be an object, got ${typeof propSchema.properties}.`
    );
    
    // Recursively validate nested properties
    for (const [nestedName, nestedSchema] of Object.entries(propSchema.properties)) {
      validateSchemaProperty(toolName, `${propName}.${nestedName}`, nestedSchema);
    }
  }
  
  // Check additionalProperties
  if (propSchema.additionalProperties !== undefined) {
    check(
      typeof propSchema.additionalProperties === 'boolean' || typeof propSchema.additionalProperties === 'object',
      `Tool ${toolName} property ${propName} additionalProperties should be boolean or object, got ${typeof propSchema.additionalProperties}.`
    );
  }
}

/**
 * Check for specific schema issues that were causing the original validation errors.
 */
function checkForSchemaIssues(toolName, schema) {
  // Look for the specific pattern that was causing issues:
  // Properties that have nested schema objects directly embedded
  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    // Check if this property looks like it has an embedded schema object
    if (propSchema.type && typeof propSchema.type === 'object') {
      throw new Error(`Tool ${toolName} property ${propName} has invalid embedded schema - type should not be an object.`);
    }
    
    if (propSchema.required && typeof propSchema.required === 'string') {
      throw new Error(`Tool ${toolName} property ${propName} has invalid required field - should be array, not string.`);
    }
    
    if (propSchema.properties && typeof propSchema.properties !== 'object') {
      throw new Error(`Tool ${toolName} property ${propName} has invalid properties field - should be object.`);
    }
  }
  
  console.log(`  ✅ Tool ${toolName} schema validation passed.`);
}

// #endregion

/**
 * Main test runner function.
 */
async function main() {
  const userFilePath = process.argv[2];

  if (userFilePath) {
    // If a file path is provided, run only the core generation test on that file.
    console.log(`\n🔍 Validating user-provided OpenAPI file: ${userFilePath}`);
    try {
      await testSuccessfulWorkflowGeneration(userFilePath);
      console.log('\n🎉🎉 OpenAPI specification appears to be valid and workflows were generated successfully! 🎉🎉\n');
    } catch (error) {
      console.error(`\n❌ VALIDATION FAILED: ${error.message}`);
      process.exit(1);
    }
  } else {
    // If no file path is provided, run the full internal test suite.
    try {
      await testSuccessfulWorkflowGeneration('./demo-api/sample-api.yml');
      await testErrorHandling();
      await testUtilitiesAndEdgeCases();
      await testToolSchemaGeneration();
      console.log('\n🎉🎉 All internal test suites passed successfully! 🎉🎉\n');
    } catch (error) {
      console.error(`\n❌ TEST SUITE FAILED: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

main();