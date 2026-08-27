import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

type Props = {
  kind?: 'error' | 'success' | 'info'
  message: string
  onClose?: () => void
}

export function Toast({ kind = 'info', message, onClose }: Props) {
  const Icon = kind === 'error' ? AlertTriangle : kind === 'success' ? CheckCircle2 : Info
  return (
    <div className={`toast ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss message" type="button">
          <X size={16} />
        </button>
      )}
    </div>
  )
}
