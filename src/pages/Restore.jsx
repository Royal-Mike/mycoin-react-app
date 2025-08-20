import { useState } from "react";
import "./onboarding.css";
import "./restore.css";
import * as bip39 from "bip39";
import { mnemonicToSeed, deriveEthereumAccount } from "../crypto/wallet-lib";
import { addWalletHashed, setActiveWallet } from "../storage/localDb";

const VALID_COUNTS = new Set([12, 15, 18, 21, 24]);

export default function Restore({ onNavigate }) {
  const [step, setStep] = useState("phrase"); // 'phrase' | 'password'
  const [phrase, setPhrase] = useState("");
  const [err, setErr] = useState("");

  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  function normalize(s) {
    return s.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function validatePhrase() {
    const words = normalize(phrase).split(" ").filter(Boolean);
    if (!VALID_COUNTS.has(words.length)) return "Phrase must be 12, 15, 18, 21 or 24 words.";
    if (!bip39.validateMnemonic(words.join(" "))) return "Not a valid BIP-39 phrase.";
    return "";
  }

  async function nextFromPhrase() {
    const e = validatePhrase();
    if (e) { setErr(e); return; }
    setErr(""); setStep("password");
  }

  async function finishRestore() {
    if (!pwd1 || pwd1.length < 6) { setPwdErr("Password must be at least 6 characters."); return; }
    if (pwd1 !== pwd2) { setPwdErr("Passwords do not match."); return; }
    setPwdErr("");

    const words = normalize(phrase).split(" ");
    const seed = await mnemonicToSeed(words.join(" "), "");
    const acct = deriveEthereumAccount(seed, "m/44'/60'/0'/0/0");

    await addWalletHashed({
      address: acct.address,
      path: acct.path,
      publicKey: acct.publicKeyHex,
      privateKey: acct.privateKeyHex,
      mnemonic: words.join(" "),     // will be ENCRYPTED inside addWalletHashed
    }, pwd1);

    setActiveWallet(acct.address);
    onNavigate?.("wallet");
  }

  return (
    <main className="onb-wrap">
      {step === "phrase" && (
        <section className="card form">
          <h2 className="h2">Enter your recovery phrase</h2>
          <p className="muted">You can use 12, 15, 18, 21 or 24 words to restore your wallet.</p>

          <textarea
            className="textarea"
            rows={6}
            placeholder="Enter your 12–24 word phrase here..."
            value={phrase}
            onChange={(e)=>setPhrase(e.target.value)}
          />
          {err && <div className="error">{err}</div>}

          <button
            className="btn primary"
            onClick={nextFromPhrase}
            disabled={normalize(phrase).split(" ").filter(Boolean).length < 12}
          >
            Next
          </button>
        </section>
      )}

      {step === "password" && (
        <section className="card form">
          <h2 className="h2">Set a password</h2>
          <p className="muted">This protects your wallet locally and encrypts your recovery phrase.</p>

          <input
            className="input"
            type="password"
            placeholder="Password"
            value={pwd1}
            onChange={(e)=>setPwd1(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Confirm password"
            value={pwd2}
            onChange={(e)=>setPwd2(e.target.value)}
          />
          {pwdErr && <div className="error">{pwdErr}</div>}

          <div className="actions">
            <button className="btn" onClick={()=>setStep("phrase")}>Back</button>
            <button className="btn primary" onClick={finishRestore}>Restore</button>
          </div>
        </section>
      )}
    </main>
  );
}
