import dotenv from 'dotenv';
import http from 'http';
import { pathToFileURL } from 'url';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Import the handler function from the actual API file
// Use dynamic import() because api/index.js is an ES module
async function startServer() {
    const apiPath = path.resolve('api', 'process.js');
    const apiUrl = pathToFileURL(apiPath).href;
    const { default: handler } = await import(apiUrl);

    const PORT = process.env.PORT || 3001;
    http.createServer(handler).listen(PORT, () => {
        console.log(`[Dev API Server] Running handler from ${apiPath} on port ${PORT}`);
    });
}

startServer().catch(err => {
    console.error("[Dev API Server] Failed to start:", err);
    process.exit(1);
}); 