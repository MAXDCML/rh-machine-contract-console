import { Interface, ParamType, getAddress, isAddress, type JsonFragment, type Result } from 'ethers'

export function parseAbi(text: string): readonly (string | JsonFragment)[] {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Paste a contract ABI to continue.')

  try {
    const parsed: unknown = JSON.parse(trimmed)
    const abi =
      typeof parsed === 'object' && parsed !== null && 'abi' in parsed
        ? (parsed as { abi: unknown }).abi
        : parsed

    if (!Array.isArray(abi)) throw new Error('ABI JSON must be an array.')
    new Interface(abi as (string | JsonFragment)[])
    return abi as (string | JsonFragment)[]
  } catch (error) {
    if (error instanceof SyntaxError) {
      const fragments = trimmed
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/,$/, ''))
        .filter(Boolean)
      try {
        new Interface(fragments)
        return fragments
      } catch {
        throw new Error('Invalid ABI. Paste a JSON ABI array or one human-readable function per line.')
      }
    }
    throw error
  }
}

export function validateAddress(address: string, label = 'Contract address'): string {
  if (!isAddress(address.trim())) throw new Error(`${label} is not a valid EVM address.`)
  return getAddress(address.trim())
}

export function parseInputValue(value: string, param: ParamType): unknown {
  const clean = value.trim()

  if (param.baseType === 'array' || param.baseType === 'tuple') {
    if (!clean) throw new Error(`${param.name || param.type} requires a JSON value.`)
    try {
      return JSON.parse(clean)
    } catch {
      throw new Error(`${param.name || param.type} must be valid JSON.`)
    }
  }
  if (param.baseType === 'bool') {
    if (!['true', 'false'].includes(clean.toLowerCase())) throw new Error(`${param.name || 'bool'} must be true or false.`)
    return clean.toLowerCase() === 'true'
  }
  if (param.baseType === 'address') return validateAddress(clean, param.name || 'Address')
  if (/^u?int/.test(param.baseType)) {
    if (!/^-?\d+$/.test(clean)) throw new Error(`${param.name || param.type} must be a whole number in base units.`)
    return BigInt(clean)
  }
  return clean
}

function serialize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(serialize)
  if (value && typeof value === 'object') {
    const resultObject = value as Result & Record<string, unknown>
    const named = Object.keys(resultObject).filter((key) => Number.isNaN(Number(key)))
    if (named.length) return Object.fromEntries(named.map((key) => [key, serialize(resultObject[key])]))
    return Array.from(value as Iterable<unknown>).map(serialize)
  }
  return value
}

export function formatResult(value: unknown): string {
  const serialized = serialize(value)
  return typeof serialized === 'string' ? serialized : JSON.stringify(serialized, null, 2)
}

export function shortenAddress(address: string, size = 5): string {
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`
}

export function friendlyError(error: unknown): string {
  if (typeof error === 'object' && error) {
    const candidate = error as { shortMessage?: string; reason?: string; message?: string; info?: { error?: { message?: string } } }
    return candidate.shortMessage || candidate.reason || candidate.info?.error?.message || candidate.message || 'Something went wrong.'
  }
  return String(error)
}
