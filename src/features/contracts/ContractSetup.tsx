import { useEffect, useState, type FormEvent } from 'react'
import { Braces, Check, ChevronDown, FileJson2, Plus } from 'lucide-react'
import type { ContractConfig } from '../../types'
import { parseAbi, validateAddress } from './contractUtils'
import { PRESETS } from './presets'

type Props = {
  active: ContractConfig | null
  onLoad: (config: ContractConfig) => void
}

export function ContractSetup({ active, onLoad }: Props) {
  const [name, setName] = useState(active?.name ?? 'Custom contract')
  const [address, setAddress] = useState(active?.address ?? '')
  const [abiText, setAbiText] = useState(active?.abiText ?? '')
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(!active)

  useEffect(() => {
    if (!active) return
    setName(active.name)
    setAddress(active.address)
    setAbiText(active.abiText)
  }, [active])

  const loadPreset = (preset: ContractConfig) => {
    setName(preset.name)
    setAddress(preset.address)
    setAbiText(preset.abiText)
    setError(null)
    onLoad(preset)
    setExpanded(false)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      const checksummedAddress = validateAddress(address)
      const abi = parseAbi(abiText)
      onLoad({ name: name.trim() || 'Custom contract', address: checksummedAddress, abi, abiText })
      setError(null)
      setExpanded(false)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  return (
    <section className="setup-panel" aria-labelledby="contract-setup-title">
      <button className="setup-heading" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="setup-icon"><Braces size={17} /></span>
        <span>
          <strong id="contract-setup-title">Contract source</strong>
          <small>{active ? active.name : 'Choose a preset or paste an ABI'}</small>
        </span>
        <ChevronDown className={expanded ? 'rotate' : ''} size={17} />
      </button>

      {expanded && (
        <div className="setup-body">
          <div className="preset-list" aria-label="Contract presets">
            {PRESETS.map((preset) => (
              <button key={preset.address} type="button" onClick={() => loadPreset(preset)} className={active?.address === preset.address ? 'active' : ''}>
                <span><FileJson2 size={15} /> {preset.name}</span>
                {active?.address === preset.address && <Check size={15} />}
              </button>
            ))}
          </div>

          <div className="divider"><span>or paste your own</span></div>

          <form onSubmit={submit} className="contract-form">
            <label>
              <span>Label</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="My contract" />
            </label>
            <label>
              <span>Contract address</span>
              <input className="mono" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x…" spellCheck={false} />
            </label>
            <label>
              <span>Contract ABI</span>
              <textarea className="mono" value={abiText} onChange={(event) => setAbiText(event.target.value)} placeholder={'[\n  { "type": "function", … }\n]'} spellCheck={false} />
              <small>JSON ABI, artifact with an <code>abi</code> field, or one human-readable fragment per line.</small>
            </label>
            {error && <p className="field-error">{error}</p>}
            <button className="primary-button full" type="submit"><Plus size={16} /> Load contract</button>
          </form>
        </div>
      )}
    </section>
  )
}
