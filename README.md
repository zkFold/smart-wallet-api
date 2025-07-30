# zkFold Smart Wallet API v1.3.0

🚀 **Browser & Extension Compatible** | 🔒 **Security Hardened** | 🌐 **Client-Side Ready**

This package provides a Smart Wallet API to manage both mnemonic-based and Google OAuth-based wallets, now optimized for browser and extension usage with critical security improvements.

## 🚨 Breaking Changes in v1.3.0

### Security-Critical Changes

#### 1. Notifier Removed (Security Risk Eliminated)
```javascript
// ❌ BEFORE (v1.2.x) - INSECURE
import { Notifier } from 'zkfold-smart-wallet-api';
const notifier = new Notifier("service@email.com", "password"); // Credential exposure!

// ✅ AFTER (v1.3.x) - SECURE
// Notifier completely removed - backend handles email notifications automatically
// No more credential exposure or email abuse risk
```

#### 2. Google OAuth Now Uses PKCE (Client Secret Removed)
```javascript
// ❌ BEFORE (v1.2.x) - CLIENT SECRET EXPOSED
import { GoogleApi } from 'zkfold-smart-wallet-api';
const gapi = new GoogleApi("clientId", "clientSecret", "redirectURL"); // Secret exposed!

// ✅ AFTER (v1.3.x) - PKCE SECURE
import { GoogleApi } from 'zkfold-smart-wallet-api';
const gapi = new GoogleApi("clientId", "redirectURL"); // No secrets needed - PKCE flow
```

#### 3. Browser-Compatible WASM Loading
```javascript
// ✅ NEW: Extension/Browser support with custom WASM URL
const wallet = new Wallet(backend, initialiser, password, network, {
    wasmUrl: chrome.runtime.getURL('assets/proof.wasm') // Extension compatibility
});
```

## 📦 Installation

```bash
npm install zkfold-smart-wallet-api
```

## 🌟 Key Features

- ✅ **Browser & Extension Compatible**: Works in Chrome, Firefox, Safari, Edge
- ✅ **Security Hardened**: No credential exposure, PKCE OAuth, secure WASM loading  
- ✅ **Multiple Build Formats**: ES modules, UMD, IIFE for different use cases
- ✅ **TypeScript Support**: Full type definitions included

## 📚 API Reference

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

### GoogleApi (PKCE Secure)
**🔒 SECURITY UPGRADE**: Now uses PKCE flow - no client secrets needed!
```javascript
const gapi = new GoogleApi("your-client-id", "redirect-url"); // Secure PKCE flow
const authUrl = await gapi.getAuthUrl("state");
const jwt = await gapi.getJWT(authCode);
```

## 🔧 Usage Examples

### Browser Extension Example

```javascript
import { Wallet, Backend, GoogleApi, WalletType } from 'zkfold-smart-wallet-api';

// Backend connection
const backend = new Backend('https://api.wallet.zkfold.io', 'api-key');

// Secure PKCE OAuth (no client secret!)
const gapi = new GoogleApi("client-id", "redirect-url");
const authUrl = await gapi.getAuthUrl("state");
// ... OAuth flow ...
const jwt = await gapi.getJWT(authCode);

// Extension-compatible wallet
const wallet = new Wallet(backend, 
    { method: WalletType.Google, data: jwt },
    '', 'mainnet',
    { wasmUrl: chrome.runtime.getURL('assets/proof.wasm') }
);

// Use wallet
const balance = await wallet.getBalance();
await wallet.sendTo({
    recipientType: WalletType.Google,
    address: "user@gmail.com",
    assets: { lovelace: new BigIntWrap(1000000) }
});
```

### Mnemonic-Based Wallet

A wallet can be created using a mnemonic for classical wallet functionality:

```javascript
import { Wallet, Backend, WalletType, SmartTxRecipient, BigIntWrap } from 'zkfold-smart-wallet-api';

const backend = new Backend('https://api.wallet.zkfold.io', 'api-key');

// Mnemonic wallet
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
```

### Google OAuth-Based Wallet (Secure PKCE)

Create a wallet using Google OAuth with the new secure PKCE flow:

```javascript
import { Wallet, Backend, GoogleApi, WalletType } from 'zkfold-smart-wallet-api';

const backend = new Backend('https://api.wallet.zkfold.io', 'api-key');

// Secure PKCE OAuth (no client secret needed!)
const gapi = new GoogleApi(
    "your-google-client-id.apps.googleusercontent.com", 
    "https://your-app.com/oauth/callback"
);

// Generate auth URL and redirect user
const state = crypto.randomUUID(); // CSRF protection
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

// Use wallet normally
const address = await wallet.getAddress();
const balance = await wallet.getBalance();

// Send funds
await wallet.sendTo(new SmartTxRecipient(
    WalletType.Google, 
    "recipient@gmail.com",
    { lovelace: new BigIntWrap(2000000) } // 2 ADA
));
```

## 🔗 Browser Extension Integration

See [BROWSER_EXTENSION_EXAMPLE.md](BROWSER_EXTENSION_EXAMPLE.md) for complete extension implementation.

## 🔄 Migration Guide

### From v1.2.x to v1.3.x

```javascript
// ❌ OLD (v1.2.x) - Security risks
import { Notifier, GoogleApi } from 'zkfold-smart-wallet-api';
const notifier = new Notifier("email", "pass"); // Credential exposure
const gapi = new GoogleApi("id", "secret", "url"); // Client secret exposed

// ✅ NEW (v1.3.x) - Secure
import { GoogleApi } from 'zkfold-smart-wallet-api';
// Notifier removed - backend handles notifications
const gapi = new GoogleApi("id", "url"); // PKCE - no secrets
```

## 📋 Requirements

- **Browser**: Chrome 88+, Firefox 78+, Safari 14+, Edge 88+
- **Node.js**: 16+ (for development)
- **Extensions**: Manifest V3 supported

## 🔒 Security Features

- ✅ **PKCE OAuth Flow**: Eliminates client secret exposure
- ✅ **No Email Credentials**: Backend handles notifications server-side  
- ✅ **Secure WASM Loading**: Browser-compatible with extension support
- ✅ **Web Crypto API**: Uses browser-native cryptographic functions
- ✅ **Type Safety**: Full TypeScript support with proper declarations

## 📄 License

BUSL-1.1

---

**⚠️ Important**: This version contains breaking changes for security. Review the migration guide before upgrading.
