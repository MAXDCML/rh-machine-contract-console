import { useEffect, useState } from 'react'
import { Braces, CircleDot, Code2, Cpu, Github, Menu, X } from 'lucide-react'
import type { ContractConfig, TransactionRecord } from './types'
import { useWallet } from './features/wallet/useWallet'
import { PRESETS } from './features/contracts/presets'
import { ContractSetup } from './features/contracts/ContractSetup'
import { ContractConsole } from './features/contracts/ContractConsole'
import { parseAbi, validateAddress } from './features/contracts/contractUtils'
import { PrinterWithdrawal } from './features/withdraw/PrinterWithdrawal'
import { WalletButton } from './components/WalletButton'
import { Toast } from './components/Toast'
import { TransactionTray } from './components/TransactionTray'

type View = 'withdraw' | 'console'

function getInitialContract(): ContractConfig {
  try {
    const saved = localStorage.getItem('machine-console-contract')
    if (!saved) return PRESETS[0]
    const parsed = JSON.parse(saved) as { name?: string; address?: string; abiText?: string }
    if (!parsed.address || !parsed.abiText) return PRESETS[0]
    return {
      name: parsed.name || 'Saved contract',
      address: validateAddress(parsed.address),
      abi: parseAbi(parsed.abiText),
      abiText: parsed.abiText,
    }
  } catch {
    return PRESETS[0]
  }
}

export function App() {
  const wallet = useWallet()
  const [view, setView] = useState<View>('withdraw')
  const [contract, setContract] = useState<ContractConfig>(getInitialContract)
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const loadContract = (config: ContractConfig) => {
    setContract(config)
    setView('console')
    setSidebarOpen(false)
    localStorage.setItem('machine-console-contract', JSON.stringify({
      name: config.name,
      address: config.address,
      abiText: config.abiText,
    }))
  }

  const trackTransaction = (hash: string, label: string) => {
    setTransactions((current) => [{ hash, label, status: 'pending', timestamp: Date.now() }, ...current])
    if (!wallet.provider) return
    void wallet.provider.waitForTransaction(hash).then((receipt) => {
      setTransactions((current) => current.map((transaction) =>
        transaction.hash === hash
          ? { ...transaction, status: receipt?.status === 1 ? 'confirmed' : 'failed' }
          : transaction,
      ))
    }).catch(() => {
      setTransactions((current) => current.map((transaction) => transaction.hash === hash ? { ...transaction, status: 'failed' } : transaction))
    })
  }

  useEffect(() => {
    const closeSidebar = () => {
      if (window.innerWidth > 980) setSidebarOpen(false)
    }
    window.addEventListener('resize', closeSidebar)
    return () => window.removeEventListener('resize', closeSidebar)
  }, [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" type="button" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle navigation">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <a className="brand" href="#top" aria-label="Machine Console home">
          <span className="brand-mark"><Cpu size={20} /></span>
          <span>Machine<span>Console</span></span>
          <small>V1</small>
        </a>
        <div className="topbar-actions">
          <div className="network-pill"><CircleDot size={14} /><span>{wallet.networkName ?? 'No network'}</span></div>
          <WalletButton account={wallet.account} connecting={wallet.connecting} onConnect={wallet.connect} />
        </div>
      </header>

      <div className="workspace" id="top">
        <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
          <nav aria-label="Main navigation">
            <p className="nav-label">Workspace</p>
            <button className={view === 'withdraw' ? 'active' : ''} type="button" onClick={() => { setView('withdraw'); setSidebarOpen(false) }}>
              <span><Cpu size={18} /> Machine withdrawal</span><small>Guided</small>
            </button>
            <button className={view === 'console' ? 'active' : ''} type="button" onClick={() => { setView('console'); setSidebarOpen(false) }}>
              <span><Code2 size={18} /> Contract console</span><small>Advanced</small>
            </button>
          </nav>

          <ContractSetup active={contract} onLoad={loadContract} />
          <TransactionTray transactions={transactions} />

          <div className="sidebar-footer">
            <Braces size={15} />
            <span>Calls go directly through your wallet. No private keys are stored.</span>
          </div>
        </aside>

        {sidebarOpen && <button className="sidebar-scrim" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

        <main className="main-content">
          {wallet.error && <Toast kind="error" message={wallet.error} onClose={wallet.clearError} />}
          {view === 'withdraw' ? (
            <PrinterWithdrawal
              provider={wallet.provider}
              account={wallet.account}
              chainId={wallet.chainId}
              networkName={wallet.networkName}
              onConnect={wallet.connect}
              onTransaction={trackTransaction}
            />
          ) : (
            <ContractConsole
              config={contract}
              provider={wallet.provider}
              account={wallet.account}
              onConnect={wallet.connect}
              onTransaction={trackTransaction}
            />
          )}
          <footer className="main-footer">
            <span>Machine Console · Local-first contract tools</span>
            <a href="https://github.com/ethers-io/ethers.js" target="_blank" rel="noreferrer"><Github size={14} /> Powered by ethers.js</a>
          </footer>
        </main>
      </div>
    </div>
  )
}
