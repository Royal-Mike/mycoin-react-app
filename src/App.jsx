import { useState } from 'react';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Explorer from './pages/Explorer.jsx';
import Wallet from './pages/Wallet.jsx';
import Send from './pages/Send.jsx';
import Mine from './pages/Mine.jsx';
import './app.css';

export default function App() {
  const [page, setPage] = useState('onboarding');
  return (
    <div className="page">
      <Header activePage={page} onNavigate={setPage} />
				{page === 'explorer'
					? <Explorer />
					: page === 'wallet'
						? <Wallet />
						: page === 'send'
							? <Send onNavigate={setPage} />
							: page === 'mine'
								? <Mine onNavigate={setPage} />
								: <Onboarding />}
      <Footer />
    </div>
  );
}
