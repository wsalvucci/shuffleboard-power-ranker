#!/bin/bash

# Shuffleboard Power Ranker - Server Startup Script
# This script starts the Python HTTP server for the web application

echo "🚀 Starting Shuffleboard Power Ranker Server..."
echo "📍 Server will be available at: http://localhost:8000"
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed or not in PATH"
    echo "Please install Python 3 and try again."
    exit 1
fi

# Check if we're in the correct directory (look for key files)
if [ ! -f "index.html" ] || [ ! -f "script.js" ] || [ ! -f "storage.db" ]; then
    echo "❌ Error: Required files not found in current directory"
    echo "Please run this script from the shuffleboard-power-ranker directory"
    exit 1
fi

# Check if port 8000 is already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Warning: Port 8000 is already in use"
    echo "The server may not start properly."
    echo ""
fi

echo "🌐 Starting HTTP server on port 8000..."
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
python3 -m http.server 8000 