/**
 * @fileoverview Command-line interface (CLI) argument parser for the server.
 */

export function parseArguments() {
  const args = process.argv.slice(2);
  const config = {
    openApiFile: null,
    configFile: './apibridge.config.json',
    verbose: false,
    port: null,
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',
    apiKey: process.env.API_KEY || ''
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--openapi':
      case '-o':
        config.openApiFile = args[++i];
        break;
      case '--config':
      case '-c':
        config.configFile = args[++i];
        break;
      case '--base-url':
      case '-b':
        config.baseUrl = args[++i];
        break;
      case '--api-key':
      case '-k':
        config.apiKey = args[++i];
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          showHelp();
          process.exit(1);
        }
        // Assume it's an OpenAPI file if no flag specified
        if (!config.openApiFile && (arg.endsWith('.yml') || arg.endsWith('.yaml') || arg.endsWith('.json'))) {
          config.openApiFile = arg;
        }
        break;
    }
  }

  return config;
}

function showHelp() {
  console.log(`
APIBridge MCP Server

Usage: node index.js [options] [openapi-file]

Options:
  -o, --openapi <file>     OpenAPI specification file (YAML or JSON)
  -c, --config <file>      Configuration file (default: apibridge.config.json)
  -b, --base-url <url>     Base URL for the API
  -k, --api-key <key>      API key for authentication
  -v, --verbose            Enable verbose logging
  -h, --help               Show this help message

Examples:
  node index.js                           # Use OpenAPI file from config
  node index.js api.yml                   # Use OpenAPI spec file
  node index.js --openapi api.yml         # Same as above
  node index.js --config custom.json     # Use custom config
  node index.js api.yml --verbose        # Enable verbose output

Configuration File:
  You can specify the OpenAPI file path in your config file:
  {
    "name": "My API",
    "openApiFile": "path/to/your/api.yml",
    "apiBaseUrl": "http://localhost:3000/api"
  }

Environment Variables:
  API_BASE_URL             Default base URL for the API
  API_KEY                  Default API key for authentication
`);
}
