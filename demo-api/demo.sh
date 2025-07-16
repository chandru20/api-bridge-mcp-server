#!/bin/bash

# Demo script for APIBridge MCP Server
# This script demonstrates the full workflow

echo "🚀 APIBridge MCP Server Demo"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi

# Check if curl is installed
if ! command -v curl &> /dev/null; then
    echo "❌ curl is not installed. Please install curl to run demo tests."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the demo-api directory."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo ""
echo "📦 Installing demo API server dependencies..."
cd ..
npm install
cd demo-api

echo ""
echo "🔧 Starting demo API server..."
echo "   The demo API server will run on http://localhost:3000"
echo "   You can test it by visiting: http://localhost:3000/health"
echo ""

# Remove existing demo database for a fresh start
if [ -f "./demo.db" ]; then
    echo "🗑 Removing existing demo database..."
    rm ./demo.db
fi
# Start demo API server in background
npm start &
MOCK_PID=$!
cd ..

# Wait for demo API server to start
echo "⏳ Waiting for demo API server to start..."
sleep 3

# Test if demo API server is running
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Demo API server is running successfully!"
else
    echo "❌ Demo API server failed to start. Check the logs above."
    kill $MOCK_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎯 Now you can test the MCP server with:"
echo "   node index.js demo-api/sample-api.yml"
echo ""
echo "📋 Available tools will include:"
echo "   - ping_api (test API health)"
echo "   - validate_api (comprehensive validation)"
echo "   - list_users, create_user, update_user, delete_user"
echo "   - list_posts, create_post, update_post, delete_post"
echo "   - run_workflow (execute CRUD workflows)"
echo "   - get_metrics (server statistics)"
echo ""
echo "🌐 Demo API endpoints:"
echo "   Health: http://localhost:3000/health"
echo "   Users:  http://localhost:3000/api/users"
echo "   Posts:  http://localhost:3000/api/posts"
echo ""
echo "🛑 Press Ctrl+C to stop the demo API server when done."
echo ""

# Keep script running and handle Ctrl+C
trap "echo ''; echo '🛑 Stopping demo API server...'; kill $MOCK_PID 2>/dev/null; echo '✅ Demo cleanup complete.'; exit 0" INT

# Wait for user to stop
while true; do
    sleep 1
done
