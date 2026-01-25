#!/usr/bin/env node
/**
 * ServalSheets Live Dashboard Server
 *
 * Serves the live monitoring dashboard with real-time log updates.
 * Usage: node scripts/serve-dashboard.js
 */

import { createServer } from 'http';
import { readFileSync, statSync, createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3333;

// Log file location
const LOG_FILE = join(homedir(), 'Library/Logs/Claude/mcp-server-ServalSheets.log');

// HTML file location
const HTML_FILE = join(__dirname, 'live-dashboard.html');

const server = createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/') {
    // Serve HTML
    try {
      const html = readFileSync(HTML_FILE, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (err) {
      res.writeHead(500);
      res.end('Error loading dashboard');
    }
  } else if (req.url === '/logs') {
    // Serve log file (last 500 lines)
    try {
      const stats = statSync(LOG_FILE);
      const CHUNK_SIZE = 100000; // ~100KB from end

      if (stats.size > CHUNK_SIZE) {
        // Read last chunk
        const stream = createReadStream(LOG_FILE, {
          start: stats.size - CHUNK_SIZE,
          end: stats.size
        });

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        stream.pipe(res);
      } else {
        const content = readFileSync(LOG_FILE, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(content);
      }
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('No logs available yet');
    }
  } else if (req.url === '/stream') {
    // SSE stream for real-time updates
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    let lastSize = 0;
    try {
      lastSize = statSync(LOG_FILE).size;
    } catch {}

    const interval = setInterval(() => {
      try {
        const stats = statSync(LOG_FILE);
        if (stats.size > lastSize) {
          const stream = createReadStream(LOG_FILE, {
            start: lastSize,
            end: stats.size
          });

          let data = '';
          stream.on('data', chunk => data += chunk);
          stream.on('end', () => {
            if (data) {
              res.write(`data: ${JSON.stringify({ content: data })}\n\n`);
            }
          });

          lastSize = stats.size;
        }
      } catch {}
    }, 200);

    req.on('close', () => clearInterval(interval));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         ServalSheets Live Dashboard                          ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║   Dashboard: http://localhost:${PORT}                           ║
║   Log file:  ${LOG_FILE.slice(0, 45)}...                     ║
║                                                               ║
║   Press Ctrl+C to stop                                        ║
╚═══════════════════════════════════════════════════════════════╝
`);
});
