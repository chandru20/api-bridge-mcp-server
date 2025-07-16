# Demo API Server for APIBridge

This directory contains a fully functional demo API server that implements the `sample-api.yml` OpenAPI specification. It provides a working backend for demonstrating the APIBridge MCP Server.

## Features

- **Complete API Implementation**: Implements all endpoints from `sample-api.yml`
- **In-Memory Data Store**: Uses Maps for fast, temporary data storage
- **Sample Data**: Pre-populated with users and posts for immediate testing
- **Full CRUD Operations**: Supports Create, Read, Update, Delete for users and posts
- **Validation**: Proper request validation and error responses
- **CORS Enabled**: Allows cross-origin requests for browser testing

## Quick Start

### 1. Install Dependencies

```bash
cd demo-api
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000` by default.

### 3. Test the API

```bash
# Health check
curl http://localhost:3000/health

# List users
curl http://localhost:3000/api/users

# List posts
curl http://localhost:3000/api/posts
```

## API Endpoints

### Core Endpoints
- `GET /health` - Server health check
- `GET /api` - API information

### Users
- `GET /api/users` - List all users (supports pagination with `?limit=10&offset=0`)
- `POST /api/users` - Create a new user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Posts
- `GET /api/posts` - List all posts (supports filtering with `?author=:userId&status=published`)
- `POST /api/posts` - Create a new post
- `GET /api/posts/:id` - Get post by ID
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

## Sample Data

The server initializes with:
- 2 sample users (John Doe, Jane Smith)
- 2 sample posts (one published, one draft)

## Testing with APIBridge MCP Server

1. Start the mock server:
   ```bash
   cd demo-api
   npm start
   ```

2. In another terminal, start the MCP server:
   ```bash
   cd ..
   node index.js demo-api/sample-api.yml
   ```

3. The MCP server will automatically discover and create tools for all the mock server endpoints!

## Environment Variables

- `PORT` - Server port (default: 3000)

## Development

```bash
# Start with auto-reload on changes
npm run dev
```

## Example Requests

### Create a User
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "username": "alice",
    "firstName": "Alice",
    "lastName": "Wonder",
    "password": "securepassword123"
  }'
```

### Create a Post
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My New Blog Post",
    "content": "This is the content of my blog post...",
    "status": "published",
    "authorId": "USER_ID_HERE",
    "tags": ["demo", "test"]
  }'
```

Replace `USER_ID_HERE` with an actual user ID from the `/api/users` endpoint.
