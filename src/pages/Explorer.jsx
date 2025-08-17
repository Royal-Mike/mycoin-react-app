import { useMemo, useState } from 'react';
import './explorer.css';
import { FaArrowLeft } from "react-icons/fa6";
import { getDb } from '../storage/localDb';
import { keccak_256 } from 'js-sha3';

export default function Explorer() {
  const [view, setView] = useState({ type: 'home' }); // {type:'home'}|{type:'block',hash}|{type:'tx',hash}
  const db = getDb();

  const { blocks, txs, totals } = useMemo(() => {
    const blocks = [...db.chain.blocks].reverse(); // latest first
    // flatten txs (exclude coinbase for the list), add block info + tx hash
    const flat = [];
    for (const b of blocks) {
      b.txs.forEach((tx, i) => {
        const isCoinbase = tx.type === 'coinbase';
        const txHash = '0x' + keccak_256(JSON.stringify({ tx, i, bh: b.hash }));
        flat.push({ ...tx, isCoinbase, block: { index: b.index, hash: b.hash, ts: b.timestamp }, hash: txHash });
      });
    }
    const txs = flat.filter(t => !t.isCoinbase);
    const totals = {
      height: db.chain.height,
      blocks: db.chain.blocks.length,
      mempool: db.chain.mempool.length,
      txCount: txs.length,
      latestBlock: db.chain.blocks.at(-1) || null,
    };
    return { blocks, txs, totals };
  }, [db]);

  if (view.type === 'block') return <BlockDetail hash={view.hash} onBack={() => setView({ type:'home' })} />;
  if (view.type === 'tx') return <TxDetail hash={view.hash} onBack={() => setView({ type:'home' })} />;

  // HOME DASHBOARD
  return (
    <main className="expl-wrap">
      <h2 className="h2">Blockchain explorer</h2>
      <section className="stats">
        <Stat label="Blocks" value={totals.blocks} />
        <Stat label="Transactions" value={totals.txCount} />
        <Stat label="Mempool" value={totals.mempool} />
        <Stat label="Latest Block" value={totals.latestBlock ? totals.latestBlock.index : '—'} />
      </section>

      <section className="cols">
        <div className="panel">
          <div className="panel-hd">Latest Blocks</div>
          <ul className="list">
            {blocks.slice(0, 10).map(b => (
              <li key={b.hash} className="row" onClick={()=>setView({type:'block', hash:b.hash})}>
                <div className="row-l">
                  <div className="mono link">#{b.index}</div>
                  <div className="sub">{timeago(b.timestamp)}</div>
                </div>
                <div className="row-r">
                  <div className="sub">{(b.txs.length - 1)} txns</div>
                  <div className="badge">{shortHash(b.hash)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <div className="panel-hd">Latest Transactions</div>
          <ul className="list">
            {txs.slice(0, 10).map(t => (
              <li key={t.hash} className="row" onClick={()=>setView({type:'tx', hash:t.hash})}>
                <div className="row-l">
                  <div className="mono link">{shortHash(t.hash)}</div>
                  <div className="sub">{timeago(t.block.ts)}</div>
                </div>
                <div className="row-r">
                  <div className="pill mono">{formatAmount(t.amount)} COIN</div>
                  <div className="sub">
                    From <span className="mono">{shortAddr(t.from)}</span> to <span className="mono">{shortAddr(t.to)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

/* ---------- Block Detail ---------- */
function BlockDetail({ hash, onBack }) {
  const db = getDb();
  const b = db.chain.blocks.find(x => x.hash === hash) || db.chain.blocks.find(x => String(x.index) === String(hash));
  if (!b) return <Empty onBack={onBack} label="Block not found" />;

  const coinbase = b.txs.find(t => t.type === 'coinbase');
  const txs = b.txs.filter(t => t.type !== 'coinbase');
  const size = new TextEncoder().encode(JSON.stringify(b)).length;

  return (
    <main className="expl-wrap">
      <button className="back-btn" onClick={onBack} aria-label="Back">
        <FaArrowLeft />
      </button>
      <div className="panel block">
        <div className="panel-hd">Block #{b.index}</div>
        <div className="kv"><span>Hash</span><code>{b.hash}</code></div>
        <div className="kv"><span>Status</span><b className="ok">Finalized</b></div>
        <div className="kv"><span>Timestamp</span><span>{new Date(b.timestamp).toLocaleString()}</span></div>
        <div className="kv"><span>Transactions</span><span>{txs.length} (excl. coinbase)</span></div>
        <div className="kv"><span>Miner</span><code>{coinbase?.to || '—'}</code></div>
        <div className="kv"><span>Block Reward</span><span>{coinbase?.amount ?? 0} COIN</span></div>
        <div className="kv"><span>Size</span><span>{size} bytes</span></div>
        <div className="kv"><span>Prev Hash</span><code>{b.prevHash}</code></div>
      </div>

      <div className="panel">
        <div className="panel-hd">Transactions</div>
        <ul className="list">
          {txs.length ? txs.map((t, i) => {
            const hash = '0x' + keccak_256(JSON.stringify({ t, i, bh: b.hash }));
            return (
              <li key={hash} className="row">
                <div className="row-l">
                  <div className="mono">{shortHash(hash)}</div>
                </div>
                <div className="row-r">
                  <div className="pill mono">{formatAmount(t.amount)} COIN</div>
                  <div className="sub">From <span className="mono">{shortAddr(t.from)}</span> to <span className="mono">{shortAddr(t.to)}</span></div>
                </div>
              </li>
            );
          }) : <div className="sub" style={{padding:'12px'}}>No transactions</div>}
        </ul>
      </div>
    </main>
  );
}

/* ---------- Tx Detail ---------- */
function TxDetail({ hash, onBack }) {
  const db = getDb();

  let found = null, block = null;
  outer: for (const b of db.chain.blocks) {
    for (let i = 0; i < b.txs.length; i++) {
      const t = b.txs[i];
      if (t.type === 'coinbase') continue;
      const h = '0x' + keccak_256(JSON.stringify({ t, i, bh: b.hash }));
      if (h === hash) { found = t; block = b; break outer; }
    }
  }
  if (!found) return <Empty onBack={onBack} label="Transaction not found" />;

  return (
    <main className="expl-wrap">
      <button className="back-btn" onClick={onBack} aria-label="Back">
        <FaArrowLeft />
      </button>
      <div className="panel">
        <div className="panel-hd">Transaction</div>
        <div className="kv"><span>Hash</span><code>{hash}</code></div>
        <div className="kv"><span>Status</span><b className="ok">Success</b></div>
        <div className="kv"><span>Block</span><span>#{block.index}</span></div>
        <div className="kv"><span>Timestamp</span><span>{new Date(block.timestamp).toLocaleString()}</span></div>
        <div className="kv"><span>From</span><code>{found.from}</code></div>
        <div className="kv"><span>To</span><code>{found.to}</code></div>
        <div className="kv"><span>Value</span><span>{formatAmount(found.amount)} COIN</span></div>
      </div>
    </main>
  );
}

/* ---------- Bits & pieces ---------- */
function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-val">{value}</div>
      <div className="stat-lbl">{label}</div>
    </div>
  );
}
function Empty({ onBack, label }) {
  return (
    <main className="expl-wrap">
      <button className="back-btn" onClick={onBack} aria-label="Back">
        <FaArrowLeft />
      </button>
      <div className="panel"><div className="panel-hd">{label}</div></div>
    </main>
  );
}

function timeago(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts)/1000));
  if (s<60) return `${s}s ago`;
  const m=Math.floor(s/60); if(m<60) return `${m}m ago`;
  const h=Math.floor(m/60); if(h<24) return `${h}h ago`;
  const d=Math.floor(h/24); return `${d}d ago`;
}
function shortHash(h) {
  return h.length>19 ? `${h.slice(0,10)}...${h.slice(-9)}` : h;
}
function shortAddr(a) {
  return a ? shortHash(a) : '—';
}
function formatAmount(n) {
  return Number(n).toLocaleString(undefined,{maximumFractionDigits:8});
}
