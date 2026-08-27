import { useMemo, useState } from 'react'
import { Interface, type BrowserProvider, type FunctionFragment } from 'ethers'
import { Braces, Search, SlidersHorizontal } from 'lucide-react'
import type { ContractConfig } from '../../types'
import { shortenAddress } from './contractUtils'
import { FunctionCard } from './FunctionCard'

type Filter = 'all' | 'read' | 'write'

type Props = {
  config: ContractConfig
  provider: BrowserProvider | null
  account: string | null
  onConnect: () => void
  onTransaction: (hash: string, label: string) => void
}

export function ContractConsole({ config, provider, account, onConnect, onTransaction }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const functions = useMemo(() => {
    const contractInterface = new Interface(config.abi)
    return contractInterface.fragments.filter((fragment): fragment is FunctionFragment => fragment.type === 'function')
  }, [config.abi])

  const counts = useMemo(() => ({
    read: functions.filter((fragment) => fragment.stateMutability === 'view' || fragment.stateMutability === 'pure').length,
    write: functions.filter((fragment) => fragment.stateMutability !== 'view' && fragment.stateMutability !== 'pure').length,
  }), [functions])

  const visible = functions.filter((fragment) => {
    const readOnly = fragment.stateMutability === 'view' || fragment.stateMutability === 'pure'
    const matchesFilter = filter === 'all' || (filter === 'read' ? readOnly : !readOnly)
    const matchesSearch = fragment.format('sighash').toLowerCase().includes(search.toLowerCase().trim())
    return matchesFilter && matchesSearch
  })

  return (
    <section className="console-panel" aria-labelledby="console-title">
      <header className="contract-header">
        <div className="contract-identicon"><Braces size={23} /></div>
        <div>
          <p className="eyebrow">Active contract</p>
          <h2 id="console-title">{config.name}</h2>
          <p className="mono contract-address" title={config.address}>{shortenAddress(config.address, 8)}</p>
        </div>
        <div className="contract-stats">
          <span><strong>{functions.length}</strong> functions</span>
          <span><strong>{counts.read}</strong> read</span>
          <span><strong>{counts.write}</strong> write</span>
        </div>
      </header>

      <div className="console-toolbar">
        <div className="filter-tabs" role="group" aria-label="Function type">
          {(['all', 'read', 'write'] as const).map((item) => (
            <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              {item === 'all' ? 'All functions' : item === 'read' ? 'Read' : 'Write'}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={16} />
          <span className="sr-only">Search functions</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search functions…" />
        </label>
      </div>

      <div className="function-list">
        {visible.map((fragment) => (
          <FunctionCard
            key={fragment.format('sighash')}
            address={config.address}
            fragment={fragment}
            provider={provider}
            account={account}
            onConnect={onConnect}
            onTransaction={onTransaction}
          />
        ))}
        {visible.length === 0 && (
          <div className="empty-state">
            <SlidersHorizontal size={22} />
            <strong>No functions match</strong>
            <p>Try a different function type or search term.</p>
          </div>
        )}
      </div>
    </section>
  )
}
