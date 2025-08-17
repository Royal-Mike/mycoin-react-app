import './header.css';
import { FaCoins } from 'react-icons/fa';

export default function Header({ activePage, onNavigate }) {
  return (
		<header className="site-header">
			<div className="header-pill">
				{/* Brand */}
				<div className="brand" onClick={() => onNavigate?.('onboarding')} style={{cursor:'pointer'}}>
					<div className="brand-logo" aria-hidden="true">
						<FaCoins className="brand-icon" aria-hidden="true" />
					</div>
					<span className="brand-name">MYCOIN561</span>
				</div>

				{/* Nav */}
				<nav className="main-nav" aria-label="Primary">
					<a
            href="#"
            className={activePage === 'explorer' ? 'nav-active' : ''}
            onClick={(e) => { e.preventDefault(); onNavigate?.('explorer'); }}
          >
            Explorer
          </a>
					<a
						href="#"
						className={activePage === 'send' ? 'nav-active' : ''}
						onClick={(e) => { e.preventDefault(); onNavigate?.('send'); }}
					>
						Send coins
					</a>
				</nav>

				{/* CTA */}
				<a href="#" className="cta" onClick={(e)=>{e.preventDefault(); onNavigate?.('wallet');}}>
					Access my wallet
				</a>
			</div>
		</header>
  );
}
