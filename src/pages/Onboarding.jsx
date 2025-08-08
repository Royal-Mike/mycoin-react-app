import { useEffect, useMemo, useState } from "react";
import "./onboarding.css";
import { FaArrowLeft, FaEye, FaEyeSlash, FaGithub, FaInstagram, FaRedditAlien } from "react-icons/fa6";
import { FaXTwitter } from "react-icons/fa6";
import { generateMnemonic12, mnemonicToSeed, deriveEthereumAccount, saveVaultEncrypted } from "../crypto/wallet-lib";

const ACCENT = "var(--page-blue)";

function Strength({ score }) {
  const label = score >= 4 ? "Very strong" : score === 3 ? "Strong" : score === 2 ? "Fair" : score === 1 ? "Weak" : "";
  return (
    <div className="strength">
      <div className="strength-bar" style={{ width: `${(score/4)*100}%`, background: ACCENT }} />
      <div className="strength-text" style={{ color: ACCENT }}>{label}</div>
    </div>
  );
}

function usePasswordStrength(password) {
  return useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  }, [password]);
}

function BackBtn({ onClick }) {
  return (
    <button className="back-btn" onClick={onClick} aria-label="Back">
      <FaArrowLeft />
    </button>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState("landing"); // landing | pwd1 | pwd2 | phrase | verify | ready
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [mnemonic, setMnemonic] = useState([]);
  const [checks, setChecks] = useState([]); // [{index, options:[...], answer}]
  const [selected, setSelected] = useState({}); // index->word
  const strength = usePasswordStrength(password);

  // when entering 'phrase', generate a new one
  useEffect(() => {
    if (step === "phrase") {
      const phrase = generateMnemonic12(); // 12 words
      setMnemonic(phrase.trim().split(/\s+/));
    }
  }, [step]);

  // build verification prompts when entering verify
  useEffect(() => {
    if (step === "verify" && mnemonic.length === 12) {
      const picks = new Set();
      while (picks.size < 4) {
        picks.add(Math.floor(Math.random() * 12)); // 0..11
      }
      const arr = Array.from(picks);
      const out = arr.map((i) => {
        // one correct + two decoys from the mnemonic (different words)
        const decoys = [];
        while (decoys.length < 2) {
          const j = Math.floor(Math.random() * 12);
          const w = mnemonic[j];
          if (j !== i && !decoys.includes(w)) decoys.push(w);
        }
        const options = [mnemonic[i], ...decoys].sort(() => Math.random() - 0.5);
        return { index: i, options, answer: mnemonic[i] };
      });
      setChecks(out);
      setSelected({});
    }
  }, [step, mnemonic]);

	async function finish() {
		const seed = await mnemonicToSeed(mnemonic.join(" "), "");
		const acct = deriveEthereumAccount(seed, "m/44'/60'/0'/0/0");
		await saveVaultEncrypted(
			{ createdAt: Date.now(), address: acct.address, path: acct.path, pubKey: acct.publicKeyHex, privKey: acct.privateKeyHex },
			password
		);
		setStep("ready");
	}

  const canGoPwd1Next = strength >= 2 && password.length >= 8;
  const canGoPwd2Next = canGoPwd1Next && password2 === password;
  const verifyPassed =
    checks.length > 0 && checks.every(({ index, answer }) => selected[index] === answer);

  return (
    <main className="onb-wrap">
      {step === "landing" && (
        <section className="card landing">
          <h1 className="h1">Multiple Chains.<br/>One Wallet.</h1>
          <p className="muted">MyCoin is a wallet that gives you easy access to all things crypto and web3.</p>
          <p className="muted">Switch accounts and chains with 1 click.<br/>MyCoin currently supports the Ethereum and Polkadot ecosystems with more chains on the way!</p>

          <button className="btn primary" onClick={() => setStep("pwd1")}>Create a new wallet</button>
          <button className="btn link" onClick={() => alert("Restore flow not implemented in this demo")}>Restore existing wallet</button>
        </section>
      )}

      {step === "pwd1" && (
        <section className="card form">
          <BackBtn onClick={() => setStep("landing")} />
          <h2 className="h2">Pick a password</h2>
          <p className="muted">This will be used to unlock your wallet.</p>

          <div className="input-wrap">
            <input
              type={showPwd1 ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
            />
            <button className="icon-btn" onClick={() => setShowPwd1(v => !v)} aria-label="Toggle password">
              {showPwd1 ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <Strength score={strength} />

          <button className="btn primary" disabled={!canGoPwd1Next} onClick={() => setStep("pwd2")}>Next</button>
          <p className="hint">Best passwords are long and contain letters, numbers and special characters.</p>
        </section>
      )}

      {step === "pwd2" && (
        <section className="card form">
          <BackBtn onClick={() => setStep("pwd1")} />
          <h2 className="h2">Confirm your password</h2>
          <p className="muted">MyCoin is non-custodial. We cannot restore or reset your password for you. Make sure you remember it.</p>

          <div className="input-wrap">
            <input
              type={showPwd2 ? "text" : "password"}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Re-enter password..."
            />
            <button className="icon-btn" onClick={() => setShowPwd2(v => !v)} aria-label="Toggle password">
              {showPwd2 ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <button className="btn primary" disabled={!canGoPwd2Next} onClick={() => setStep("phrase")}>Next</button>
        </section>
      )}

      {step === "phrase" && (
        <section className="card phrase">
          <BackBtn onClick={() => setStep("pwd2")} />
          <h2 className="h2">Secret recovery<br/>phrase</h2>
          <p className="warn">
            This is the recovery phrase for your wallet. You and you alone have access to it. It can be used to restore your wallet.
            Best practices for your recovery phrase are to write it down on paper and store it somewhere secure. Resist temptation to email it to yourself or screenshot it.
          </p>

          <ol className="grid-phrase">
            {mnemonic.map((w, i) => (
              <li key={i}><span className="idx">{i+1}</span> {w}</li>
            ))}
          </ol>

          <button className="btn primary" onClick={() => setStep("verify")}>Next</button>
        </section>
      )}

      {step === "verify" && (
        <section className="card verify">
          <BackBtn onClick={() => setStep("phrase")} />
          <h2 className="h2">Let's double check it</h2>

          {checks.map(({ index, options }) => (
            <div key={index} className="verify-row">
              <div className="verify-title">Select word <b>#{index+1}</b></div>
              <div className="verify-options">
                {options.map((opt) => {
                  const active = selected[index] === opt;
                  return (
                    <button
                      key={opt}
                      className={`chip ${active ? "active" : ""}`}
                      onClick={() => setSelected((s) => ({ ...s, [index]: opt }))}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <button className="btn primary" disabled={!verifyPassed} onClick={finish}>
            Next
          </button>
        </section>
      )}

      {step === "ready" && (
        <section className="card ready">
          <h2 className="h2">Your wallet is ready</h2>

          <div className="follow">
            <span>Follow us</span>
            <div className="icons">
              <FaGithub /><FaInstagram /><FaRedditAlien /><FaXTwitter />
            </div>
          </div>

          <button className="btn primary" onClick={() => alert("All set!")}>Finish</button>
          <button className="btn link" onClick={() => alert('Open how-to guide')}>
            How to get started 👉
          </button>
        </section>
      )}
    </main>
  );
}
