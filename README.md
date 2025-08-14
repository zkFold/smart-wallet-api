# zkFold Smart Wallet API

This package provides a Smart Wallet API to manage both mnemonic-b# Send funds
await wallet.sendTo(new SmartTxRecipient(
    AddressType.Email, 
    "recipient@gmail.com",
    { lovelace: new BigIntWrap(2000000) } // 2 ADA
));nd Google OAuth-based wallets.

## Installation

```bash
npm install zkfold-smart-wallet-api
```

## Development

To build the library from sources, use
```bash
npm install
npm run build
```

## API Reference

### Wallet

The Wallet class provides the usual CIP-30 wallet API:
* **getAddress()**: Returns Wallet's address  
* **getBalance()**: Returns Wallet's balance in format { token_name: amount }
* **getExtensions()**: Returns the list of enabled extensions
* **getUtxos()**: Returns the list of UTxO held by the wallet
* **getUsedAddresses()**: Returns used addresses (normally one address if has transactions)
* **getUnusedAddresses()**: Returns unused addresses (normally one address if no transactions)
* **getRewardAddresses()**: Currently returns an empty list
* **getChangeAddress()**: The same as getAddress()

In addition, it provides the following Smart Wallet APIs:
* **addressForGmail(email: string)**: Returns a Cardano address for the given Gmail-based email address
* **sendTo(rec: SmartTxRecipient)**: Send funds to a Cardano address or Gmail-based email address

### Backend
Provides high-level functions to perform API requests to the backend.

### Prover
Provides high-level functions to perform API requests to the prover.

### GoogleApi
Provides OAuth 2.0 authorization code flow authentication for Gmail-based wallets:
```javascript
const gapi = new GoogleApi("your-client-id", "your-client-secret", "redirect-url");
const authUrl = gapi.getAuthUrl("state");
// User redirected to Google, then back with code in URL parameters
const jwt = await gapi.getJWT(code);
```

### JSON Serialization
Provides utilities for serializing and deserializing objects from this library:
* **serialize(data: any)**: Serializes data to JSON string
* **deserialize(jsonString: string)**: Deserializes JSON string back to JavaScript objects


## Example

```javascript
import { Wallet, Backend, GoogleApi, Prover, SmartTxRecipient, AddressType, BigIntWrap } from 'zkfold-smart-wallet-api';

const backend = new Backend('https://api.wallet.zkfold.io', 'api-key');

const prover = new Prover('https://prover.zkfold.io');

const gapi = new GoogleApi(
    "your-google-client-id.apps.googleusercontent.com", 
    "your-google-client-secret",
    "https://your-app.com/oauth/callback"
);

// Generate auth URL and redirect user
const state = crypto.randomUUID();
const authUrl = gapi.getAuthUrl(state);
// Redirect user to authUrl...

// After OAuth callback, extract code from URL parameters and exchange for JWT
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const jwt = await gapi.getJWT(code);

// Create wallet
const wallet = new Wallet(
    backend,
    prover,
    { jwt: jwt }
);

// Use wallet
const address = await wallet.getAddress();
const balance = await wallet.getBalance();

// Send funds
await wallet.sendTo(new SmartTxRecipient(
    AddressType.Email, 
    "recipient@gmail.com",
    { lovelace: new BigIntWrap(2000000) } // 2 ADA
));
```
