/**
 * File-based wallet storage for local MCP server
 */
import fs from 'fs';
import path from 'path';
import type { StoredWallet, WalletBase } from '@didcid/keymaster';

export default class WalletJson implements WalletBase {
  private dataFolder: string;
  private walletName: string;
  private _lock: Promise<void> = Promise.resolve();

  constructor(walletFileName = 'wallet.json', dataFolder = 'data') {
    this.dataFolder = dataFolder;
    this.walletName = path.join(dataFolder, walletFileName);
  }

  async saveWallet(wallet: StoredWallet, overwrite = false): Promise<boolean> {
    if (fs.existsSync(this.walletName) && !overwrite) {
      return false;
    }
    if (!fs.existsSync(this.dataFolder)) {
      fs.mkdirSync(this.dataFolder, { recursive: true });
    }
    fs.writeFileSync(this.walletName, JSON.stringify(wallet, null, 4));
    return true;
  }

  async loadWallet(): Promise<StoredWallet | null> {
    if (!fs.existsSync(this.walletName)) {
      return null;
    }
    const walletJson = fs.readFileSync(this.walletName, 'utf-8');
    return JSON.parse(walletJson);
  }

  async updateWallet(mutator: (wallet: StoredWallet) => void | Promise<void>): Promise<void> {
    // Simple lock implementation
    const release = this._lock;
    let resolve: () => void;
    this._lock = new Promise(r => { resolve = r; });
    
    await release;
    try {
      const wallet = await this.loadWallet();
      if (wallet) {
        await mutator(wallet);
        await this.saveWallet(wallet, true);
      }
    } finally {
      resolve!();
    }
  }
}
