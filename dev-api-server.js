import dotenv from 'dotenv';
import http from 'http';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url'; // Needed for __dirname in ESM

// Load environment variables from .env file
dotenv.config();

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;

// Function to dynamically import and cache handlers
const handlers = {};
async function getHandler(handlerName) {
    if (handlers[handlerName]) {
        return handlers[handlerName];
    }
    const apiPath = path.resolve(__dirname, 'api', `${handlerName}.js`);
    const apiUrl = pathToFileURL(apiPath).href;
    try {
        const module = await import(apiUrl);
        handlers[handlerName] = module.default; // Cache the handler
        console.log(`[Dev API Server] Loaded handler for '${handlerName}' from ${apiPath}`);
        return handlers[handlerName];
    } catch (err) {
        console.error(`[Dev API Server] Error importing handler '${handlerName}' from ${apiPath}:`, err);
        return null; // Return null if handler cannot be loaded
    }
}

http.createServer(async (req, res) => {
    console.log(`[Dev API Server] Received request: ${req.method} ${req.url}`);
    
    let handler = null;
    
    // Basic Routing
    if (req.url === '/api/process' && req.method === 'POST') {
        handler = await getHandler('process');
    } else if (req.url === '/api/music-tracks' && (req.method === 'GET' || req.method === 'OPTIONS')) {
        // Allow GET and OPTIONS for music tracks (needed for CORS preflight)
        handler = await getHandler('music-tracks');
    } 
    // Add more routes here if needed
    // else if (req.url === '/api/some-other-route') {
    //    handler = await getHandler('some-other-handler');
    // }

    if (handler) {
        try {
            await handler(req, res); // Call the dynamically loaded handler
        } catch (error) {
            console.error(`[Dev API Server] Error executing handler for ${req.method} ${req.url}:`, error);
            if (!res.writableEnded) { // Check if response hasn't already been sent
                 res.writeHead(500, { 'Content-Type': 'application/json' });
                 res.end(JSON.stringify({ success: false, error: 'Internal Server Error' }));
            }
        }
    } else {
        // Not Found
        console.log(`[Dev API Server] No handler found for ${req.method} ${req.url}`);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Not Found' }));
    }

}).listen(PORT, () => {
    console.log(`[Dev API Server] Listening on port ${PORT}. Ready to route requests.`);
});

// Basic error handling for the server itself (e.g., port already in use)
process.on('uncaughtException', (err) => {
  console.error('[Dev API Server] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Dev API Server] Unhandled Rejection at:', promise, 'reason:', reason);
}); 