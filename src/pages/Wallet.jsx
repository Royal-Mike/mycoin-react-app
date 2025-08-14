import { useMemo, useState } from "react";
import "./onboarding.css";
import "./wallet.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { getDb, listWallets, getWallet, verifyWalletPassword, getBalance } from "../storage/localDb";
import { keccak_256 } from "js-sha3";

export default function Wallet() {
  const wallets = listWallets();
  const [selected, setSelected] = useState(wallets[0]?.address || "");
  const [step, setStep] = useState("login"); // login | details
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [w, setW] = useState(null);

  if (wallets.length === 0) {
    return (
      <main className="onb-wrap">
        <section className="card ready" style={{alignItems:"flex-start"}}>
          <h2 className="h2">No wallet found</h2>
          <p className="muted">Create one first on the Onboarding page.</p>
        </section>
      </main>
    );
  }

  async function handleLogin() {
    const ok = await verifyWalletPassword(selected, pwd);
    if (!ok) { setErr("Incorrect password"); return; }
    const wallet = getWallet(selected);
    setW(wallet);
    setErr(""); setStep("details");
  }

  const db = getDb();
  const balance = w ? getBalance(w.address) : 0;
  const txs = useMemo(() => {
    if (!w) return [];
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
    return out.sort((a,b)=> b.timestamp - a.timestamp);
  }, [db, w]);

  return (
    <main className={"onb-wrap" + (step === "login" ? "" : " wallet-wrap")}>
      {step === "login" && (
        <section className="card form">
          <h2 className="h2">Unlock wallet</h2>
          <div className="muted">Choose a wallet and enter its password.</div>

          <label className="muted" style={{marginTop:8}}>Wallet</label>
          <select
            value={selected}
            onChange={(e)=>setSelected(e.target.value)}
            style={{padding:"10px",border:"1px solid #e5e7eb",borderRadius:"10px"}}
          >
            {wallets.map(w => (
              <option key={w.address} value={w.address}>
                {shortHash(w.address)}
              </option>
            ))}
          </select>

          <div className="input-wrap" style={{marginTop:10}}>
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
          {!!err && <p className="error">{err}</p>}

          <button className="btn primary" onClick={handleLogin} disabled={!pwd}>
            Unlock
          </button>
        </section>
      )}

      {step === "details" && w && (
        <section className="card wallet-card">
          <h2 className="h2">Wallet details</h2>

          <div className="kv"><span>Address</span><code>{w.address}</code></div>
          <div className="kv"><span>Public Key</span><code className="mono">{w.publicKey}</code></div>
          <div className="kv"><span>Private Key</span><code className="mono">{w.privateKey}</code></div>
          <div className="kv"><span>Derivation Path</span><code>{w.path}</code></div>
          <div className="kv"><span>Balance</span><b>{format(balance)} COIN</b></div>

          <h3 className="subhead">Recent transactions</h3>
          {txs.length === 0 ? (
            <p className="muted">No transactions found.</p>
          ) : (
            <ul className="tx-list">
              {txs.slice(0, 25).map(tx => (
                <li key={tx.hash} className="tx-row">
                  <div className={`dir ${tx.direction}`}>{tx.direction}</div>
                  <div className="tx-main">
                    <div className="mono">{shortHash(tx.hash)}</div>
                    <div className="sub">{new Date(tx.timestamp).toLocaleString()} • Block #{tx.blockIndex}</div>
                    <div className="sub">From <span className="mono">{shortHash(tx.from)}</span> to <span className="mono">{shortHash(tx.to)}</span></div>
                  </div>
                  <div className="amt mono">{format(tx.amount)} COIN</div>
                </li>
              ))}
            </ul>
          )}

          <div style={{marginTop:12}}>
            <button className="btn" onClick={()=>{ setPwd(""); setStep("login"); }}>
              Lock
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function shortHash(h) {
    return h?.length>19 ? `${h.slice(0,10)}...${h.slice(-9)}` : h;
}
function format(n) {
    return Number(n).toLocaleString(undefined,{maximumFractionDigits:8});
}
