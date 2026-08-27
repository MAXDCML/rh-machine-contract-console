import { useMemo, useState, type FormEvent } from 'react'
import { Contract, ethers, type BrowserProvider, type FunctionFragment } from 'ethers'
import { CheckCircle2, ChevronDown, CircleDollarSign, LoaderCircle, Play, Send, TerminalSquare } from 'lucide-react'
import { formatResult, friendlyError, parseInputValue } from './contractUtils'

type Props = {
  address: string
  fragment: FunctionFragment
  provider: BrowserProvider | null
  account: string | null
  onConnect: () => void
  onTransaction: (hash: string, label: string) => void
}

export function FunctionCard({ address, fragment, provider, account, onConnect, onTransaction }: Props) {
  const [values, setValues] = useState<string[]>(() => fragment.inputs.map(() => ''))
  const [nativeValue, setNativeValue] = useState('')
  const [open, setOpen] = useState(fragment.inputs.length === 0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const readOnly = fragment.stateMutability === 'view' || fragment.stateMutability === 'pure'
  const signature = useMemo(() => fragment.format('sighash'), [fragment])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setResult(null)

    if (!provider) {
      setError('MetaMask is required to interact with this contract.')
      return
    }
    if (!readOnly && !account) {
      onConnect()
      return
    }

    setLoading(true)
    try {
      const args = fragment.inputs.map((input, index) => parseInputValue(values[index], input))
      if (readOnly) {
        const contract = new Contract(address, [fragment], provider)
        const response = await contract.getFunction(signature)(...args)
        setResult(formatResult(response))
      } else {
        const signer = await provider.getSigner()
        const contract = new Contract(address, [fragment], signer)
        const overrides = fragment.payable && nativeValue.trim()
          ? { value: ethers.parseEther(nativeValue.trim()) }
          : {}
        const transaction = await contract.getFunction(signature)(...args, overrides)
        onTransaction(transaction.hash, signature)
        setResult(`Submitted\n${transaction.hash}`)
      }
    } catch (nextError) {
      setError(friendlyError(nextError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <article className={`function-card ${open ? 'open' : ''}`}>
      <button className="function-heading" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className={`function-kind ${readOnly ? 'read' : 'write'}`}>
          {readOnly ? <TerminalSquare size={16} /> : <Send size={16} />}
        </span>
        <span className="function-title">
          <strong>{fragment.name}</strong>
          <small className="mono">{signature}</small>
        </span>
        <span className={`mutability ${readOnly ? 'read' : 'write'}`}>{readOnly ? 'read' : fragment.stateMutability}</span>
        <ChevronDown className={open ? 'rotate' : ''} size={17} />
      </button>

      {open && (
        <form className="function-body" onSubmit={submit}>
          {fragment.inputs.length > 0 && (
            <div className="input-grid">
              {fragment.inputs.map((input, index) => (
                <label key={`${input.name}-${index}`}>
                  <span>{input.name || `Argument ${index + 1}`} <code>{input.type}</code></span>
                  {input.baseType === 'bool' ? (
                    <select value={values[index]} onChange={(event) => setValues((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}>
                      <option value="">Select…</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      className="mono"
                      value={values[index]}
                      onChange={(event) => setValues((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                      placeholder={input.baseType === 'array' || input.baseType === 'tuple' ? 'JSON value' : input.type}
                      spellCheck={false}
                    />
                  )}
                </label>
              ))}
            </div>
          )}

          {fragment.payable && (
            <label className="native-value">
              <span><CircleDollarSign size={14} /> Native value <code>ETH/RH</code></span>
              <input value={nativeValue} onChange={(event) => setNativeValue(event.target.value)} placeholder="0.0" inputMode="decimal" />
            </label>
          )}

          <div className="function-actions">
            <button className={readOnly ? 'secondary-button' : 'primary-button'} type="submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={16} /> : readOnly ? <Play size={16} /> : <Send size={16} />}
              {loading ? 'Working…' : readOnly ? 'Query' : account ? 'Write contract' : 'Connect to write'}
            </button>
            {fragment.outputs?.length > 0 && (
              <span className="returns">Returns {fragment.outputs.map((output) => output.type).join(', ')}</span>
            )}
          </div>

          {result && (
            <div className="result-box success">
              <CheckCircle2 size={16} />
              <pre>{result}</pre>
            </div>
          )}
          {error && <div className="result-box error"><pre>{error}</pre></div>}
        </form>
      )}
    </article>
  )
}
