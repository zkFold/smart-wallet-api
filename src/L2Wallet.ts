import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { harden, bytesToHex } from './Utils'
import { Backend } from './Service/Backend'
import { SeedphraseWallet } from './SeedphraseWallet'
import * as L2 from './Service/L2'
import { jubjub } from '@noble/curves/misc.js'

export class L2Wallet extends EventTarget {
    private readonly backend: Backend;
    private readonly l2: L2.L2Backend;
    private readonly seedphraseWallet: SeedphraseWallet;

    private readonly secretKey: Uint8Array;
    private readonly publicKey: Uint8Array;


    /**
     *  @param {Backend} backend         - A Backend object for communication with Cardano
     *  @param {string} seedphrase       - Seedphrase of the wallet 
     *  @param {string} password         - Optional password
     */
    constructor(backend: Backend, l2: L2.L2Backend, seedphrase: string, password: string = '') {
        super()

        this.backend = backend;
        this.l2 = l2;
        this.seedphraseWallet = new SeedphraseWallet(backend, seedphrase, password, false)

        const entropy: Uint8Array = bip39.mnemonicToEntropy(seedphrase, wordlist);

        const scalar = BigInt('0x' + bytesToHex(entropy))
        console.log(scalar)


        const { secretKey, publicKey } = jubjub.keygen(entropy);
        this.secretKey = secretKey
        this.publicKey = publicKey

        console.log(secretKey)
        const msg = new TextEncoder().encode('hello noble');
        const sig = jubjub.sign(msg, secretKey);

        console.log(sig)
        //this.dispatchEvent(new CustomEvent('initialized'))
    }

    async setNetwork(): Promise<void> {
        await this.seedphraseWallet.setNetwork()
    }

    async bridgeIn(): Promise<void> {
        const balance = await this.seedphraseWallet.getBalance()
        const usedAddresses = await this.seedphraseWallet.getUsedAddresses()
        const changeAddress = await this.seedphraseWallet.getChangeAddress()

        const req = {
            amount: {
                'lovelace': 2_000_000
            },
            destination_address: new L2.L2Address("42"),
            used_addresses: usedAddresses,
            change_address: changeAddress,

        }
        const resp = await this.l2.bridgeIn(req)

        const tx = resp.transaction

        const witness = this.seedphraseWallet.signTransaction(tx)

        const txId = await this.l2.submitL1Tx({transaction: tx, witness: witness})

        console.log(txId)
    }

    async utxos(): Promise<void> {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
        await delay(300_000)
        const utxos = await this.l2.utxos(new L2.L2Address("42"))
        console.log(utxos)
    }

}            
