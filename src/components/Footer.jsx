import './footer.css';
import {
  FaFacebookF, FaTwitter, FaInstagram, FaLinkedinIn,
  FaGithub, FaRedditAlien, FaTelegramPlane,
  FaEthereum, FaBitcoin
} from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-col">
          <a href="#">About us</a>
          <a href="#">Careers</a>
          <a href="#">How it works</a>
          <a href="#">Team</a>
          <a href="#">Advertise With Us</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Bug Bounty</a>
        </div>

        <div className="footer-col">
          <a href="#">MyCoin Mobile App</a>
          <a href="#">Enkrypt</a>
          <a href="#">MyCoin Portfolio Manager</a>
          <a href="#">ethVM</a>
          <a href="#">Blog</a>
          <a href="#">Press Kit</a>
        </div>

        <div className="footer-col">
          <a href="#">Help Center</a>
          <a href="#">Customer Support</a>
          <a href="#">Security Policy</a>
          <a href="#">Verify Message</a>
          <a href="#">Convert Units</a>
          <a href="#">Send Offline Helper</a>
        </div>

        <div className="footer-col donate">
          <p>
            Help us keep MyCoin free and open-source; your donations go a long way
            towards making that possible.
          </p>
          <a href="#" className="donation-link" style={{ color: 'darkblue' }}>
            <FaEthereum /> <span>Ethereum Donation</span>
          </a>
          <a href="#" className="donation-link" style={{ color: 'orange' }}>
            <FaBitcoin /> <span>Bitcoin Donation</span>
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="legal">
          <p>© 2025 MyCoin. All rights reserved.</p>
          <p>Pricing taken from CoinGecko.</p>

          <label className="toggle">
            <input className="toggle-input" type="checkbox" defaultChecked />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
            <span className="toggle-text">Data Tracking On</span>
          </label>

          <p className="version">Version: v1.0.0</p>
        </div>

        <div className="community">
          <h4>Join MyCoin Community</h4>
          <div className="socials">
            <a href="#" aria-label="Facebook"><FaFacebookF /></a>
            <a href="#" aria-label="Twitter"><FaTwitter /></a>
            <a href="#" aria-label="Instagram"><FaInstagram /></a>
            <a href="#" aria-label="LinkedIn"><FaLinkedinIn /></a>
            <a href="#" aria-label="GitHub"><FaGithub /></a>
            <a href="#" aria-label="Reddit"><FaRedditAlien /></a>
            <a href="#" aria-label="Telegram"><FaTelegramPlane /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
