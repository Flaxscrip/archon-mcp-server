#!/usr/bin/env node
/**
 * Local MCP Server for Archon Protocol
 * Self-sovereign identity for AI agents - wallet stored locally
 */

import dotenv from 'dotenv';
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

import Keymaster from '@didcid/keymaster';
import GatekeeperClient from '@didcid/gatekeeper/client';
import CipherNode from '@didcid/cipher/node';
import WalletJson from './wallet-json.js';
import path from 'path';
import os from 'os';

// Configuration
const WALLET_DIR = process.env.ARCHON_WALLET_DIR || path.join(os.homedir(), '.archon-mcp');
const WALLET_FILE = process.env.ARCHON_WALLET_FILE || 'wallet.json';
const GATEKEEPER_URL = process.env.ARCHON_GATEKEEPER_URL || process.env.GATEKEEPER_URL || 'https://archon.technology';
const PASSPHRASE = process.env.ARCHON_PASSPHRASE || 'changeme';
const DEFAULT_REGISTRY = process.env.ARCHON_REGISTRY || 'hyperswarm';

const SERVER_NAME = "archon-mcp-local";
const SERVER_VERSION = "0.1.0";

// Global keymaster instance
let keymaster: Keymaster;

// Tool definitions
const tools: Tool[] = [
  {
    name: "wallet_status",
    description: "Check if a wallet exists and get current identity info",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "create_wallet",
    description: "Create a new wallet (or load existing). Returns wallet info.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "create_id", 
    description: "Create a new DID identity with a name",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name/alias for the identity" }
      },
      required: ["name"]
    }
  },
  {
    name: "list_ids",
    description: "List all identities in the wallet",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_current_id",
    description: "Get the currently active identity DID",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "set_current_id",
    description: "Set the active identity by name",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the identity to make active" }
      },
      required: ["name"]
    }
  },
  {
    name: "resolve_did",
    description: "Resolve a DID to its document",
    inputSchema: {
      type: "object",
      properties: {
        did: { type: "string", description: "The DID to resolve" }
      },
      required: ["did"]
    }
  },
  {
    name: "send_dmail",
    description: "Send an encrypted message (DMail) to a DID",
    inputSchema: {
      type: "object",
      properties: {
        to: { 
          type: "array", 
          items: { type: "string" },
          description: "Array of recipient DIDs" 
        },
        subject: { type: "string", description: "Message subject" },
        body: { type: "string", description: "Message body" }
      },
      required: ["to", "subject", "body"]
    }
  },
  {
    name: "list_dmail",
    description: "List all DMail messages in inbox",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "read_dmail",
    description: "Read a specific DMail message",
    inputSchema: {
      type: "object",
      properties: {
        did: { type: "string", description: "DID of the DMail message" }
      },
      required: ["did"]
    }
  },
  {
    name: "create_challenge",
    description: "Create a credential challenge to verify someone's credentials",
    inputSchema: {
      type: "object",
      properties: {
        credentials: {
          type: "array",
          items: {
            type: "object",
            properties: {
              schema: { type: "string", description: "Schema DID (optional)" },
              issuers: { 
                type: "array", 
                items: { type: "string" },
                description: "Accepted issuer DIDs (optional)"
              }
            }
          },
          description: "Credential requirements"
        },
        callback: { type: "string", description: "Callback URL for response (optional)" }
      }
    }
  },
  {
    name: "create_response",
    description: "Respond to a credential challenge",
    inputSchema: {
      type: "object",
      properties: {
        challengeDid: { type: "string", description: "DID of the challenge to respond to" }
      },
      required: ["challengeDid"]
    }
  },
  {
    name: "verify_response",
    description: "Verify a challenge response",
    inputSchema: {
      type: "object",
      properties: {
        responseDid: { type: "string", description: "DID of the response to verify" }
      },
      required: ["responseDid"]
    }
  },
  {
    name: "list_credentials",
    description: "List credentials held by current identity",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_credential",
    description: "Get details of a specific credential",
    inputSchema: {
      type: "object",
      properties: {
        did: { type: "string", description: "DID of the credential" }
      },
      required: ["did"]
    }
  },
  {
    name: "accept_credential",
    description: "Accept a credential that was sent to you",
    inputSchema: {
      type: "object",
      properties: {
        did: { type: "string", description: "DID of the credential to accept" }
      },
      required: ["did"]
    }
  }
];

// Tool handler
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    switch (name) {
      case "wallet_status": {
        try {
          const wallet = await keymaster.loadWallet();
          const currentId = await keymaster.getCurrentId();
          const ids = await keymaster.listIds();
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                exists: true,
                currentId,
                identityCount: ids.length,
                walletPath: path.join(WALLET_DIR, WALLET_FILE)
              }, null, 2)
            }]
          };
        } catch {
          return {
            content: [{
              type: "text", 
              text: JSON.stringify({
                exists: false,
                walletPath: path.join(WALLET_DIR, WALLET_FILE),
                message: "No wallet found. Use create_wallet to create one."
              }, null, 2)
            }]
          };
        }
      }

      case "create_wallet": {
        const wallet = await keymaster.loadWallet();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "Wallet ready",
              walletPath: path.join(WALLET_DIR, WALLET_FILE),
              wallet: {
                ...wallet,
                seed: "[REDACTED]" // Don't expose seed
              }
            }, null, 2)
          }]
        };
      }

      case "create_id": {
        const name = args.name as string;
        const did = await keymaster.createId(name);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ name, did, message: `Identity '${name}' created` }, null, 2)
          }]
        };
      }

      case "list_ids": {
        const ids = await keymaster.listIds();
        const currentId = await keymaster.getCurrentId();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ ids, currentId }, null, 2)
          }]
        };
      }

      case "get_current_id": {
        const currentId = await keymaster.getCurrentId();
        if (!currentId) {
          return {
            content: [{ type: "text", text: "No current identity set" }],
            isError: true
          };
        }
        const info = await keymaster.fetchIdInfo(currentId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(info, null, 2)
          }]
        };
      }

      case "set_current_id": {
        const name = args.name as string;
        await keymaster.setCurrentId(name);
        const currentId = await keymaster.getCurrentId();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ message: `Current identity set to '${name}'`, did: currentId }, null, 2)
          }]
        };
      }

      case "resolve_did": {
        const did = args.did as string;
        const doc = await keymaster.resolveDID(did);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(doc, null, 2)
          }]
        };
      }

      case "send_dmail": {
        const to = args.to as string[];
        const subject = args.subject as string;
        const body = args.body as string;
        
        const message = { to, cc: [], subject, body };
        const verifiedMessage = await keymaster.verifyDmail(message);
        const dmailDid = await keymaster.createDmail(verifiedMessage);
        const sentDid = await keymaster.sendDmail(dmailDid);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ 
              message: "DMail sent successfully",
              dmailDid,
              sentDid,
              recipients: to
            }, null, 2)
          }]
        };
      }

      case "list_dmail": {
        const dmail = await keymaster.listDmail();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(dmail, null, 2)
          }]
        };
      }

      case "read_dmail": {
        const did = args.did as string;
        const message = await keymaster.getDmailMessage(did);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(message, null, 2)
          }]
        };
      }

      case "create_challenge": {
        const rawCredentials = args.credentials as Array<{schema?: string; issuers?: string[]}> || [];
        const callback = args.callback as string | undefined;
        
        // Filter out credentials without schema (required field)
        const credentials = rawCredentials
          .filter(c => c.schema)
          .map(c => ({ schema: c.schema as string, issuers: c.issuers }));
        
        const challenge: Record<string, unknown> = {};
        if (credentials.length > 0) challenge.credentials = credentials;
        if (callback) challenge.callback = callback;
        
        const challengeDid = await keymaster.createChallenge(challenge as any);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ challengeDid, challenge }, null, 2)
          }]
        };
      }

      case "create_response": {
        const challengeDid = args.challengeDid as string;
        const responseDid = await keymaster.createResponse(challengeDid);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ responseDid, challengeDid }, null, 2)
          }]
        };
      }

      case "verify_response": {
        const responseDid = args.responseDid as string;
        const result = await keymaster.verifyResponse(responseDid);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case "list_credentials": {
        const credentials = await keymaster.listCredentials();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ credentials }, null, 2)
          }]
        };
      }

      case "get_credential": {
        const did = args.did as string;
        const credential = await keymaster.getCredential(did);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(credential, null, 2)
          }]
        };
      }

      case "accept_credential": {
        const did = args.did as string;
        await keymaster.acceptCredential(did);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ message: "Credential accepted", did }, null, 2)
          }]
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true
    };
  }
}

async function main() {
  // Initialize wallet storage
  const wallet = new WalletJson(WALLET_FILE, WALLET_DIR);
  
  // Initialize gatekeeper client for DID resolution
  const gatekeeper = new GatekeeperClient();
  await gatekeeper.connect({
    url: GATEKEEPER_URL,
    waitUntilReady: true,
    intervalSeconds: 3,
    chatty: false,
    becomeChattyAfter: 2
  });
  
  // Initialize cipher for encryption
  const cipher = new CipherNode();
  
  // Initialize keymaster
  keymaster = new Keymaster({
    gatekeeper,
    wallet,
    cipher,
    defaultRegistry: DEFAULT_REGISTRY,
    passphrase: PASSPHRASE
  });

  // Create MCP server
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  // Register handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(request.params.name, request.params.arguments || {});
  });

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
  console.error(`Wallet: ${path.join(WALLET_DIR, WALLET_FILE)}`);
  console.error(`Gatekeeper: ${GATEKEEPER_URL}`);
}

// Cleanup
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
