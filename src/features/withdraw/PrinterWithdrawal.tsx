import { useEffect, useState } from 'react'
import { Contract, Interface, formatUnits, type BrowserProvider } from 'ethers'
import { AlertTriangle, ArrowDownToLine, CheckCircle2, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { friendlyError, shortenAddress, validateAddress } from '../contracts/contractUtils'
import {
  MACHINE_ABI,
  MACHINES_COLLECTION_ABI,
  PRINTER_ABI,
  PRINTER_ADDRESS,
  ROBINHOOD_CHAIN_ID,
  V1_MACHINES_COLLECTION_ADDRESS,
  V2_MACHINES_COLLECTION_ADDRESS,
} from '../contracts/presets'

type MachineVersion = 'v1' | 'v2'

type BalanceState = {
  raw: bigint
  formatted: string
  formattedWhole: string
  decimals: number
  symbol: string
  machineId: number
  version: MachineVersion
  collectionAddress: string
  machineAddress: string
  owner: string
  deployed: boolean
}

type OwnedMachine = {
  id: number
}

type Props = {
  provider: BrowserProvider | null
  account: string | null
  chainId: bigint | null
  networkName: string | null
  onConnect: () => void
  onTransaction: (hash: string, label: string) => void
}

const BLOCKSCOUT_API = 'https://robinhoodchain.blockscout.com/api/v2'

function collectionFor(version: MachineVersion) {
  return version === 'v1' ? V1_MACHINES_COLLECTION_ADDRESS : V2_MACHINES_COLLECTION_ADDRESS
}

export function PrinterWithdrawal({ provider, account, chainId, networkName, onConnect, onTransaction }: Props) {
  const [machineVersion, setMachineVersion] = useState<MachineVersion>('v1')
  const [machineId, setMachineId] = useState('968')
  const [tokenAddress, setTokenAddress] = useState(PRINTER_ADDRESS)
  const [recipient, setRecipient] = useState('')
  const [balance, setBalance] = useState<BalanceState | null>(null)
  const [ownedMachines, setOwnedMachines] = useState<OwnedMachine[]>([])
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successHash, setSuccessHash] = useState<string | null>(null)

  useEffect(() => {
    if (account) setRecipient(account)
  }, [account])

  useEffect(() => {
    if (!account || chainId !== ROBINHOOD_CHAIN_ID) {
      setOwnedMachines([])
      return
    }

    const controller = new AbortController()
    const loadOwnedMachines = async () => {
      try {
        const collectionAddress = collectionFor(machineVersion)
        const query = new URLSearchParams({
          type: 'ERC-721',
          token_contract_address_hash: collectionAddress,
        })
        const response = await fetch(`${BLOCKSCOUT_API}/addresses/${account}/nft?${query}`, { signal: controller.signal })
        if (!response.ok) return
        const data = await response.json() as {
          items?: Array<{ id?: string; token?: { address_hash?: string } }>
        }
        const machines = (data.items ?? [])
          .filter((item) => item.token?.address_hash?.toLowerCase() === collectionAddress.toLowerCase())
          .map((item) => Number(item.id))
          .filter((id) => Number.isSafeInteger(id) && id > 0)
          .sort((a, b) => a - b)
          .map((id) => ({ id }))
        setOwnedMachines(machines)
      } catch {
        if (!controller.signal.aborted) setOwnedMachines([])
      }
    }
    void loadOwnedMachines()
    return () => controller.abort()
  }, [account, chainId, machineVersion])

  const checkBalance = async (requestedId = machineId, requestedVersion = machineVersion) => {
    setError(null)
    setSuccessHash(null)
    setBalance(null)
    setArmed(false)
    if (!provider) {
      setError('Open this URL in the same Chrome profile where MetaMask is installed and allowed on localhost.')
      return
    }

    setChecking(true)
    try {
      const network = await provider.getNetwork()
      if (network.chainId !== ROBINHOOD_CHAIN_ID) {
        throw new Error(`Switch MetaMask to Robinhood Chain (chain 4663). You are connected to chain ${network.chainId}.`)
      }
      if (!/^\d+$/.test(requestedId.trim())) throw new Error('Machine ID must be a whole number.')
      const parsedMachineId = Number(requestedId)
      if (!Number.isSafeInteger(parsedMachineId) || parsedMachineId < 1 || parsedMachineId > 10_000) {
        throw new Error('Machine ID must be between 1 and 10,000.')
      }

      setMachineId(String(parsedMachineId))
      setMachineVersion(requestedVersion)
      const tokenAddressValue = validateAddress(tokenAddress, 'Token address')
      const collectionAddress = collectionFor(requestedVersion)
      const collection = new Contract(collectionAddress, MACHINES_COLLECTION_ABI, provider)
      const exists = Boolean(await collection.exists(parsedMachineId))
      if (!exists) throw new Error(`Machine #${parsedMachineId} does not exist in ${requestedVersion.toUpperCase()}.`)

      const [machineAddress, owner] = await Promise.all([
        collection.accountOf(parsedMachineId) as Promise<string>,
        collection.ownerOf(parsedMachineId) as Promise<string>,
      ])
      const code = await provider.getCode(machineAddress)
      const token = new Contract(tokenAddressValue, PRINTER_ABI, provider)
      const [raw, decimalsValue] = await Promise.all([
        token.balanceOf(machineAddress) as Promise<bigint>,
        token.decimals(),
      ])
      const decimals = Number(decimalsValue)
      let symbol = 'TOKEN'
      try {
        symbol = String(await token.symbol())
      } catch {
        symbol = 'TOKEN'
      }
      setBalance({
        raw,
        formatted: formatUnits(raw, decimals),
        formattedWhole: new Intl.NumberFormat().format(raw / (10n ** BigInt(decimals))),
        decimals,
        symbol,
        machineId: parsedMachineId,
        version: requestedVersion,
        collectionAddress,
        machineAddress,
        owner,
        deployed: code !== '0x',
      })
    } catch (nextError) {
      setError(friendlyError(nextError))
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (provider) void checkBalance()
    // Recheck when the provider/network changes; field edits are checked explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  const ownershipMismatch = Boolean(
    balance && account && balance.owner.toLowerCase() !== account.toLowerCase(),
  )

  const withdraw = async () => {
    setError(null)
    setSuccessHash(null)
    if (!provider || !account) {
      onConnect()
      return
    }
    if (!balance || balance.raw === 0n) {
      setError('There is no token balance available to withdraw.')
      return
    }
    if (balance.owner.toLowerCase() !== account.toLowerCase()) {
      setError(`The connected wallet does not own Machine #${balance.machineId}. Connect its current owner to withdraw.`)
      return
    }
    if (!armed) {
      setArmed(true)
      return
    }

    setSubmitting(true)
    try {
      const tokenAddressValue = validateAddress(tokenAddress, 'Token address')
      const recipientValue = validateAddress(recipient, 'Recipient')
      const signer = await provider.getSigner()

      if (!balance.deployed) {
        const collection = new Contract(balance.collectionAddress, MACHINES_COLLECTION_ABI, signer)
        const deployment = await collection.createAccount(balance.machineId)
        onTransaction(deployment.hash, `Deploy ${balance.version.toUpperCase()} Machine #${balance.machineId} wallet`)
        await deployment.wait()
        setBalance((current) => current ? { ...current, deployed: true } : current)
      }

      const tokenInterface = new Interface(PRINTER_ABI)
      const data = tokenInterface.encodeFunctionData('transfer', [recipientValue, balance.raw])
      const machine = new Contract(balance.machineAddress, MACHINE_ABI, signer)
      const execute = machine.getFunction('execute')

      // A dry run catches authorization failures before MetaMask approval.
      await execute.staticCall(tokenAddressValue, 0n, data, 0)
      const transaction = await execute(tokenAddressValue, 0n, data, 0)
      onTransaction(transaction.hash, `Withdraw ${balance.formatted} ${balance.symbol}`)
      setSuccessHash(transaction.hash)
      setArmed(false)
    } catch (nextError) {
      setError(friendlyError(nextError))
    } finally {
      setSubmitting(false)
    }
  }

  const editSource = () => {
    setBalance(null)
    setArmed(false)
    setError(null)
  }

  const selectVersion = (version: MachineVersion) => {
    setMachineVersion(version)
    editSource()
    if (provider) void checkBalance(machineId, version)
  }

  const resetReview = () => {
    setArmed(false)
    setError(null)
  }

  return (
    <section className="withdraw-panel" aria-labelledby="withdraw-title">
      <header className="withdraw-hero">
        <div>
          <p className="eyebrow">Guided action</p>
          <h2 id="withdraw-title">Withdraw tokens from a Machine</h2>
          <p>Resolve a V1 Machine’s canonical ERC-6551 wallet, then transfer its complete ERC-20 balance.</p>
        </div>
        <div className="security-chip"><ShieldCheck size={16} /> Simulated before signing</div>
      </header>

      <div className="withdraw-grid">
        <div className="withdraw-form-card">
          <div className="step-label"><span>1</span> Asset source</div>

          <div className="version-selector" role="group" aria-label="Machine contract version">
            <button type="button" className={machineVersion === 'v1' ? 'active' : ''} onClick={() => selectVersion('v1')}>
              <strong>V1</strong>
              <small>RH BTC original</small>
            </button>
            <button type="button" className={machineVersion === 'v2' ? 'active' : ''} onClick={() => selectVersion('v2')}>
              <strong>V2</strong>
              <small>RH Machines migration</small>
            </button>
          </div>

          {ownedMachines.length > 0 && (
            <div className="owned-machines">
              <small>Your detected {machineVersion.toUpperCase()} Machines</small>
              <div className="machine-chips">
                {ownedMachines.map((machine) => (
                  <button key={machine.id} type="button" onClick={() => void checkBalance(String(machine.id))}>
                    #{machine.id}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="input-grid two-column">
            <label>
              <span>Machine ID</span>
              <input
                className="mono"
                value={machineId}
                onChange={(event) => { setMachineId(event.target.value); editSource() }}
                inputMode="numeric"
                placeholder="968"
              />
              <small>The NFT token ID, not a wallet address</small>
            </label>
            <label>
              <span>ERC-20 token address</span>
              <input
                className="mono"
                value={tokenAddress}
                onChange={(event) => { setTokenAddress(event.target.value); editSource() }}
                spellCheck={false}
              />
              <small>Defaults to PRINTER</small>
            </label>
            <label>
              <span>Resolved Machine wallet</span>
              <input className="mono" value={balance?.machineAddress ?? ''} placeholder="Resolved on-chain after checking" readOnly />
              <small>Read from the selected {machineVersion.toUpperCase()} collection contract</small>
            </label>
          </div>
          <button className="secondary-button" type="button" onClick={() => void checkBalance()} disabled={checking}>
            {checking ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
            {checking ? 'Resolving…' : 'Resolve & check balance'}
          </button>

          <div className="step-divider" />

          <div className="step-label"><span>2</span> Destination</div>
          <label>
            <span>Recipient address</span>
            <input className="mono" value={recipient} onChange={(event) => { setRecipient(event.target.value); setArmed(false) }} placeholder="Connect wallet or enter 0x…" spellCheck={false} />
            <small>The connected wallet is filled in automatically, but you can change it.</small>
          </label>
        </div>

        <aside className="withdraw-summary">
          <p className="summary-label">Transaction summary</p>
          <div className="token-balance">
            <span>Available balance</span>
            <strong>{balance ? balance.formattedWhole : '—'}</strong>
            <small>{balance?.symbol ?? 'PRINTER'}</small>
          </div>
          <dl>
            <div><dt>Machine</dt><dd>{balance ? `#${balance.machineId}` : 'Not resolved'}</dd></div>
            <div><dt>Version</dt><dd>{balance ? balance.version.toUpperCase() : machineVersion.toUpperCase()}</dd></div>
            <div><dt>From</dt><dd className="mono" title={balance?.machineAddress}>{balance ? shortenAddress(balance.machineAddress) : 'Not resolved'}</dd></div>
            <div><dt>Owner</dt><dd className="mono" title={balance?.owner}>{balance ? shortenAddress(balance.owner) : 'Not resolved'}</dd></div>
            <div><dt>To</dt><dd className="mono" title={recipient}>{recipient ? shortenAddress(recipient) : 'Not connected'}</dd></div>
            <div><dt>Network</dt><dd>{networkName ?? 'Not detected'}</dd></div>
            <div><dt>Amount</dt><dd>Entire balance</dd></div>
          </dl>

          {balance && ownershipMismatch && (
            <div className="summary-message error" role="alert">
              <AlertTriangle size={17} />
              <span>Your connected wallet does not own Machine #{balance.machineId}. Only its current NFT owner can execute this wallet.</span>
            </div>
          )}
          {balance && balance.raw === 0n && (
            <div className="summary-message info" role="status">
              <AlertTriangle size={17} />
              <span>Machine #{balance.machineId} currently has 0 {balance.symbol} to withdraw.</span>
            </div>
          )}

          {armed && (
            <div className="review-warning">
              <AlertTriangle size={17} />
              <p><strong>Review carefully.</strong> This sends the entire balance and cannot be reversed.</p>
            </div>
          )}

          <button
            className={`withdraw-button ${armed ? 'armed' : ''}`}
            type="button"
            onClick={withdraw}
            disabled={submitting || checking || Boolean(account && (!balance || balance.raw === 0n || ownershipMismatch))}
          >
            {submitting ? <LoaderCircle className="spin" size={18} /> : armed ? <ShieldCheck size={18} /> : <ArrowDownToLine size={18} />}
            {submitting ? 'Preparing transaction…' : !account ? 'Connect wallet' : !balance ? 'Check balance first' : armed ? 'Confirm in MetaMask' : 'Review withdrawal'}
          </button>
          {armed && <button className="cancel-review" type="button" onClick={resetReview}>Cancel review</button>}

          {error && <div className="summary-message error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
          {successHash && (
            <div className="summary-message success">
              <CheckCircle2 size={17} />
              <span>Transaction submitted <span className="mono">{shortenAddress(successHash, 7)}</span></span>
              <ExternalLink size={14} />
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
