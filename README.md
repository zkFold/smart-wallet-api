# zkFold Smart Wallet API

This package provides a Smart Wallet API to manage Google OAuth-based wallets. In this wallet, funds are locked in a smart contract that verifies Google's signatures of a successful user login.

## Installation

The package is published on npm:

https://www.npmjs.com/package/zkfold-smart-wallet-api

You can install it by executing

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


## Usage Example

### Step 1: Initiating Google OAuth flow

```typescript
import { GoogleApi, Backend, Prover } from 'zkfold-smart-wallet-api';

// Get OAuth credentials from backend
const backend = new Backend('https://wallet-api.zkfold.io', 'your-api-key');
const prover = new Prover('https://wallet-prover.zkfold.io');
const credentials = await backend.credentials('your-client-name');

// Setup Google OAuth
const gapi = new GoogleApi(
    credentials.client_id,
    credentials.client_secret,
    "https://your-app.com/oauth/callback"
);

// Redirect to Google
const authUrl = gapi.getAuthUrl('random-state');
window.location.href = authUrl;
```

### Step 2: Handling OAuth callback

```typescript
import { GoogleApi, Wallet } from 'zkfold-smart-wallet-api';

// Extract authorization code from URL
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

// Exchange code for JWT
const jwt = await gapi.getJWT(code);

// Create wallet
const wallet = new Wallet(
    backend,
    prover,
    { jwt: jwt }
);

// Get the user's email
const email = wallet.getEmail();
```

### Step 3: Querying user information

```typescript
import { Wallet } from 'zkfold-smart-wallet-api';

// Get the user's email
const email = wallet.getEmail();

// Get the user's Cardano address
const address = await wallet.getAddress();

// Get the user's balance
const balance = await wallet.getBalance();

```

### Step 4: Making payments

```typescript
import { Wallet, SmartTxRecipient, AddressType, BigIntWrap } from 'zkfold-smart-wallet-api';

// Send to email address
await wallet.sendTo(new SmartTxRecipient(
    AddressType.Email, 
    "recipient@gmail.com",
    { lovelace: new BigIntWrap(2000000) }
));

// Send to Cardano address
await wallet.sendTo(new SmartTxRecipient(
    AddressType.Bech32, 
    "addr_test1qr...",
    { lovelace: new BigIntWrap(1500000) }
));
```
