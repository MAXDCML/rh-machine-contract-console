import { CheckCircle2, Clock3, LoaderCircle, ReceiptText, XCircle } from 'lucide-react'
import type { TransactionRecord } from '../types'
import { shortenAddress } from '../features/contracts/contractUtils'

export function TransactionTray({ transactions }: { transactions: TransactionRecord[] }) {
  if (transactions.length === 0) return null
  return (
    <aside className="transaction-tray" aria-label="Recent transactions">
      <div className="tray-heading"><ReceiptText size={16} /> Recent activity</div>
      {transactions.slice(0, 3).map((transaction) => (
        <div className="transaction-row" key={transaction.hash}>
          <span className={`tx-status ${transaction.status}`}>
            {transaction.status === 'pending' ? <LoaderCircle className="spin" size={14} /> : transaction.status === 'confirmed' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          </span>
          <span><strong>{transaction.label}</strong><small className="mono">{shortenAddress(transaction.hash, 7)}</small></span>
          <Clock3 size={13} />
        </div>
      ))}
    </aside>
  )
}
