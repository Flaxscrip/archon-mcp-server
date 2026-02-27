#!/usr/bin/env node
/**
 * Stdio-to-HTTP bridge for remote MCP servers
 * Allows Claude Desktop to connect to remote MCP servers via local stdio
 */

import * as https from 'https';
import * as http from 'http';

const MCP_URL = process.env.MCP_URL || 'https://archon.technology/mcp';
const url = new URL(MCP_URL);

let sessionId: string | null = null;
let pendingRequests = 0;
let stdinClosed = false;

function parseSSE(data: string): any[] {
  const events: any[] = [];
  for (const line of data.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        events.push(JSON.parse(line.slice(6)));
      } catch {}
    }
  }
  return events;
}

function checkExit() {
  if (stdinClosed && pendingRequests === 0) {
    process.exit(0);
  }
}

function sendRequest(data: any): Promise<any[]> {
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  };
  
  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  pendingRequests++;
  
  return new Promise((resolve, reject) => {
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers
    }, (res) => {
      const newSessionId = res.headers['mcp-session-id'];
      if (newSessionId && typeof newSessionId === 'string') {
        sessionId = newSessionId;
      }
      
      const contentType = res.headers['content-type'] || '';
      let body = '';
      
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        pendingRequests--;
        
        if (!body.trim()) {
          resolve([]);
          return;
        }
        
        if (contentType.includes('text/event-stream')) {
          resolve(parseSSE(body));
        } else {
          try {
            resolve([JSON.parse(body)]);
          } catch {
            resolve([]);
          }
        }
      });
    });
    
    req.on('error', (err) => {
      pendingRequests--;
      reject(err);
    });
    
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function processLine(line: string): Promise<void> {
  if (!line.trim()) return;
  
  try {
    const request = JSON.parse(line);
    const responses = await sendRequest(request);
    
    for (const response of responses) {
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${errorMsg}\n`);
  } finally {
    checkExit();
  }
}

process.stderr.write(`Archon MCP Bridge - ${MCP_URL}\n`);

let buffer = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    processLine(line);
  }
});

process.stdin.on('end', () => {
  if (buffer.trim()) {
    processLine(buffer);
  }
  stdinClosed = true;
  checkExit();
});
