import * as bip39 from 'bip39'
import { ec as EC } from 'elliptic'
import { keccak_256 } from 'js-sha3'
import { createHmac } from 'crypto'
import BN from 'bn.js'

const ec = new EC('secp256k1')
const n = ec.curve.n

// ---- Mnemonic / seed (bip39) ----
export function generateMnemonic12() {
  return bip39.generateMnemonic(128) // 12 words
}
export function mnemonicToSeed(mnemonic, passphrase = '') {
  // sync is fine in browser after polyfills
  return Promise.resolve(bip39.mnemonicToSeedSync(mnemonic, passphrase)) // Buffer
}

// ---- BIP32 (minimal) using HMAC-SHA512 + elliptic ----
function hmac512(key, data) { return createHmac('sha512', key).update(data).digest() }
function ser32(i) { const b = Buffer.allocUnsafe(4); b.writeUInt32BE(i >>> 0); return b }
function pointCompressed(priv32) {
  const kp = ec.keyFromPrivate(priv32)
  return Buffer.from(kp.getPublic(true, 'array')) // 33 bytes
}
function masterFromSeed(seed) {
  const I = hmac512(Buffer.from('Bitcoin seed', 'utf8'), seed)
  return { key: I.slice(0, 32), chainCode: I.slice(32) }
}
function CKDpriv({ key, chainCode }, index) {
  const hardened = index >= 0x80000000
  const data = hardened
    ? Buffer.concat([Buffer.from([0]), key, ser32(index)])
    : Buffer.concat([pointCompressed(key), ser32(index)])
  const I = hmac512(chainCode, data)
  const IL = new BN(I.slice(0, 32))
  const IR = I.slice(32)
  if (IL.gte(n)) throw new Error('Invalid child (IL >= n)')
  const ki = IL.add(new BN(key)).umod(n)
  if (ki.isZero()) throw new Error('Invalid child (k == 0)')
  return { key: ki.toArrayLike(Buffer, 'be', 32), chainCode: IR }
}
function derivePath(seed, path = "m/44'/60'/0'/0/0") {
  const seg = path.split('/')
  if (seg[0] !== 'm') throw new Error('Path must start with m')
  let node = masterFromSeed(seed)
  for (let i = 1; i < seg.length; i++) {
    const part = seg[i]
    const hardened = part.endsWith("'")
    let idx = parseInt(hardened ? part.slice(0, -1) : part, 10)
    if (!Number.isFinite(idx)) throw new Error(`Bad path index: ${part}`)
    if (hardened) idx += 0x80000000
    node = CKDpriv(node, idx)
  }
  return node // { key, chainCode }
}

// ---- Ethereum public key + address (keccak-256) ----
function privateToPublicUncompressed(priv32) {
  const kp = ec.keyFromPrivate(priv32)
  return Buffer.from(kp.getPublic(false, 'array')) // 65 bytes, 0x04 + X(32) + Y(32)
}
function publicToEthAddress(pubUncompressed) {
  const noPrefix = pubUncompressed.slice(1)
  const hash = Buffer.from(keccak_256.arrayBuffer(noPrefix))
  return '0x' + hash.slice(-20).toString('hex')
}
function toChecksumAddress(addr) {
  const hex = addr.toLowerCase().replace(/^0x/, '')
  const hash = keccak_256(hex)
  let ret = '0x'
  for (let i = 0; i < hex.length; i++) {
    ret += parseInt(hash[i], 16) >= 8 ? hex[i].toUpperCase() : hex[i]
  }
  return ret
}

export function deriveEthereumAccount(seed, path = "m/44'/60'/0'/0/0") {
  const { key: priv } = derivePath(seed, path)
  const pub = privateToPublicUncompressed(priv)
  const address = toChecksumAddress(publicToEthAddress(pub))
  return {
    privateKeyHex: priv.toString('hex'),
    publicKeyHex: pub.toString('hex'),
    address,
    path,
  }
}

// ---- Encrypt & save vault (AES-GCM via Web Crypto) ----
export async function saveVaultEncrypted(vaultObj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 200_000, salt },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  const data = new TextEncoder().encode(JSON.stringify(vaultObj))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data))
  const payload = {
    v: 1,
    salt: Buffer.from(salt).toString('hex'),
    iv: Buffer.from(iv).toString('hex'),
    ct: Buffer.from(ct).toString('hex'),
  }
  localStorage.setItem('vault_v1', JSON.stringify(payload))
}

// --- Tx hashing/signing/verification ---
export function computeTxHash(tx) {
  // canonical message: exclude signature/pubKey/hash; coerce amount to number
  const msg = JSON.stringify({
    from: tx.from,
    to: tx.to,
    amount: Number(tx.amount),
    nonce: tx.nonce,
  });
  return '0x' + keccak_256(msg);
}

export function signTx(privKeyHex, tx) {
  const msgHashHex = computeTxHash(tx).replace(/^0x/, '');
  const sig = ec.sign(msgHashHex, privKeyHex, 'hex', { canonical: true });
  const signature = Buffer.from(sig.toDER()).toString('hex');
  const pub = privateToPublicUncompressed(Buffer.from(privKeyHex, 'hex')); // existing helper above
  const pubKeyHex = Buffer.from(pub).toString('hex');
  return { signature, pubKeyHex, hash: '0x' + msgHashHex };
}

export function addressFromPublicKey(pubKeyHex) {
  const pub = Buffer.from(pubKeyHex, 'hex');
  const noPrefix = pub.slice(1);
  const hash = Buffer.from(keccak_256.arrayBuffer(noPrefix));
  const addr = '0x' + hash.slice(-20).toString('hex');
  return toChecksumAddress(addr); // existing helper above
}

export function verifySignedTx(tx) {
  if (!tx || !tx.signature || !tx.pubKey) return false;
  // verify sender address matches pubKey
  const addr = addressFromPublicKey(tx.pubKey);
  if ((tx.from || '').toLowerCase() !== addr.toLowerCase()) return false;
  // verify signature
  const msgHashHex = computeTxHash(tx).replace(/^0x/, '');
  const key = ec.keyFromPublic(tx.pubKey, 'hex');
  try {
    return key.verify(msgHashHex, tx.signature);
  } catch {
    return false;
  }
}

// --- Encrypt / Decrypt arbitrary text with a password (PBKDF2 + AES-GCM)
export async function encryptText(plainText, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 200_000, salt },
    keyMaterial,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );

  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plainText))
  );

  const toHex = (u8) => [...u8].map(b=>b.toString(16).padStart(2,'0')).join('');
  return {
    v: 1,
    kdf: 'pbkdf2-sha256',
    iter: 200_000,
    algo: 'aes-gcm-256',
    salt: toHex(salt),
    iv: toHex(iv),
    ct: toHex(ct),
  };
}

export async function decryptText(payload, password) {
  const dec = new TextDecoder();
  const fromHex = (h) => new Uint8Array(h.match(/../g).map(x=>parseInt(x,16)));

  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: payload.iter, salt: fromHex(payload.salt) },
    keyMaterial,
    { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  );

  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromHex(payload.iv) },
    key,
    fromHex(payload.ct)
  );
  return dec.decode(pt);
}
