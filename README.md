
# zkFold Smart Wallet API

This SDK lets you integrate zkFold Smart Wallets into your Cardano wallet or dApp. Smart Wallets are backed by Google OAuth: funds are locked in a script that only unlocks when the user proves possession of a valid Google-issued JWT.

## Installation

The package is available on npm:

https://www.npmjs.com/package/zkfold-smart-wallet-api

Install it with:

```bash
npm install zkfold-smart-wallet-api
```

## Development

To build the library from sources:

```bash
npm install
npm run build
```

## Quick start

The flow below shows how to obtain Google OAuth credentials, initialise a wallet, and prepare the background proof required for first-time spending.

### 1. Initiate the Google OAuth flow, Backend service and Prover service

```typescript
import { Backend, GoogleApi, Prover } from 'zkfold-smart-wallet-api'

const backend = new Backend("https://wallet-api.zkfold.io", YOUR-BACKEND-API-KEY)
const prover = new Prover("https://wallet-prover.zkfold.io")

const googleApi = new GoogleApi(YOUR-GOOGLE-CLIENT-ID, YOUR-GOOGLE-CLIENT-SECRET, `${YOUR-WEBSITE-URL}/oauth2callback`)
```

You should also setup the callback address in the Google Cloud console to be `${YOUR-WEBSITE-URL}/oauth2callback`

### 2. Create a wallet

```typescript
const wallet = new Wallet(backend, prover, googleApi)
```

If you need to persist the wallet between sessions, serialise the initialiser:

```typescript
localStorage.setItem('wallet-init', JSON.stringify(wallet.toWalletInitialiser()));
```

### 3. Kick off background proof generation

When a wallet is activated for the first time, it must submit a zero-knowledge proof before funds can be sent. Generating the proof can take a while, so start it as soon as the wallet is created:

```typescript
// Fire-and-forget: the proof will be cached on the wallet instance
wallet.getProof();
```

`Wallet.sendTo` will wait until the proof is ready, but precomputing it keeps the UI responsive.

### 4. Query wallet data

```typescript
const email = wallet.getUserId();
const address = await wallet.getAddress();
const balance = await wallet.getBalance();
const utxos = await wallet.getUtxos();
```

### 5. Send funds

```typescript
import { AddressType, BigIntWrap, SmartTxRecipient } from 'zkfold-smart-wallet-api';

// Send to another smart wallet user
await wallet.sendTo(
    new SmartTxRecipient(AddressType.Email, 'recipient@gmail.com', {
        lovelace: new BigIntWrap('2000000')
    })
);

// Send to a regular Cardano address
await wallet.sendTo(
    new SmartTxRecipient(AddressType.Bech32, 'addr_test1qr...', {
        lovelace: new BigIntWrap('1500000')
    })
);
```

`sendTo` returns a `{ transaction_id, notifier_errors }` object mirroring the backend response.

## API reference

### Wallet

- `constructor(backend, prover, { jwt, tokenSKey? })`
- `getUserId()` – Gmail address extracted from the JWT
- `getAddress()` – Smart wallet bech32 address
- `addressForGmail(email)` – Resolve another wallet’s address
- `getBalance()` – Aggregate assets across all UTxOs
- `getUtxos()` – Fetch UTxOs from the backend
- `getUsedAddresses() / getUnusedAddresses() / getRewardAddresses()` – CIP-30 compatible helpers
- `getChangeAddress()` – Currently returns the main address
- `getExtensions()` – Returns enabled wallet extensions (empty array for now)
- `getProof()` – Start/await the activation proof generation (new)
- `sendTo(recipient)` – Build, sign, and submit a transaction. If the wallet isn’t activated yet it will include activation + payment in one transaction.
- `toWalletInitialiser()` – Serialise the wallet so it can be restored later.

### Backend

High-level wrapper around the Smart Wallet backend API:

- `walletAddress(email)` – Resolve an address without activating the wallet
- `getSettings()` – Fetch network and version info
- `activateWallet(jwt, paymentKeyHash, proof)` – Build an activation transaction
- `activateAndSendFunds(jwt, paymentKeyHash, proof, outs)` – Combine activation and payment
- `sendFunds(email, outs, paymentKeyHash)` – Spend from an already activated wallet
- `submitTx(transaction, emailRecipients?)` – Submit a signed CBOR transaction
- `addVkeyAndSubmit(unsignedTx, vkeyWitness, emailRecipients?)` – Backend signs and submits on your behalf
- `addressUtxo(address)` – Pull UTxOs for any address
- `credentials()` – Retrieve Google OAuth client credentials (requires backend configuration)

All mutating endpoints accept an optional API key supplied via the constructor.

### Prover

Used to fetch zero-knowledge proofs for Google JWT validation:

- `requestProof(proofInput)` – Submit proof computation and get a request ID
- `proofStatus(proofId)` – Poll for proof completion
- `prove(proofInput)` – Convenience helper that internally polls until the proof is ready

### Serialization helpers

The `JSON` module exposes `serialize`/`deserialize` for lossless (de)serialisation of types that contain `BigIntWrap` instances. `Types.ts` exports all shared data structures such as `BigIntWrap`, `SmartTxRecipient`, `ProofBytes`, and response DTOs.

## Notes

- For browser builds, ensure `@emurgo/cardano-serialization-lib-browser` is available.
- Proof generation relies on HTTPS access to Google’s JWKS (`https://www.googleapis.com/oauth2/v3/certs`).
- When precomputing proofs, run `wallet.getProof()` once per fresh JWT; reuse `toWalletInitialiser()` afterwards to skip regeneration.
