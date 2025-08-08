import './header.css';
import { FaCoins } from 'react-icons/fa';

export default function Header() {
  return (
		<header className="site-header">
			<div className="header-pill">
				{/* Brand */}
				<div className="brand">
					<div className="brand-logo" aria-hidden="true">
						<FaCoins className="brand-icon" aria-hidden="true" />
					</div>
					<span className="brand-name">MYCOIN561</span>
				</div>

				{/* Nav */}
				<nav className="main-nav" aria-label="Primary">
					<a href="#">Send Tokens</a>
					<a href="#">TX History</a>
				</nav>

				{/* CTA */}
				<a href="#" className="cta">Access my wallet</a>
			</div>
		</header>
  );
}
