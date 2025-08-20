import "./onboarding.css";
import "./mine.css";
import { useMemo, useState } from "react";
import {
  getActiveWallet, listWallets, listAccounts,
  mineBlockPowAsync, mineBlockPos
} from "../storage/localDb";

export default function Mine({ onNavigate }) {
  const active = getActiveWallet();
  const wallets = useMemo(() => listWallets(), []);
  const accounts = useMemo(() => listAccounts(), []);

  // Must be logged in
  if (!active) {
    return (
      <main className="onb-wrap">
        <section className="card form">
          <h2 className="h2">No unlocked wallet</h2>
          <p className="muted">Please unlock a wallet before mining.</p>
          <button className="btn primary" onClick={() => onNavigate?.('wallet')}>Access my wallet</button>
        </section>
      </main>
    );
  }

  const [mode, setMode] = useState("pow"); // 'pow' | 'pos'
  const [miner, setMiner] = useState(active.address);
  const [validator, setValidator] = useState(active.address);
	const [status, setStatus] = useState(null);     // { ok:boolean, msg:string }
	const [mining, setMining] = useState(false);    // loading flag for UI
	const [prog, setProg] = useState(null);         // { nonceTried, elapsedMs, targetHex }

  async function doMine() {
    try {
			if (mode === "pow") {
				setMining(true);
				setStatus(null);
				setProg({ nonceTried: 0, elapsedMs: 0 });
				const block = await mineBlockPowAsync(miner, {
					onProgress: (p) => setProg(p),
				});
				setStatus({ ok: true, msg: `Block mined (PoW) • #${block.index} • ${block.txs.length - 1} tx • reward → ${short(miner)}` });
				setMining(false);
				setProg(null);
			} else {
        const block = mineBlockPos(validator);
        setStatus({ ok: true, msg: `Block forged (PoS) • #${block.index} • ${block.txs.length - 1} tx • reward → ${short(validator)}` });
      }
    } catch (e) {
      setStatus({ ok: false, msg: e.message || String(e) });
			setMining(false);
    }
  }

  return (
    <main className="onb-wrap">
      <section className="card form">
        <h2 className="h2">Mine blocks</h2>
        <p className="muted">Choose a consensus method and a recipient for the block reward.</p>

        <div className="field">
          <label className="lbl">Consensus</label>
          <div className="tabs">
            <button
              type="button"
              className={`tab ${mode === "pow" ? "active" : ""}`}
              onClick={() => setMode("pow")}
							disabled={mining}
            >Proof of Work</button>
            <button
              type="button"
              className={`tab ${mode === "pos" ? "active" : ""}`}
              onClick={() => setMode("pos")}
							disabled={mining}
            >Proof of Stake</button>
          </div>
        </div>

        {mode === "pow" ? (
          <div className="field">
            <label className="lbl">Miner (gets reward)</label>
            <select className="input" value={miner} onChange={(e)=>setMiner(e.target.value)} disabled={mining}>
              {wallets.map(w => (
                <option key={w.address} value={w.address}>{short(w.address)}</option>
              ))}
            </select>
            <p className="hint">Current difficulty is low in this demo, so PoW will be very fast.</p>
          </div>
        ) : (
          <div className="field">
            <label className="lbl">Validator (gets reward)</label>
            <select className="input" value={validator} onChange={(e)=>setValidator(e.target.value)} disabled={mining}>
              {accounts.map(a => (
                <option key={a.address} value={a.address}>
                  {short(a.address)} ({fmt(a.balance)} COIN)
                </option>
              ))}
            </select>
            <p className="hint">Validator selection is stake-weighted in this demo.</p>
          </div>
        )}

				{mining && (
					<div className="banner info">
						Mining... tried <b>{(prog?.nonceTried ?? 0).toLocaleString()}</b> nonces,
						elapsed <b>{Math.round((prog?.elapsedMs ?? 0)/1000)}s</b><br/>
						Target <code className="mono">{(prog?.targetHex ?? "").slice(0,10)}...</code>
						<span className="spinner" aria-hidden="true" />
					</div>
				)}

        {status && (
          <div className={`banner ${status.ok ? "ok" : "err"}`}>
            {status.msg}
          </div>
        )}

        <div className="actions">
          <button className="btn primary" onClick={doMine} disabled={mining}>Mine block</button>
          <button className="btn" onClick={() => onNavigate?.('explorer')} disabled={mining}>View Explorer</button>
        </div>
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

function blockHtml(block, rewardTo) {
  return `
    <div class="mw-kv"><span>Consensus</span><b>${block.consensus?.toUpperCase() || 'POW'}</b></div>
    <div class="mw-kv"><span>Index</span><span>#${block.index}</span></div>
    <div class="mw-kv"><span>Transactions</span><span>${Math.max(0, (block.txs?.length || 1) - 1)} (excl. coinbase)</span></div>
    <div class="mw-kv"><span>Reward to</span><code>${rewardTo}</code></div>
    <div class="mw-kv"><span>Hash</span><code class="mw-mono">${block.hash}</code></div>
  `;
}
