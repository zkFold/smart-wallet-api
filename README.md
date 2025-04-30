# zkFold Smart Contract Wallet API 

This package provides a Smart Wallet API to manage both mnemonic-based and Google OAuth-based wallets.

Exported modules:
* [Wallet.ts](src/Wallet.ts). Provides methods to initiate wallets and send funds to other wallets, including via gmail. Wallet provides the following functions:
    * addressForGmail(gmail: string). Returns a Cardano address for the given Gmail address.
    * getAddress(). Returns Wallet's address.
    * getBalance(). Returns Wallet's balance in format { token_name: amount }.
    * getExtensions(). Returns the list of enabled extensions.
    * getUtxos(). Returns the list of UTxO held by the wallet.
    * getUsedAddresses(). Returns the list of used addresses (normally there's only one address returned by getAddress() if it has any transactions).
    * getUnusedAddresses(). Returns the list of unused addresses (normally there's only one address returned by getAddress() if does not have any transactions).
    * getRewardAddresses(). Currently returns an empty list.
    * getChangeAddress(). The same as getAddress().
    * sendTo(rec: SmartTxRecipient). Send funds to an address or to Gmail. For example, the following will send 1 Ada to "test@zkfold.io": ```wallet.sendTo(new SmartTxRecipient(WalletType.Google, "test@zkfold.io", new BigIntWrap(1000000)))```
* [Backend.ts](src/Backend.ts). Provides high-level functions to backend REST API. Normally, you should only create an instance of Backend to pass it to the Wallet and not call its methods directly. 
* [Notifier](src/Notifier.ts). Provides a Notifier object with methods to send email to funds recipients. 
* [GoogleToken.ts](src/GoogleToken.ts). Provides methods to obtain Google JSON Web Tokens for gmail-based wallets.

# Example

## Mnemonic-based

A wallet can be created using a mnemonic. In this case, it will act as a classical wallet (i.e. create transactions signed with a private key), but it will still be able to send money to a gmail account.

```javascript
import { Wallet, Initialiser, WalletType, SmartTxRecipient } from 'zkfold-smart-wallet-api';
import { Backend, BigIntWrap } from 'zkfold-smart-wallet-api'
import { Notifier } from 'zkfold-smart-wallet-api'


const backend = new Backend('https://backend.zkfold.io', 'api-key'); // To communicate with the backend
const notifier = new Notifier("service@email.com", "application password"); // This will be used to send emails to the recipient

const initialiser = { method: WalletType.Mnemonic, data: "mnemonic of the wallet ..." };

const wallet = new Wallet(backend, initialiser, 'password', 'preprod'); // A Wallet is created with Backend, wallet type parameters, optional password and network type.
const address = await wallet.getAddress();
console.log(address.to_bech32());
const balance = await wallet.getBalance();
console.log(balance);
const txId = await wallet.sendTo(new SmartTxRecipient(WalletType.Google, "test@zkfold.io", new BigIntWrap(1000000)));
console.log(txId);

notifier.sendMessage("test@zkfold.io", "You've received funds", "html of the message body"); // Notify the recipient
```

## Google OAuth-based

A wallet can be created using Google OAuth. In this case, it will require a valid JSON Web Token signed by Google and intended to be used with the wallet [web application](https://console.cloud.google.com/welcome/new).


```javascript
import { Wallet, Initialiser, WalletType, SmartTxRecipient } from 'zkfold-smart-wallet-api';
import { Backend, BigIntWrap } from 'zkfold-smart-wallet-api'
import { Notifier } from 'zkfold-smart-wallet-api'
import { GoogleApi } from 'zkfold-smart-wallet-api'
import CSL from '@emurgo/cardano-serialization-lib-nodejs';


const backend = new Backend('https://backend.zkfold.io', 'api-key'); // To communicate with the backend
const notifier = new Notifier("service@email.com", "application password"); // This will be used to send emails to the recipient
const gapi = new GoogleApi("client id of your web app", "client secret", "redirect url");


const prvKey = CSL.Bip32PrivateKey.generate_ed25519_bip32(); // Will be used to mint a token and sign transactions
const state = crypto.randomBytes(32).toString('hex'); // Google requires to use state to avoid CSRF attacks
const authUrl = gapi.getAuthUrl(state); // User should be redirecred here to obtain a JSON Web Token

// After a successful authentication, Google will send a request to the specified endpoint.
// The request will contain a url parameter 'code' which should be passed to getJWT()

const jwt = await gapi.getJWT(response.code);

const initialiser = { method: WalletType.Google, data: jwt, rootKey: prvKey };

const wallet = new Wallet(backend, initialiser, 'password', 'preprod'); // The Wallet can be used exactly as before, there's nothing new from a user's perspective 
const address = await wallet.getAddress();
console.log(address.to_bech32());
const balance = await wallet.getBalance();
console.log(balance);
const txId = await wallet.sendTo(new SmartTxRecipient(WalletType.Google, "test@zkfold.io", new BigIntWrap(1000000)));
console.log(txId);

notifier.sendMessage("test@zkfold.io", "You've received funds", "html of the message body"); // Notify the recipient
```
