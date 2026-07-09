'use client';
import { useState, useEffect } from 'react';

export default function ConnectWallet({ className = '' }: { className?: string }) {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      const provider = getProvider();
      if (!provider) return;

      try {
        const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          localStorage.setItem('connectedWallet', accounts[0]);
        }
      } catch (err) {
        console.error('Error checking wallet connection', err);
      }
    };
    checkConnection();
  }, []);

  const getProvider = () => {
    if (typeof window === 'undefined') return null;
    // Prefer OKX Wallet if available, fallback to window.ethereum
    const win = window as any;
    return win.okxwallet || win.ethereum || null;
  };

  const connect = async () => {
    setLoading(true);
    setError(null);
    const provider = getProvider();

    if (!provider) {
      setError('OKX Wallet or MetaMask extension not found');
      setLoading(false);
      // Open OKX Wallet download page in a new tab if not found
      if (typeof window !== 'undefined') {
        window.open('https://www.okx.com/web3', '_blank');
      }
      return;
    }

    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        localStorage.setItem('connectedWallet', accounts[0]);
        // Trigger custom event for other pages to update
        window.dispatchEvent(new Event('walletConnectionChanged'));
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    localStorage.removeItem('connectedWallet');
    window.dispatchEvent(new Event('walletConnectionChanged'));
  };

  if (address) {
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
        <div 
          style={{
            background: 'rgba(0, 242, 254, 0.1)',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            color: 'var(--cyan)',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'var(--font-mono)'
          }}
          title={address}
        >
          🟢 {shortAddress}
        </div>
        <button 
          onClick={disconnect}
          className="btn btn-outline btn-sm"
          style={{ padding: '6px 10px', borderColor: 'var(--border)' }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <button 
        onClick={connect} 
        disabled={loading}
        className={`btn btn-cyan btn-sm ${className}`}
      >
        {loading ? 'Connecting...' : '🔌 Connect Wallet'}
      </button>
      {error && (
        <span style={{ color: 'var(--pink)', fontSize: '11px', marginTop: '4px' }}>
          {error}
        </span>
      )}
    </div>
  );
}
