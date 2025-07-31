# zkFold Smart Wallet API

This package provides a Smart Wallet API to manage both mnemonic-based and Google OAuth-based wallets.

## Installation

```bash
npm install zkfold-smart-wallet-api
```

## API Reference

### Wallet
Provides methods to initiate wallets and send funds securely:
* **addressForGmail(gmail: string)**: Returns a Cardano address for the given Gmail address
* **getAddress()**: Returns Wallet's address  
* **getBalance()**: Returns Wallet's balance in format { token_name: amount }
* **getExtensions()**: Returns the list of enabled extensions
* **getUtxos()**: Returns the list of UTxO held by the wallet
* **getUsedAddresses()**: Returns used addresses (normally one address if has transactions)
* **getUnusedAddresses()**: Returns unused addresses (normally one address if no transactions)
* **getRewardAddresses()**: Currently returns an empty list
* **getChangeAddress()**: The same as getAddress()
* **sendTo(rec: SmartTxRecipient)**: Send funds to an address or Gmail securely

### Backend
Provides high-level functions to backend REST API. Create an instance to pass to Wallet.

### GoogleApi
Provides PKCE OAuth authentication for Google-based wallets:
```javascript
const gapi = new GoogleApi("your-client-id", "redirect-url");
const authUrl = await gapi.getAuthUrl("state");
const jwt = await gapi.getJWT(authCode);
```

## Usage Examples

### Mnemonic-Based Wallet

```javascript
import { Wallet, Backend, WalletType, SmartTxRecipient, BigIntWrap } from 'zkfold-smart-wallet-api';

const backend = new Backend('https://api.wallet.zkfold.io', 'api-key');

const wallet = new Wallet(
    backend,
    { 
        method: WalletType.Mnemonic, 
        data: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about" 
    },
    'password', // optional
    'mainnet'
);

// Send 1 ADA to Gmail user  
await wallet.sendTo(new SmartTxRecipient(
    WalletType.Google, 
    "user@gmail.com", 
    { lovelace: new BigIntWrap(1000000) }
));
```

### Google OAuth-Based Wallet

```javascript
import { Wallet, Backend, GoogleApi, WalletType } from 'zkfold-smart-wallet-api';

const backend = new Backend('https://api.wallet.zkfold.io', 'api-key');

const gapi = new GoogleApi(
    "your-google-client-id.apps.googleusercontent.com", 
    "https://your-app.com/oauth/callback"
);

// Generate auth URL and redirect user
const state = crypto.randomUUID();
const authUrl = await gapi.getAuthUrl(state);
// Redirect user to authUrl...

// After OAuth callback with authorization code
const jwt = await gapi.getJWT(authorizationCode);

// Create wallet
const wallet = new Wallet(
    backend,
    { method: WalletType.Google, data: jwt },
    '', // password optional
    'mainnet'
);

// Use wallet
const address = await wallet.getAddress();
const balance = await wallet.getBalance();

// Send funds
await wallet.sendTo(new SmartTxRecipient(
    WalletType.Google, 
    "recipient@gmail.com",
    { lovelace: new BigIntWrap(2000000) } // 2 ADA
));
```
