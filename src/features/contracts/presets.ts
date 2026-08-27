import type { ContractConfig } from '../../types'

export const ROBINHOOD_CHAIN_ID = 4663n
export const V1_MACHINES_COLLECTION_ADDRESS = '0xB509e195bcB3E4461e235Ff152c68D66915f67b5'
export const V2_MACHINES_COLLECTION_ADDRESS = '0x8C71D170fBd94BCba93bB08FC2CFD0e8620cD9cE'
export const V1_MACHINE_968_ADDRESS = '0xadDA6F88c4bA502279458489E5a541212df82476'
export const V2_MACHINE_968_ADDRESS = '0xdBe2fEc8134B51c3f7665A3bc0127cA2Bd9eD091'
export const MACHINE_ADDRESS = V1_MACHINE_968_ADDRESS
export const PRINTER_ADDRESS = '0x85a574f2ff0795685f58d1d7b0d4b51f148ac489'

export const MACHINE_ABI = [
  'function execute(address to, uint256 value, bytes data, uint8 operation) payable returns (bytes)',
] as const

export const MACHINES_COLLECTION_ABI = [
  'function accountOf(uint256 tokenId) view returns (address)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function exists(uint256 tokenId) view returns (bool)',
  'function createAccount(uint256 tokenId) returns (address)',
] as const

export const PRINTER_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const

export const PRESETS: ContractConfig[] = [
  {
    name: 'Machine V1 #968',
    address: V1_MACHINE_968_ADDRESS,
    abi: MACHINE_ABI,
    abiText: JSON.stringify(MACHINE_ABI, null, 2),
  },
  {
    name: 'Machine V2 #968',
    address: V2_MACHINE_968_ADDRESS,
    abi: MACHINE_ABI,
    abiText: JSON.stringify(MACHINE_ABI, null, 2),
  },
  {
    name: 'PRINTER token',
    address: PRINTER_ADDRESS,
    abi: PRINTER_ABI,
    abiText: JSON.stringify(PRINTER_ABI, null, 2),
  },
]
