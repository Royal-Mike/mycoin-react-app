import { keccak_256 } from "js-sha3";
import { verifySignedTx, computeTxHash } from '../crypto/wallet-lib';

const DB_KEY = "mycoin_db_21127561";
const POW_DEFAULTS = {
  // ~16 leading zero bits; adjust at runtime via retargeting
  targetHex: "0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  // Easiest allowed target (cap)
  maxTargetHex: "00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  // Demo-scale retargeting (Bitcoin uses 2016 blocks / 10 min)
  retargetInterval: 20,
  targetBlockTimeMs: 10_000,
  maxAdjustUp: 4.0,
  maxAdjustDown: 0.25,
};

function ensurePowConfig(db) {
  let changed = false;
  if (!db.chain) { db.chain = { height:0, blocks:[], mempool:[], reward:50 }; changed = true; }
  if (!db.chain.pow) { db.chain.pow = { ...POW_DEFAULTS }; changed = true; }
  // Keep old code working if anything still reads `chain.difficulty`
  if (typeof db.chain.difficulty !== 'number') { db.chain.difficulty = 2; changed = true; }
  return changed;
}

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
      reward: 5,
			pow: {
        // Start harder than before. ~16 leading zero bits target (adjusts over time).
        targetHex: "0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        // Upper bound (easiest allowed)
        maxTargetHex: "00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        // Retarget every N blocks (use 20 here so you feel it quickly in a demo).
        retargetInterval: 20,
        // Aim for ~10s per block in this demo (Bitcoin: 10 min).
        targetBlockTimeMs: 10_000,
        // Clamp factor like Bitcoin (between 0.25x and 4x)
        maxAdjustUp: 4.0,
        maxAdjustDown: 0.25
      }
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

	let changed = false;
	if (!db.chain?.pow) {
		changed = true;
		db.chain = db.chain || {};
		db.chain.pow = { ...POW_DEFAULTS };
	}
	if (typeof db.chain?.difficulty !== 'number') {
		changed = true; db.chain.difficulty = 2;
	}
	if (changed) {
		db.version = 3; save(db);
	}

  return db;
}

function load() {
	const db = migrateIfNeeded(loadRaw());
	if (ensurePowConfig(db)) save(db); // belt & suspenders
	return db;
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

	const block = { ...base, nonce, hash, consensus: "pow" };

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

function hexToBigInt(hex) { return BigInt('0x' + hex.replace(/^0x/, '')); }
function bigIntToHex64(n) { return n.toString(16).padStart(64, '0'); }

function getTargetBI(db) {
	ensurePowConfig(db);
	return hexToBigInt(db.chain.pow.targetHex);
}
function getMaxTargetBI(db) {
	ensurePowConfig(db);
	return hexToBigInt(db.chain.pow.maxTargetHex);
}

function retargetIfNeeded(db) {
	ensurePowConfig(db);

  const { retargetInterval, targetBlockTimeMs, maxAdjustUp, maxAdjustDown } = db.chain.pow;
  const h = db.chain.height;
  if (h === 0 || h % retargetInterval !== 0) return;

  const last = db.chain.blocks[h - 1];
  const first = db.chain.blocks[h - retargetInterval];
  if (!first || !last) return;

  const actualSpan = Math.max(1, last.timestamp - first.timestamp);
  const expectedSpan = retargetInterval * targetBlockTimeMs;

  // Factor = actual / expected; clamp to [0.25, 4] like Bitcoin
  let factor = actualSpan / expectedSpan;
  if (factor < maxAdjustDown) factor = maxAdjustDown;
  if (factor > maxAdjustUp)   factor = maxAdjustUp;

  // New target = old target * factor (bounded by max target: easier cap)
  let newTarget = (getTargetBI(db) * BigInt(Math.round(factor * 1e8))) / BigInt(1e8);
  const maxTarget = getMaxTargetBI(db);
  if (newTarget > maxTarget) newTarget = maxTarget;

  db.chain.pow.targetHex = bigIntToHex64(newTarget);
}

// Async PoW miner with progress yielding (keeps UI responsive)
export async function mineBlockPowAsync(minerAddress, { onProgress } = {}) {
  const db = load();
	ensurePowConfig(db);

  const tip = db.chain.blocks.at(-1);
  const prevHash = tip ? tip.hash : "0".repeat(64);

  // snapshot mempool + validate on temp state (sig + balances)
  const txs = db.chain.mempool.slice();
  const balances = new Map(Object.entries(db.accounts).map(([a, v]) => [a, v.balance]));
  const safeGet = (a) => balances.get(a) ?? 0;
  for (const tx of txs) {
    if (!verifySignedTx(tx)) throw new Error("Invalid tx signature");
    if (safeGet(tx.from) < tx.amount) throw new Error(`Insufficient funds for ${tx.from}`);
    balances.set(tx.from, safeGet(tx.from) - tx.amount);
    balances.set(tx.to, safeGet(tx.to) + tx.amount);
  }

  const rewardTx = { type: "coinbase", to: minerAddress, amount: db.chain.reward, nonce: db.chain.height };
  const base = { index: db.chain.height, prevHash, timestamp: Date.now(), txs: [rewardTx, ...txs], consensus: "pow" };

  const target = getTargetBI(db);
  const BATCH = 5_000;              // hashes between UI yields
  const start = Date.now();
  let nonce = 0;

  // Try nonces in batches; yield to the browser between batches.
  while (true) {
    for (let i = 0; i < BATCH; i++) {
      nonce++;
      const hashHex = keccak_256(JSON.stringify({ ...base, nonce }));
      if (hexToBigInt(hashHex) <= target) {
        const block = { ...base, nonce, hash: hashHex };
        // commit: balances
        for (const [addr, bal] of balances) db.accounts[addr] = { balance: bal };
        db.accounts[minerAddress] ??= { balance: 0 };
        db.accounts[minerAddress].balance += db.chain.reward;

        db.chain.blocks.push(block);
        db.chain.height += 1;
        db.chain.mempool = [];
        // retarget if needed
        retargetIfNeeded(db);
        save(db);
        return block;
      }
    }
    onProgress?.({ nonceTried: nonce, elapsedMs: Date.now() - start, targetHex: db.chain.pow.targetHex });
    // Yield to UI before next batch
    await new Promise(requestAnimationFrame);
  }
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

// ---------- Proof of Stake ----------
export function listAccounts() {
  const db = load();
  return Object.entries(db.accounts).map(([address, { balance }]) => ({ address, balance }));
}

export function mineBlockPos(validatorAddress) {
  const db = load();
  const tip = db.chain.blocks.at(-1);
  const prevHash = tip ? tip.hash : "0".repeat(64);

  // choose validator if not provided
  const validator = validatorAddress || pickValidatorByStake();

  // copy mempool and validate (signature + balances)
  const txs = db.chain.mempool.slice();
  const balances = new Map(Object.entries(db.accounts).map(([a, v]) => [a, v.balance]));
  const safeGet = (a) => balances.get(a) ?? 0;
  for (const tx of txs) {
    if (!verifySignedTx(tx)) throw new Error("Invalid tx signature");
    if (safeGet(tx.from) < tx.amount) throw new Error(`Insufficient funds for ${tx.from}`);
    balances.set(tx.from, safeGet(tx.from) - tx.amount);
    balances.set(tx.to, safeGet(tx.to) + tx.amount);
  }

  // Reward validator (same reward as PoW for simplicity)
  const rewardTx = { type: "coinbase", to: validator, amount: db.chain.reward, nonce: db.chain.height };

  const base = {
    index: db.chain.height,
    prevHash,
    timestamp: Date.now(),
    txs: [rewardTx, ...txs],
    consensus: "pos",
    nonce: 0,
  };
  const hash = keccak_256(JSON.stringify(base));
  const block = { ...base, hash };

  // commit balances and chain
  for (const [addr, bal] of balances) db.accounts[addr] = { balance: bal };
  db.accounts[validator] ??= { balance: 0 };
  db.accounts[validator].balance += db.chain.reward;

  db.chain.blocks.push(block);
  db.chain.height += 1;
  db.chain.mempool = [];
  save(db);
  return block;
}

function pickValidatorByStake() {
  const db = load();
  const entries = Object.entries(db.accounts); // [address, {balance}]
  const stakes = entries.filter(([, v]) => (v?.balance || 0) > 0);
  if (stakes.length === 0) return db.activeAddress || (entries[0]?.[0] ?? null);

  const total = stakes.reduce((s, [, v]) => s + (v.balance || 0), 0);
  let r = Math.random() * total;
  for (const [addr, v] of stakes) {
    r -= v.balance || 0;
    if (r <= 0) return addr;
  }
  return stakes[stakes.length - 1][0];
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
