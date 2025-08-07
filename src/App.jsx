// src/App.jsx
import { useState } from "react";
import { FaEye, FaArrowLeft, FaEthereum, FaBitcoin } from "react-icons/fa";

export default function App() {
  const [showPwdScreen, setShowPwdScreen] = useState(false);
  const [password, setPassword] = useState("");
  const strength = Math.min(100, password.length * 10);

  return (
    <div className="min-h-screen flex flex-col bg-[#184F90] font-sans">
      {/* Header */}
      <header className="flex items-center justify-between bg-[#BACBDE] w-3/5 p-3 rounded-full mx-auto mt-4">
        <div className="flex items-center gap-1">
          <div className="text-3xl">🪙</div>
          <span className="text-xl font-bold text-[#005575]">MyCoin</span>
        </div>
        <nav className="flex gap-5">
          <a href="#" className="font-medium hover:underline">Send Coins</a>
          <a href="#" className="font-medium hover:underline">TX History</a>
        </nav>
        <button className="bg-black text-white rounded-full px-5 py-2 font-bold">
          Access my wallet
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center">
        {!showPwdScreen ? (
          <section className="max-w-sm w-full p-4">
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h1 className="text-2xl font-bold mb-4">
                Multiple Chains.<br/>
                One Wallet.
              </h1>
              <p className="text-gray-600 mb-6">
                MyCoin is a wallet that gives you easy access to all things crypto and web3.
              </p>
              <button
                onClick={() => setShowPwdScreen(true)}
                className="block w-full bg-[#184F90] text-white rounded-md py-3 mb-3 disabled:opacity-60"
              >
                Create a new wallet
              </button>
              <button
                onClick={() => {/* restore flow */}}
                className="block w-full text-[#184F90] font-medium"
              >
                Restore existing wallet
              </button>
            </div>
          </section>
        ) : (
          <section className="max-w-sm w-full p-4">
            <div className="bg-white rounded-lg p-6 shadow-md">
              <button
                onClick={() => setShowPwdScreen(false)}
                className="text-xl mb-4"
              >
                <FaArrowLeft />
              </button>
              <h2 className="text-xl font-semibold mb-2">Pick a password</h2>
              <p className="text-sm text-gray-500 mb-4">
                This will be used to unlock your wallet.
              </p>
              <div className="relative mb-2">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full border border-gray-300 rounded px-4 py-2 pr-10 text-base"
                />
                <FaEye
                  className="absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                  onClick={() => {/* toggle visibility */}}
                />
              </div>
              <div className="h-1 bg-[#184F90] rounded transition-all mb-2"
                   style={{ width: `${strength}%` }} />
              <button
                disabled={password.length < 6}
                className="block w-full bg-[#184F90] text-white rounded-md py-3 mb-2 disabled:opacity-60"
              >
                Next
              </button>
              <p className="text-xs text-gray-500">
                Best passwords are long and contain letters, numbers and special characters.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#fff] text-gray-700 text-sm py-8">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-between gap-6 mb-8">
          {/* Column groups */}
          {[
            ["About us","Careers","How it works","Team","Advertise With Us","Privacy","Terms","Bug Bounty"],
            ["MyCoin Mobile App","Enkrypt","Portfolio Manager","ethVM","Blog","Press Kit"],
            ["Help Center","Customer Support","Security Policy","Verify Message","Convert Units","Send Offline Helper"],
            [],
          ].map((links, idx) => (
            <div key={idx} className="flex flex-col gap-2 min-w-[150px]">
              {idx < 3
                ? links.map((t,i) => <a key={i} href="#" className="font-bold hover:underline">{t}</a>)
                : (
                  <>
                    <p>Help us keep MyCoin free and open-source; your donations go a long way.</p>
                    <a href="#" className="flex items-center gap-1 font-bold hover:underline">
                      <FaEthereum /> Ethereum Donation
                    </a>
                    <a href="#" className="flex items-center gap-1 font-bold hover:underline">
                      <FaBitcoin /> Bitcoin Donation
                    </a>
                  </>
                )
              }
            </div>
          ))}
        </div>
        <div className="max-w-4xl mx-auto flex flex-wrap justify-between items-start gap-6 border-t pt-4">
          <div className="space-y-1">
            <p>© 2025 MyCoin. All rights reserved.</p>
            <p>Pricing taken from CoinGecko.</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="appearance-none w-10 h-5 bg-gray-300 rounded-full relative cursor-pointer checked:bg-green-400 transition-colors" />
              <span>Data Tracking On</span>
            </label>
            <p>Version: v1.0.0</p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Join MyCoin Community</h4>
            <div className="flex gap-3 flex-wrap">
              {["facebook-f","twitter","instagram","linkedin-in","github","reddit-alien","telegram-plane"].map(icon => (
                <a key={icon} href="#" className="p-2 border rounded-full text-gray-600 hover:bg-gray-100">
                  <i className={`fab fa-${icon}`}></i>
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
