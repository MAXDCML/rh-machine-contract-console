import type { BrowserProvider, JsonFragment } from 'ethers'

export type WalletState = {
  provider: BrowserProvider | null
  account: string | null
  chainId: bigint | null
  networkName: string | null
  connecting: boolean
  error: string | null
}

export type ContractConfig = {
  name: string
  address: string
  abi: readonly (string | JsonFragment)[]
  abiText: string
}

export type TransactionRecord = {
  hash: string
  label: string
  status: 'pending' | 'confirmed' | 'failed'
  timestamp: number
}
