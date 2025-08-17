import { keccak_256 } from "js-sha3";
import { verifySignedTx, computeTxHash } from '../crypto/wallet-lib';

const DB_KEY = "mycoin_db_21127561";

// ---------- Base schema ----------
export function makeEmptyDb() {
  return {
    version: 2,
    createdAt: Date.now(),
    wallets: {},           // address -> wallet
    activeAddress: null,   // last unlocked/selected (optional)
    accounts: {},          // address -> { balance }
    chain: {
      height: 0,
      blocks: [],
      mempool: [],
      reward: 50,
      difficulty: 2,
    },
  };
}

// ---------- load/save + migration ----------
function loadRaw() {
  const raw = localStorage.getItem(DB_KEY);
  return raw ? JSON.parse(raw) : makeEmptyDb();
}
function save(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// Keep compatibility with the old v1 (single wallet / plaintext password)
function migrateIfNeeded(db) {
  if (!db.version || db.version < 2) {
    const next = makeEmptyDb();
    // migrate chain & accounts
    next.accounts = db.accounts || {};
    next.chain = db.chain || next.chain;

    // migrate wallet if present
    if (db.wallet) {
      const w = db.wallet;
      // If old wallet had plaintext password, keep a fallback so it still unlocks
      // New wallets will always use hashed records.
      next.wallets[w.address] = {
        address: w.address,
        path: w.path,
        publicKey: w.publicKey,
        privateKey: w.privateKey,
        mnemonic: w.mnemonic,
        password: typeof w.password === "string" ? { fallbackPlain: w.password } : null,
      };
      next.activeAddress = w.address;
    }
    next.version = 2;
    save(next);
    return next;
  }
  return db;
}

function load() {
  return migrateIfNeeded(loadRaw());
}

export function getDb() {
  return load();
}

export function resetDb() {
  save(makeEmptyDb());
}

// ---------- Password hashing (PBKDF2-SHA256) ----------
async function pbkdf2(password, saltHex, iterations = 150_000, length = 32) {
  const enc = new TextEncoder();
  const salt = hexToBuf(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", iterations, salt },
    keyMaterial,
    length * 8
  );
  return bufToHex(bits);
}

export async function createPasswordRecord(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bufToHex(salt);
  const iter = 150_000;
  const hash = await pbkdf2(password, saltHex, iter, 32);
  return { algo: "pbkdf2-sha256", iter, salt: saltHex, hash };
}

export async function verifyPassword(password, rec) {
  if (!rec) return false;
  if (rec.fallbackPlain != null) return password === rec.fallbackPlain;
  if (rec.algo !== "pbkdf2-sha256") return false;
  const calc = await pbkdf2(password, rec.salt, rec.iter, 32);
  // naive compare is fine for mock app
  return calc === rec.hash;
}

// ---------- Wallet ops (multi-wallet) ----------
export function initDbIfMissing() {
  if (!localStorage.getItem(DB_KEY)) save(makeEmptyDb());
}

export async function addWalletHashed(wallet, password) {
  const db = load();
  const passRec = await createPasswordRecord(password);
  db.wallets[wallet.address] = { ...wallet, password: passRec };
  db.accounts[wallet.address] ??= { balance: 0 };
  db.activeAddress ??= wallet.address;
  save(db);
  return wallet.address;
}

export function listWallets() {
  const db = load();
  return Object.values(db.wallets);
}

export function getWallet(address) {
  const db = load();
  return db.wallets[address] || null;
}

export async function verifyWalletPassword(address, password) {
  const w = getWallet(address);
  if (!w) return false;
  return await verifyPassword(password, w.password);
}

export function setActiveWallet(address) {
  const db = load();
  db.activeAddress = address || null; // allow clearing when null/undefined
  save(db);
}

export function getActiveWallet() {
  const db = load();
  return db.activeAddress ? db.wallets[db.activeAddress] : null;
}

// ---------- Accounts ----------
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
  if (db.accounts[address].balance < amount) throw new Error("Insufficient balance");
  db.accounts[address].balance -= amount;
  save(db);
}

// ---------- Tx / Chain ----------
export function addToMempool(tx) {
  const db = load();
  if (!tx.from || !tx.to || !(tx.amount > 0)) throw new Error('Bad tx');
  tx.nonce ??= Date.now();
  tx.timestamp ??= Date.now();
  tx.hash ??= computeTxHash(tx);

  // must be signed & valid
  if (!verifySignedTx(tx)) throw new Error('Invalid signature');

  db.chain.mempool.push(tx);
  save(db);
}

export function mineBlock(minerAddress) {
  const db = load();
  const tip = db.chain.blocks.at(-1);
  const prevHash = tip ? tip.hash : "0".repeat(64);

  // copy current mempool
  const txs = db.chain.mempool.slice();

  // Validate signatures & balances on a temp state
  const balances = new Map(Object.entries(db.accounts).map(([a, v]) => [a, v.balance]));
  const safeGet = (a) => balances.get(a) ?? 0;
  for (const tx of txs) {
    if (!verifySignedTx(tx)) throw new Error("Invalid tx signature");
    if (safeGet(tx.from) < tx.amount) throw new Error(`Insufficient funds for ${tx.from}`);
    balances.set(tx.from, safeGet(tx.from) - tx.amount);
    balances.set(tx.to, safeGet(tx.to) + tx.amount);
  }

  // Coinbase
  const rewardTx = { type: "coinbase", to: minerAddress, amount: db.chain.reward, nonce: db.chain.height };

  const base = { index: db.chain.height, prevHash, timestamp: Date.now(), txs: [rewardTx, ...txs] };

  let nonce = 0, hash = "";
  const target = "0".repeat(db.chain.difficulty);
  do {
    nonce++;
    hash = keccak_256(JSON.stringify({ ...base, nonce }));
  } while (!hash.startsWith(target) && nonce < 1e7);

  const block = { ...base, nonce, hash };

  // commit balances and chain
  for (const [addr, bal] of balances) db.accounts[addr] = { balance: bal };
  db.accounts[minerAddress] ??= { balance: 0 };
  db.accounts[minerAddress].balance += db.chain.reward;

  db.chain.blocks.push(block);
  db.chain.height += 1;
  db.chain.mempool = []; // consumed
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
    prevHash: "0".repeat(64),
    timestamp: Date.now(),
    txs: [{ type: "coinbase", to: recipient, amount }],
    nonce: 0,
  };
  block.hash = keccak_256(JSON.stringify(block));
  db.chain.blocks.push(block);
  db.chain.height = 1;
  save(db);
  return block;
}

// ---------- helpers ----------
function bufToHex(buf) {
  const v = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer ?? buf);
  return [...v].map(b => b.toString(16).padStart(2, "0")).join("");
}
function hexToBuf(hex) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a;
}
