import { useCallback, useEffect, useState } from 'react'
import { BrowserProvider } from 'ethers'
import type { WalletState } from '../../types'
import { friendlyError } from '../contracts/contractUtils'

const initialState: WalletState = {
  provider: null,
  account: null,
  chainId: null,
  networkName: null,
  connecting: false,
  error: null,
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>(initialState)

  const hydrate = useCallback(async (requestAccounts: boolean) => {
    if (!window.ethereum) {
      setWallet((current) => ({
        ...current,
        error: 'MetaMask is not available in this browser. Open this URL in the same Chrome profile where MetaMask is installed, then allow the extension access to localhost.',
        connecting: false,
      }))
      return
    }

    setWallet((current) => ({ ...current, connecting: true, error: null }))
    try {
      const provider = new BrowserProvider(window.ethereum)
      const method = requestAccounts ? 'eth_requestAccounts' : 'eth_accounts'
      const accounts = (await provider.send(method, [])) as string[]
      const network = await provider.getNetwork()
      setWallet({
        provider,
        account: accounts[0] ?? null,
        chainId: network.chainId,
        networkName: network.name === 'unknown' ? `Chain ${network.chainId}` : network.name,
        connecting: false,
        error: null,
      })
    } catch (error) {
      setWallet((current) => ({ ...current, connecting: false, error: friendlyError(error) }))
    }
  }, [])

  useEffect(() => {
    void hydrate(false)
  }, [hydrate])

  useEffect(() => {
    if (!window.ethereum?.on) return
    const refresh = () => void hydrate(false)
    window.ethereum.on('accountsChanged', refresh)
    window.ethereum.on('chainChanged', refresh)
    return () => {
      window.ethereum?.removeListener?.('accountsChanged', refresh)
      window.ethereum?.removeListener?.('chainChanged', refresh)
    }
  }, [hydrate])

  return {
    ...wallet,
    connect: () => hydrate(true),
    clearError: () => setWallet((current) => ({ ...current, error: null })),
  }
}
