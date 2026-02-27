# Archon MCP Server

**Self-sovereign identity for AI agents.** Give Claude Desktop (and any MCP-compatible AI) its own decentralized identity.

[![npm version](https://badge.fury.io/js/@archon-protocol%2Fmcp-server.svg)](https://www.npmjs.com/package/@archon-protocol/mcp-server)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## What is this?

This MCP server gives AI agents like Claude Desktop:

- 🔐 **Their own DID** (Decentralized Identifier)
- 📬 **Encrypted messaging** (DMail)
- 🎫 **Verifiable credentials** (issue, hold, present)
- 🔑 **Local wallet** (keys never leave your machine)

No API keys to leak. No central server dependency. Just cryptographic proof of identity.

## Quick Start

### 1. Add to Claude Desktop config

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "archon": {
      "command": "npx",
      "args": ["@archon-protocol/mcp-server"],
      "env": {
        "ARCHON_PASSPHRASE": "your-secure-passphrase"
      }
    }
  }
}
```

### 2. Restart Claude Desktop

### 3. Ask Claude to create your identity

> "Create a new identity called 'my-agent'"

That's it! Your wallet is stored at `~/.archon-mcp/wallet.json`.

## Available Tools

| Tool | Description |
|------|-------------|
| `wallet_status` | Check wallet exists and current identity |
| `create_wallet` | Create or load wallet |
| `create_id` | Create a new DID identity |
| `list_ids` | List all identities in wallet |
| `get_current_id` | Get active identity DID |
| `set_current_id` | Switch active identity |
| `resolve_did` | Resolve any DID to its document |
| `send_dmail` | Send encrypted message |
| `list_dmail` | List inbox messages |
| `read_dmail` | Read a specific message |
| `create_challenge` | Challenge for credential verification |
| `create_response` | Respond to a challenge |
| `verify_response` | Verify a challenge response |
| `list_credentials` | List held credentials |
| `get_credential` | Get credential details |
| `accept_credential` | Accept a received credential |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `ARCHON_PASSPHRASE` | `changeme` | Wallet encryption passphrase |
| `ARCHON_WALLET_DIR` | `~/.archon-mcp` | Wallet storage directory |
| `ARCHON_WALLET_FILE` | `wallet.json` | Wallet filename |
| `GATEKEEPER_URL` | `https://archon.technology` | DID resolution endpoint |
| `ARCHON_REGISTRY` | `hyperswarm` | Default DID registry |

## Example: Two AIs Messaging

```
You: "Send a dmail to did:cid:bagaaiera... with subject 'Hello' and body 'Hi from Claude!'"

Claude: "DMail sent successfully! 
         DID: did:cid:bagaaieray62yhos..."
```

The recipient (another AI or human with an Archon wallet) can decrypt and read the message.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude Desktop │────▶│  Archon MCP      │────▶│  Gatekeeper API │
│                 │     │  (local process) │     │  (DID resolution)│
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  ~/.archon-mcp/  │
                        │  wallet.json     │
                        │  (local storage) │
                        └──────────────────┘
```

- **All cryptographic operations happen locally**
- **Private keys never leave your machine**
- **Only DID resolution requires network calls**

## Why Archon?

AI agents need identity. Without it:
- ❌ API keys get leaked (see: Moltbook, Feb 2026)
- ❌ No way to verify who an agent is
- ❌ No encrypted communication between agents
- ❌ No credential-based access control

With Archon:
- ✅ Each agent has a cryptographic identity
- ✅ Encrypted messaging between agents
- ✅ Verifiable credentials for authorization
- ✅ Self-sovereign (no central authority)

## Links

- [Archon Protocol](https://archon.technology)
- [Documentation](https://docs.archon.technology)
- [GitHub](https://github.com/archetech/archon)
- [Discord](https://discord.gg/archon)

## License

Apache-2.0 © [Archetech](https://archetech.com)
