import { useRef, useState } from 'react'
import { Contract, formatUnits, type BrowserProvider } from 'ethers'
import { ExternalLink, LoaderCircle, Radar, RefreshCw, SearchCheck, WalletCards } from 'lucide-react'
import { friendlyError, shortenAddress } from '../contracts/contractUtils'
import {
  MACHINES_COLLECTION_ABI,
  PRINTER_ABI,
  PRINTER_ADDRESS,
  ROBINHOOD_CHAIN_ID,
  V2_MACHINES_COLLECTION_ADDRESS,
} from '../contracts/presets'

type Props = {
  provider: BrowserProvider | null
  chainId: bigint | null
  onConnect: () => void
}

type ListingsPage = {
  machineIds?: number[]
  next?: string | null
  error?: string
}

type ScanResult = {
  machineId: number
  machineAddress: string
  raw: bigint
  formatted: string
}

type Progress = {
  completed: number
  total: number
}

const OPENSEA_COLLECTION_URL = 'https://opensea.io/collection/rhmachines'
const BLOCKSCOUT_ADDRESS_URL = 'https://robinhoodchain.blockscout.com/address'
const SCAN_CONCURRENCY = 6

function wholeTokens(raw: bigint, decimals: number) {
  const whole = raw / (10n ** BigInt(decimals))
  if (whole === 0n && raw > 0n) return '<1'
  return new Intl.NumberFormat().format(whole)
}

async function loadAllListedMachineIds(signal: AbortSignal) {
  const machineIds = new Set<number>()
  const seenCursors = new Set<string>()
  let next: string | null = null

  for (let page = 0; page < 100; page += 1) {
    const query = next ? `?next=${encodeURIComponent(next)}` : ''
    const response = await fetch(`/api/opensea-listings${query}`, { signal })
    const payload = await response.json() as ListingsPage
    if (!response.ok) throw new Error(payload.error || `Unable to load OpenSea listings (HTTP ${response.status}).`)

    for (const machineId of payload.machineIds ?? []) {
      if (Number.isSafeInteger(machineId) && machineId > 0) machineIds.add(machineId)
    }

    next = payload.next ?? null
    if (!next) break
    if (seenCursors.has(next)) throw new Error('OpenSea returned a repeated pagination cursor.')
    seenCursors.add(next)
  }

  return [...machineIds].sort((a, b) => a - b)
}

export function ListedMachineScanner({ provider, chainId, onConnect }: Props) {
  const [results, setResults] = useState<ScanResult[]>([])
  const [listedCount, setListedCount] = useState<number | null>(null)
  const [failedCount, setFailedCount] = useState(0)
  const [tokenDecimals, setTokenDecimals] = useState(18)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const scan = async () => {
    if (!provider) {
      onConnect()
      return
    }
    if (chainId !== ROBINHOOD_CHAIN_ID) {
      setError(`Switch MetaMask to Robinhood Chain (chain 4663). You are connected to chain ${chainId ?? 'unknown'}.`)
      return
    }

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setScanning(true)
    setError(null)
    setResults([])
    setListedCount(null)
    setFailedCount(0)
    setProgress({ completed: 0, total: 0 })

    try {
      const machineIds = await loadAllListedMachineIds(controller.signal)
      setListedCount(machineIds.length)
      setProgress({ completed: 0, total: machineIds.length })

      if (machineIds.length === 0) return

      const collection = new Contract(V2_MACHINES_COLLECTION_ADDRESS, MACHINES_COLLECTION_ABI, provider)
      const printer = new Contract(PRINTER_ADDRESS, PRINTER_ABI, provider)
      const decimals = Number(await printer.decimals())
      setTokenDecimals(decimals)
      const matches: ScanResult[] = []
      let completed = 0
      let failures = 0
      let cursor = 0

      const worker = async () => {
        while (cursor < machineIds.length) {
          if (controller.signal.aborted) throw new DOMException('Scan cancelled.', 'AbortError')
          const machineId = machineIds[cursor]
          cursor += 1

          try {
            const machineAddress = String(await collection.accountOf(machineId))
            const raw = await printer.balanceOf(machineAddress) as bigint
            if (raw > 0n) {
              matches.push({
                machineId,
                machineAddress,
                raw,
                formatted: formatUnits(raw, decimals),
              })
            }
          } catch {
            failures += 1
          } finally {
            completed += 1
            setProgress({ completed, total: machineIds.length })
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(SCAN_CONCURRENCY, machineIds.length) }, worker))
      matches.sort((a, b) => b.raw > a.raw ? 1 : b.raw < a.raw ? -1 : a.machineId - b.machineId)
      setResults(matches)
      setFailedCount(failures)
    } catch (nextError) {
      if (!(nextError instanceof DOMException && nextError.name === 'AbortError')) {
        setError(friendlyError(nextError))
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      setScanning(false)
    }
  }

  const cancel = () => controllerRef.current?.abort()
  const totalRaw = results.reduce((sum, result) => sum + result.raw, 0n)
  const progressPercent = progress?.total ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <section className="scanner-panel" aria-labelledby="scanner-title">
      <header className="scanner-hero">
        <div>
          <p className="eyebrow">Marketplace intelligence</p>
          <h2 id="scanner-title">Listed V2 Machine scanner</h2>
          <p>Load every active V2 listing from OpenSea, resolve each Machine wallet, and find the wallets holding PRINTER.</p>
        </div>
        <a className="security-chip" href={OPENSEA_COLLECTION_URL} target="_blank" rel="noreferrer">
          OpenSea collection <ExternalLink size={13} />
        </a>
      </header>

      <div className="scanner-controls">
        <div className="scanner-control-copy">
          <span className="scanner-icon"><Radar size={22} /></span>
          <div>
            <strong>V2 RH Machines</strong>
            <small className="mono">{V2_MACHINES_COLLECTION_ADDRESS}</small>
          </div>
        </div>
        <div className="scanner-actions">
          {scanning && <button className="secondary-button" type="button" onClick={cancel}>Cancel</button>}
          <button className="primary-button" type="button" onClick={() => void scan()} disabled={scanning}>
            {scanning ? <LoaderCircle className="spin" size={16} /> : results.length > 0 ? <RefreshCw size={16} /> : <SearchCheck size={16} />}
            {!provider ? 'Connect wallet' : scanning ? 'Scanning wallets…' : results.length > 0 ? 'Scan again' : 'Scan listed Machines'}
          </button>
        </div>
      </div>

      {scanning && (
        <div className="scan-progress" role="status" aria-live="polite">
          <div><span>{progress?.total ? `Checking ${progress.completed} of ${progress.total} wallets` : 'Loading all active OpenSea listings…'}</span><strong>{progressPercent}%</strong></div>
          <div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
        </div>
      )}

      {error && <div className="summary-message error" role="alert"><span>{error}</span></div>}

      {listedCount !== null && !scanning && !error && (
        <div className="scan-stats" aria-label="Scan summary">
          <div><span>Active listings</span><strong>{listedCount}</strong></div>
          <div><span>With PRINTER</span><strong>{results.length}</strong></div>
          <div><span>Total PRINTER</span><strong>{wholeTokens(totalRaw, tokenDecimals)}</strong></div>
          <div><span>Read failures</span><strong>{failedCount}</strong></div>
        </div>
      )}

      <div className="scanner-results">
        {listedCount === null && !scanning && (
          <div className="scanner-empty">
            <WalletCards size={28} />
            <strong>No scan results yet</strong>
            <p>Connect MetaMask on Robinhood Chain, then scan the current OpenSea listings.</p>
          </div>
        )}

        {listedCount === 0 && !scanning && (
          <div className="scanner-empty"><SearchCheck size={28} /><strong>No active V2 listings</strong><p>OpenSea did not return any currently active listings.</p></div>
        )}

        {listedCount !== null && listedCount > 0 && results.length === 0 && !scanning && (
          <div className="scanner-empty"><SearchCheck size={28} /><strong>No PRINTER found</strong><p>All {listedCount} listed Machine wallets were checked.</p></div>
        )}

        {results.length > 0 && (
          <div className="scanner-table-wrap">
            <table className="scanner-table">
              <thead><tr><th>Machine</th><th>Wallet</th><th className="numeric">PRINTER</th><th><span className="sr-only">Links</span></th></tr></thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.machineId}>
                    <td><a href={`https://opensea.io/item/robinhood/${V2_MACHINES_COLLECTION_ADDRESS}/${result.machineId}`} target="_blank" rel="noreferrer">#{result.machineId}<ExternalLink size={12} /></a></td>
                    <td><a className="mono" href={`${BLOCKSCOUT_ADDRESS_URL}/${result.machineAddress}`} target="_blank" rel="noreferrer" title={result.machineAddress}>{shortenAddress(result.machineAddress)}<ExternalLink size={12} /></a></td>
                    <td className="numeric"><strong title={`${result.formatted} PRINTER`}>{wholeTokens(result.raw, tokenDecimals)}</strong></td>
                    <td><span className="positive-dot" title="PRINTER balance found" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="scanner-note">Balances are displayed as whole PRINTER rounded down. Hover a balance to see the exact token amount.</p>
          </div>
        )}
      </div>
    </section>
  )
}
