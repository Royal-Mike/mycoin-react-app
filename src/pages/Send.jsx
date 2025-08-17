import { useMemo, useState } from "react";
import "./onboarding.css"; // reuse card/base styles
import "./send.css";       // small page-specific tweaks
import {
  getActiveWallet, listWallets, getBalance,
  addToMempool, mineBlock, getDb
} from "../storage/localDb";
import { signTx } from '../crypto/wallet-lib';

export default function Send({ onNavigate }) {
  const active = getActiveWallet();
  const wallets = useMemo(
    () => listWallets().filter(w => !active || w.address !== active.address),
    [active]
  );

  // Guard: must be logged in
  if (!active) {
    return (
      <main className="onb-wrap">
        <section className="card form">
          <h2 className="h2">No unlocked wallet</h2>
          <p className="muted">Please unlock a wallet to send coins.</p>
          <button className="btn primary" onClick={() => onNavigate?.('wallet')}>Access my wallet</button>
        </section>
      </main>
    );
  }

  // Form state
  const [toType, setToType] = useState(wallets.length ? "known" : "custom");
  const [toKnown, setToKnown] = useState(wallets[0]?.address || "");
  const [toCustom, setToCustom] = useState("");
  const [amount, setAmount] = useState("");
  const [mineNow, setMineNow] = useState(true);
  const [status, setStatus] = useState(null); // { ok:boolean, msg:string }

  const fromAddr = active.address;
  const balance = getBalance(fromAddr);

  function resolveTo() {
    return toType === "known" ? toKnown : toCustom.trim();
  }

  function validate() {
    const to = resolveTo();
    if (!to) return "Recipient is required";
    if (to === fromAddr) return "Cannot send to your own address";
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return "Enter a valid positive amount";
    if (amt > balance) return "Insufficient balance";
    // naïve address check
    if (!/^0x[0-9a-fA-F]{40}$/.test(to) && to.length < 10) return "Recipient address looks invalid";
    return null;
  }

  function resetForm() {
    setAmount("");
    if (!wallets.length) setToType("custom");
    setStatus(null);
  }

  async function submit(e) {
    e.preventDefault();
    const err = validate();
    if (err) { setStatus({ ok: false, msg: err }); return; }

    try {
      const to = resolveTo();
      const amt = Number(amount);

			// 1) Build & sign tx, then mempool
			const nonce = Date.now();
			const baseTx = { from: fromAddr, to, amount: amt, nonce };
			const sig = signTx(active.privateKey, baseTx);
			const signedTx = { ...baseTx, pubKey: sig.pubKeyHex, signature: sig.signature, hash: sig.hash, timestamp: Date.now() };
			addToMempool(signedTx);

      // 2) Optionally mine immediately (miner = active wallet)
      if (mineNow) {
        mineBlock(fromAddr);
      }

      // 3) Success UI
      const db = getDb();
      const tip = db.chain.blocks.at(-1);
      setStatus({
        ok: true,
        msg: mineNow
          ? `Sent ${amt} COIN to ${short(to)}. Included in block #${tip.index}.`
          : `Transaction queued in mempool. ${amt} COIN → ${short(to)}.`,
      });
      if (mineNow) {
        // refresh balance shown by recomputing (getBalance reads from localStorage)
      }
      resetForm();
    } catch (e2) {
      setStatus({ ok: false, msg: e2.message || String(e2) });
    }
  }

  return (
    <main className="onb-wrap">
      <section className="card form">
        <h2 className="h2">Send coins</h2>
        <p className="muted">From your unlocked wallet to another address.</p>

        <div className="kv no-pad">
          <div>
            <div className="mono">{short(fromAddr)}</div>
            <div className="sub">Balance: <b>{fmt(balance)} COIN</b></div>
          </div>
        </div>

        <form onSubmit={submit} className="send-form">
          <div className="field">
            <label className="lbl">Recipient</label>
            <div className="tabs">
              <button
                type="button"
                className={`tab ${toType === "known" ? "active" : ""}`}
                onClick={() => setToType("known")}
                disabled={!wallets.length}
                title={wallets.length ? "" : "No other local wallets"}
              >Known</button>
              <button
                type="button"
                className={`tab ${toType === "custom" ? "active" : ""}`}
                onClick={() => setToType("custom")}
              >Custom</button>
            </div>

            {toType === "known" ? (
              <select
                className="input"
                value={toKnown}
                onChange={(e)=>setToKnown(e.target.value)}
              >
                {wallets.map(w => (
                  <option key={w.address} value={w.address}>
                    {short(w.address)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input mono"
                placeholder="0x… recipient address"
                value={toCustom}
                onChange={(e)=>setToCustom(e.target.value)}
              />
            )}
          </div>

          <div className="field">
            <label className="lbl">Amount</label>
            <input
              className="input"
              type="number"
              step="0.00000001"
              min="0"
              placeholder="0.0"
              value={amount}
              onChange={(e)=>setAmount(e.target.value)}
            />
          </div>

          <label className="chk">
            <input
              type="checkbox"
              checked={mineNow}
              onChange={(e)=>setMineNow(e.target.checked)}
            />
            <span>Mine immediately (confirm transaction now)</span>
          </label>

          {status && (
            <div className={`banner ${status.ok ? "ok" : "err"}`}>
              {status.msg}
            </div>
          )}

          <div className="actions">
            <button type="submit" className="btn primary">Send</button>
            <button
              type="button"
              className="btn"
              onClick={()=>onNavigate?.('explorer')}
            >
              View Explorer
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function short(a) {
	return a.length>19 ? `${a.slice(0,10)}...${a.slice(-9)}` : a
}
function fmt(n) {
	return Number(n).toLocaleString(undefined,{ maximumFractionDigits: 8 });
}
