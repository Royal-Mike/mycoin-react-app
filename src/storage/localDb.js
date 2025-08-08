import { keccak_256 } from 'js-sha3';

const DB_KEY = 'mycoin_db_21127561';

export function makeEmptyDb() {
  return {
    version: 1,
    createdAt: Date.now(),
    wallet: null,            // { address, path, publicKey, privateKey, mnemonic }
    accounts: {},            // address -> { balance }
    chain: {
      height: 0,
      blocks: [],            // [{ index, prevHash, timestamp, nonce, txs, hash }]
      mempool: [],           // [{ from, to, amount, nonce, signature? }]
      reward: 50,            // block reward (toy)
      difficulty: 2          // PoW difficulty (# of leading hex zeros)
    }
  };
}

function load() {
  const raw = localStorage.getItem(DB_KEY);
  return raw ? JSON.parse(raw) : makeEmptyDb();
}
function save(db) {
	localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function initDbIfMissing() {
  if (!localStorage.getItem(DB_KEY)) save(makeEmptyDb());
}

export function setWallet(wallet) {
  const db = load();
  db.wallet = wallet; // store plaintext (mock)
  if (!db.accounts[wallet.address]) db.accounts[wallet.address] = { balance: 0 };
  save(db);
  return db.wallet;
}
export function getWallet() { return load().wallet; }

export function getBalance(address) {
  const db = load();
  return db.accounts[address]?.balance ?? 0;
}
export function credit(address, amount) {
  const db = load();
  db.accounts[address] ??= { balance: 0 };
  db.accounts[address].balance += amount;
  save(db);
}
export function debit(address, amount) {
  const db = load();
  db.accounts[address] ??= { balance: 0 };
  if (db.accounts[address].balance < amount) throw new Error('Insufficient balance');
  db.accounts[address].balance -= amount;
  save(db);
}

export function addToMempool(tx) {
  const db = load();
  // Minimal validation (mock): numbers & addresses exist
  if (!tx.from || !tx.to || !(tx.amount > 0)) throw new Error('Bad tx');
  tx.nonce ??= Date.now();
  db.chain.mempool.push(tx);
  save(db);
}

export function mineBlock(minerAddress) {
  const db = load();
  const tip = db.chain.blocks.at(-1);
  const prevHash = tip ? tip.hash : '0'.repeat(64);

  // Snapshot mempool and apply to a temp state to validate balances
  const txs = db.chain.mempool.slice();
  const balances = new Map(Object.entries(db.accounts).map(([a, v]) => [a, v.balance]));
  const safeGet = (a) => balances.get(a) ?? 0;
  for (const tx of txs) {
    if (safeGet(tx.from) < tx.amount) throw new Error(`Insufficient funds for ${tx.from}`);
    balances.set(tx.from, safeGet(tx.from) - tx.amount);
    balances.set(tx.to, safeGet(tx.to) + tx.amount);
  }

  // Coinbase reward
  const rewardTx = { type: 'coinbase', to: minerAddress, amount: db.chain.reward, nonce: db.chain.height };
  const blockBase = {
    index: db.chain.height,
    prevHash,
    timestamp: Date.now(),
    txs: [rewardTx, ...txs],
  };

  // Tiny PoW
  let nonce = 0, hash = '';
  const targetPrefix = '0'.repeat(db.chain.difficulty);
  do {
    nonce++;
    hash = keccak_256(JSON.stringify({ ...blockBase, nonce }));
  } while (!hash.startsWith(targetPrefix) && nonce < 1e7);

  const block = { ...blockBase, nonce, hash };

  // Commit: update accounts to validated balances
  for (const [addr, bal] of balances) {
    db.accounts[addr] = { balance: bal };
  }
  // Add coinbase
  db.accounts[minerAddress] ??= { balance: 0 };
  db.accounts[minerAddress].balance += db.chain.reward;

  // Chain update
  db.chain.blocks.push(block);
  db.chain.height += 1;
  db.chain.mempool = [];
  save(db);
  return block;
}

export function addGenesis(recipient, amount = 1_000_000) {
  const db = load();
  if (db.chain.height > 0) return db.chain.blocks[0];
  db.accounts[recipient] ??= { balance: 0 };
  db.accounts[recipient].balance += amount;

  const block = {
    index: 0,
    prevHash: '0'.repeat(64),
    timestamp: Date.now(),
    txs: [{ type: 'coinbase', to: recipient, amount }],
    nonce: 0,
  };
  block.hash = keccak_256(JSON.stringify(block));
  db.chain.blocks.push(block);
  db.chain.height = 1;
  save(db);
  return block;
}

// Helpers for debugging UI panels (optional)
export function getDb() { return load(); }
export function resetDb() { save(makeEmptyDb()); }
