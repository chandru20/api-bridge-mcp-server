# APIBridge Test Suite Documentation

This directory contains comprehensive test cases and sample APIs to validate the APIBridge MCP server's workflow generation capabilities. The test suite demonstrates how APIBridge handles different API patterns, domains, and complexities.

## Test Files Overview

### 1. Core Test Suite
- **`workflow-generator.test.js`**: Main test file with 4 comprehensive test suites
- **Purpose**: Validates workflow generation, error handling, utilities, and tool schema generation

### 2. Sample API Specifications

#### `../demo-api/sample-api.yml` - Original Demo API
- **Domain**: Multi-resource API (Users, Posts, Products)
- **Complexity**: Medium
- **Features**:
  - Complete CRUD operations for all resources
  - Foreign key relationships (`authorId` → Users)
  - Nested schemas with `$ref` references
  - Base schema inheritance using `allOf`
- **Generated Workflows**: `users_crud_workflow`, `posts_crud_workflow`, `products_crud_workflow`

#### `sample-ecommerce-api.yml` - E-commerce Management API
- **Domain**: E-commerce/Retail
- **Complexity**: High
- **Features**:
  - Complex nested relationships (Customers → Orders → Items → Inventory)
  - Multiple foreign key dependencies
  - Payment processing workflows
  - Analytics and reporting endpoints
  - Advanced query parameters and filtering
- **Generated Workflows**: `inventory_crud_workflow`
- **Use Case**: Tests complex business logic and multi-step workflows

#### `sample-library-api.yml` - Library Management System
- **Domain**: Education/Library Science
- **Complexity**: Medium-High
- **Features**:
  - Multiple resource dependencies (Books → Authors, Loans → Books + Borrowers)
  - Clear hierarchical relationships
  - Status-based workflows (loan management)
  - Pattern-based validation (ISBN, membership numbers)
- **Generated Workflows**: `books_crud_workflow`, `authors_crud_workflow`, `borrowers_crud_workflow`
- **Use Case**: Tests educational/institutional API patterns

#### `sample-healthcare-api.yml` - Healthcare Management API
- **Domain**: Healthcare/Medical
- **Complexity**: High
- **Features**:
  - HIPAA-compliant data structures
  - Complex medical record relationships
  - Appointment scheduling workflows
  - Sensitive data handling (confidential records)
  - Regulatory compliance patterns
- **Generated Workflows**: `patients_crud_workflow`, `appointments_crud_workflow`
- **Use Case**: Tests regulated industry patterns and data sensitivity

## Running Tests

### 1. Full Test Suite
Runs all internal tests with the demo API:
```bash
node test/workflow-generator.test.js
```

**What it tests:**
- ✅ Core workflow generation
- ✅ Error handling for invalid files
- ✅ Utility functions (naming, data generation)
- ✅ Tool schema validation

### 2. Individual API Testing
Test any specific OpenAPI specification:
```bash
# Test e-commerce API
node test/workflow-generator.test.js test/sample-ecommerce-api.yml

# Test library API
node test/workflow-generator.test.js test/sample-library-api.yml

# Test healthcare API
node test/workflow-generator.test.js test/sample-healthcare-api.yml

# Test your own API
node test/workflow-generator.test.js path/to/your-api.yml
```

### 3. Batch Testing
Test all sample APIs at once:
```bash
echo "=== Testing E-commerce API ===" && \
node test/workflow-generator.test.js test/sample-ecommerce-api.yml && \
echo -e "\n=== Testing Library API ===" && \
node test/workflow-generator.test.js test/sample-library-api.yml && \
echo -e "\n=== Testing Healthcare API ===" && \
node test/workflow-generator.test.js test/sample-healthcare-api.yml && \
echo -e "\n=== Testing Original Demo API ===" && \
node test/workflow-generator.test.js demo-api/sample-api.yml
```

## Test Coverage

### API Patterns Covered

1. **Simple CRUD Operations**
   - Basic Create, Read, Update, Delete
   - Path parameters and query parameters
   - Request/response body validation

2. **Foreign Key Relationships**
   - `authorId` → `users` (Posts to Users)
   - `patientId` → `patients` (Appointments to Patients)
   - `customerId` → `customers` (Orders to Customers)
   - `bookId` + `borrowerId` (Loans with multiple dependencies)

3. **Schema Patterns**
   - `$ref` references and schema reuse
   - `allOf` inheritance patterns
   - Nested object schemas
   - Array schemas with typed items

4. **Data Types and Formats**
   - UUID identifiers
   - Date/time fields
   - Email and URI formats
   - Enumerated values
   - Numeric fields with constraints

5. **HTTP Methods**
   - GET (list and individual)
   - POST (create)
   - PUT (full update)
   - PATCH (partial update)
   - DELETE (remove)

6. **Industry-Specific Patterns**
   - E-commerce: Inventory, payments, orders
   - Healthcare: Patient records, appointments, medical data
   - Library: Book lending, member management
   - General: User management, content publishing

### Error Scenarios Tested

1. **File System Errors**
   - Non-existent files
   - Unsupported file formats
   - Permission issues

2. **YAML/JSON Parsing Errors**
   - Malformed YAML syntax
   - Invalid JSON structure
   - Encoding issues

3. **OpenAPI Specification Errors**
   - Missing required fields
   - Invalid schema references
   - Broken `$ref` links

4. **Schema Validation Errors**
   - Invalid JSON Schema formats
   - Type mismatches
   - Missing required properties

## Extending the Test Suite

### Adding New Test APIs

1. **Create your API specification**:
   ```bash
   # Create in test/ directory
   touch test/sample-your-domain-api.yml
   ```

2. **Follow naming conventions**:
   - Use `sample-{domain}-api.yml` format
   - Include comprehensive CRUD operations
   - Add foreign key relationships for testing

3. **Test your API**:
   ```bash
   node test/workflow-generator.test.js test/sample-your-domain-api.yml
   ```

### Adding New Test Cases

1. **Edit `workflow-generator.test.js`**
2. **Add new test functions**:
   ```javascript
   async function testYourNewFeature() {
     console.log('\n🧪 Running Test Suite X: Your New Feature...');
     // Your test logic here
   }
   ```
3. **Call from main function**:
   ```javascript
   await testYourNewFeature();
   ```

## Best Practices for API Testing

### 1. Comprehensive Coverage
- Include all CRUD operations where applicable
- Test both simple and complex data relationships
- Cover edge cases (optional parameters, nested objects)

### 2. Real-World Patterns
- Use realistic domain models
- Include proper validation constraints
- Follow OpenAPI 3.0 best practices

### 3. Foreign Key Testing
- Include relationships between resources
- Test dependency resolution
- Validate workflow step ordering

### 4. Schema Validation
- Use proper data types and formats
- Include required field validation
- Test nested schema references

## Expected Output

### Successful Test Run
```
🔍 Validating user-provided OpenAPI file: test/sample-library-api.yml

🧪 Running Test Suite 1: Core Workflow Generation for test/sample-library-api.yml...
==================================================================

📊 API Parsing and Initial Setup:
✅ Successfully parsed OpenAPI specification and found endpoints.
✅ Successfully generated workflows.
✅ Found at least one endpoint.
✅ Generated at least one workflow.

🔍 Analyzing 'books_crud_workflow':
✅ Workflow 'books_crud_workflow' should have at least one step.
✅ CREATE step in 'books_crud_workflow' should have a 'data' object.

🔍 Analyzing 'authors_crud_workflow':
✅ Workflow 'authors_crud_workflow' should have at least one step.
✅ CREATE step in 'authors_crud_workflow' should have a 'data' object.

🔍 Analyzing 'borrowers_crud_workflow':
✅ Workflow 'borrowers_crud_workflow' should have at least one step.
✅ CREATE step in 'borrowers_crud_workflow' should have a 'data' object.

🎉🎉 OpenAPI specification appears to be valid and workflows were generated successfully! 🎉🎉
```

### Failed Test Run
```
❌ VALIDATION FAILED: Failed to parse OpenAPI spec: No paths found in OpenAPI specification
```

## Using Tests for Development

### 1. Validate Your API Design
Use the test suite to validate your OpenAPI specifications before implementation.

### 2. Test Workflow Generation
Ensure APIBridge can generate appropriate workflows for your API patterns.

### 3. Debug Issues
Use verbose output to understand how APIBridge processes your API:
```bash
node index.js your-api.yml --verbose
```

### 4. Baseline Testing
Use the sample APIs as baselines to understand expected patterns and structures.

## Support and Troubleshooting

### Common Issues

1. **No workflows generated**
   - Check that your API has proper CRUD endpoints
   - Ensure paths follow REST conventions
   - Verify schema references are valid

2. **Foreign key detection fails**
   - Use `{resource}Id` naming convention
   - Ensure referenced resources have CRUD endpoints
   - Check that schemas are properly defined

3. **Schema validation errors**
   - Validate your OpenAPI spec with online tools
   - Check for proper `$ref` syntax
   - Ensure all required fields are defined

### Getting Help

1. **Run the full test suite** to ensure base functionality works
2. **Test with sample APIs** to understand expected patterns
3. **Use verbose logging** to debug specific issues
4. **Check the logs directory** for detailed error information

---

## Summary

The APIBridge test suite provides comprehensive validation for:
- ✅ **Multi-domain API patterns** (E-commerce, Healthcare, Library, General)
- ✅ **Complex relationship handling** (Foreign keys, dependencies)
- ✅ **Schema validation** (Types, formats, constraints)
- ✅ **Error handling** (Invalid files, malformed specs)
- ✅ **Tool generation** (MCP-compatible schemas)

This ensures that APIBridge's foundation-first architecture works reliably across different domains and use cases, providing users with confidence that they can build upon these base workflows for their specific needs.
