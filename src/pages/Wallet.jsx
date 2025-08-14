import { useMemo, useState } from "react";
import "./onboarding.css";  // reuse the same card UI
import "./wallet.css";      // wallet-specific bits
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { getDb, getBalance } from "../storage/localDb";
import { keccak_256 } from "js-sha3";

export default function Wallet() {
  const db = getDb();
  const w = db.wallet;

  const [step, setStep] = useState("login"); // login | details
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");

  if (!w) {
    return (
      <main className="onb-wrap wallet-wrap">
        <section className="card ready" style={{alignItems:"flex-start"}}>
          <h2 className="h2">No wallet found</h2>
          <p className="muted">Create one first via the Onboarding page.</p>
        </section>
      </main>
    );
  }

  function handleLogin() {
    if (!w.password || w.password === pwd) {
      setErr(""); setStep("details");
    } else {
      setErr("Incorrect password"); 
    }
  }

  // Compute balance + tx history for this wallet
  const balance = getBalance(w.address);
  const txs = useMemo(() => {
    const out = [];
    for (const b of db.chain.blocks) {
      for (let i = 0; i < b.txs.length; i++) {
        const t = b.txs[i];
        if (t.type === "coinbase") continue;
        if (t.from === w.address || t.to === w.address) {
          const hash = "0x" + keccak_256(JSON.stringify({ t, i, bh: b.hash }));
          out.push({
            ...t,
            hash,
            blockIndex: b.index,
            timestamp: b.timestamp,
            direction: t.from === w.address ? "out" : "in"
          });
        }
      }
    }
    // latest first
    return out.sort((a,b)=> b.timestamp - a.timestamp);
  }, [db, w.address]);

  return (
    <main className={"onb-wrap" + (step === "login" ? "" : " wallet-wrap")}>
      {step === "login" && (
        <section className="card form">
          <h2 className="h2">Unlock wallet</h2>
          <p className="muted">Enter your password to view wallet details.</p>

          <div className="input-wrap">
            <input
              type={show ? "text" : "password"}
              value={pwd}
              onChange={e=>setPwd(e.target.value)}
              placeholder="Password"
            />
            <button className="icon-btn" onClick={() => setShow(v=>!v)} aria-label="Toggle password">
              {show ? <FaEyeSlash/> : <FaEye/>}
            </button>
          </div>

          {w.password ? (
            <p className="hint">Password is required to unlock your wallet.</p>
          ) : (
            <p className="hint">This wallet has no stored password (dev mode). Any input will unlock.</p>
          )}
          {err && <p className="error">{err}</p>}

          <button className="btn primary" onClick={handleLogin} disabled={!pwd && !!w.password}>
            Unlock
          </button>
        </section>
      )}

      {step === "details" && (
        <section className="card wallet-card">
          <h2 className="h2">Wallet details</h2>

          <div className="kv">
            <span>Address</span><code>{w.address}</code>
          </div>
          <div className="kv">
            <span>Public Key</span><code className="mono">{w.publicKey}</code>
          </div>
          <div className="kv">
            <span>Private Key</span><code className="mono">{w.privateKey}</code>
          </div>
          <div className="kv">
            <span>Derivation Path</span><code>{w.path}</code>
          </div>
          <div className="kv">
            <span>Balance</span><b>{format(balance)} COIN</b>
          </div>

          <h3 className="subhead">Recent transactions</h3>
          {txs.length === 0 ? (
            <p className="muted">No transactions found.</p>
          ) : (
            <ul className="tx-list">
              {txs.slice(0, 20).map(tx => (
                <li key={tx.hash} className="tx-row">
                  <div className={`dir ${tx.direction}`}>{tx.direction}</div>
                  <div className="tx-main">
                    <div className="mono">{shortHash(tx.hash)}</div>
                    <div className="sub">
                      {new Date(tx.timestamp).toLocaleString()} • Block #{tx.blockIndex}
                    </div>
                    <div className="sub">
                      From <span className="mono">{shortHash(tx.from)}</span> to{" "}
                      <span className="mono">{shortHash(tx.to)}</span>
                    </div>
                  </div>
                  <div className="amt mono">{format(tx.amount)} COIN</div>
                </li>
              ))}
            </ul>
          )}

          <div style={{marginTop:12}}>
            <button className="btn" onClick={()=>setStep("login")}>Lock</button>
          </div>
        </section>
      )}
    </main>
  );
}

function shortHash(h) {
    return h?.length>14 ? `${h.slice(0,10)}…${h.slice(-4)}` : h;
}
function format(n) {
    return Number(n).toLocaleString(undefined,{maximumFractionDigits:8});
}
