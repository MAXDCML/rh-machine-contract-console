import { ChevronDown, LoaderCircle, Wallet } from 'lucide-react'
import { shortenAddress } from '../features/contracts/contractUtils'

type Props = {
  account: string | null
  connecting: boolean
  onConnect: () => void
}

export function WalletButton({ account, connecting, onConnect }: Props) {
  return (
    <button className={`wallet-button ${account ? 'is-connected' : ''}`} onClick={onConnect} disabled={connecting} type="button">
      {connecting ? <LoaderCircle className="spin" size={17} /> : <Wallet size={17} />}
      <span>{connecting ? 'Connecting…' : account ? shortenAddress(account) : 'Connect MetaMask'}</span>
      {account && <ChevronDown size={14} aria-hidden="true" />}
    </button>
  )
}
