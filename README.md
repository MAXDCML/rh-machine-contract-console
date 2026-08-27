# RH Machine Contract Console

A React interface for connecting MetaMask, resolving RH Machine V1/V2 ERC-6551 wallets, withdrawing ERC-20 balances, and interacting with pasted smart-contract ABIs.

The listed V2 scanner loads every active listing in the OpenSea `rhmachines` collection, resolves each Machine wallet on Robinhood Chain, and reports wallets with a PRINTER balance. The OpenSea key is read only by the Vercel server function and is never bundled into the browser app.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and set `OPENSEA_API_KEY` when running with Vercel Functions (for example, through `vercel dev`).

## Production build

```bash
npm run build
```

## Vercel environment

Add `OPENSEA_API_KEY` to the Vercel project for Production, Preview, and Development deployments.
