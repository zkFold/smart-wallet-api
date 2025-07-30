# Browser Extension Example

This example demonstrates how to use the zkFold Smart Wallet API in a browser extension.

## Files Structure

```
extension/
├── manifest.json       # Extension manifest
├── background.js      # Background script
├── popup.html         # Extension popup
├── popup.js          # Popup logic
└── assets/
    └── proof.wasm    # WASM file for cryptographic proofs
```

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "zkFold Smart Wallet Extension",
  "version": "1.0",
  "description": "Browser extension using zkFold Smart Wallet API",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://api.wallet.zkfold.io/*",
    "https://accounts.google.com/*",
    "https://oauth2.googleapis.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "zkFold Wallet"
  },
  "web_accessible_resources": [{
    "resources": ["assets/proof.wasm"],
    "matches": ["<all_urls>"]
  }]
}
```

## Usage Example

```javascript
import { Wallet, Backend, GoogleApi } from 'zkfold-smart-wallet-api';

// Backend connection
const backend = new Backend('https://api.wallet.zkfold.io', 'your-api-key');

// SECURE Google OAuth with PKCE (no client secret needed)
const gapi = new GoogleApi(
    "your-google-client-id.apps.googleusercontent.com", 
    "https://your-extension-id.chromiumapp.org/"
);

// Get auth URL and redirect user
const authUrl = await gapi.getAuthUrl("random-state-string");
// ... handle OAuth flow ...

// After getting the JWT token from OAuth
const jwt = await gapi.getJWT(authCode);

// Create wallet with extension-compatible WASM loading
const wallet = new Wallet(
    backend, 
    { method: WalletType.Google, data: jwt },
    '', // password
    'mainnet', // network
    { 
        // Extension-specific WASM URL
        wasmUrl: chrome.runtime.getURL('assets/proof.wasm') 
    }
);

// Use wallet
const address = await wallet.getAddress();
const balance = await wallet.getBalance();

// Send funds securely
await wallet.sendTo({
    recipientType: WalletType.Google,
    address: "recipient@gmail.com", 
    assets: { lovelace: new BigIntWrap(1000000) } // 1 ADA
});
```

## Security Features

✅ **No Credential Exposure**: 
- No email service credentials in client code
- PKCE OAuth eliminates client secret exposure
- WASM loaded securely from extension resources

✅ **Browser Extension Compatible**:
- Proper WASM loading with chrome.runtime.getURL()
- Web Crypto API for secure operations
- Extension manifest permissions properly configured

## Migration from v1.2.x

```javascript
// BEFORE (v1.2.x) - INSECURE
import { Wallet, Backend, Notifier, GoogleApi } from 'zkfold-smart-wallet-api';

const notifier = new Notifier("service@email.com", "password"); // ❌ Security risk
const gapi = new GoogleApi("clientId", "clientSecret", "redirect"); // ❌ Secret exposed

// AFTER (v1.3.x) - SECURE  
import { Wallet, Backend, GoogleApi } from 'zkfold-smart-wallet-api';

// Notifier removed - backend handles email automatically ✅
const gapi = new GoogleApi("clientId", "redirect"); // ✅ PKCE secure
```