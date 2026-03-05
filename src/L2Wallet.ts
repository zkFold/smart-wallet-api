import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { harden, bytesToHex } from './Utils'
import { Backend } from './Service/Backend'
import { SeedphraseWallet } from './SeedphraseWallet'
import * as L2 from './Service/L2'
import { jubjub } from '@noble/curves/misc.js'
import { 
    mimcConstantsRaw, 
    mimcHash, 
    mimcHashN, 
    eddsaSign, 
    eddsaVerify, 
    JubjubPoint, 
    EddsaSignature, 
    pointToAffineXY 
} from './EdDSA'
import { 
    AddressType, 
    BalanceResponse, 
    Transaction, 
    TransactionRequest, 
    UTxO, 
} from './Types'

export class L2Wallet extends EventTarget {
    private readonly backend: Backend;
    private readonly l2: L2.L2Backend;
    private readonly seedphraseWallet: SeedphraseWallet;

    private readonly seedphrase: string;
    private readonly password: string;
    private readonly privateKeyScalar: bigint;

    private l2Mode: boolean;


    /**
     *  @param {Backend} backend         - A Backend object for communication with Cardano
     *  @param {string} seedphrase       - Seedphrase of the wallet 
     *  @param {string} password         - Optional password
     */
    constructor(backend: Backend, l2: L2.L2Backend, seedphrase: string, password: string = '') {
        super()

        this.l2Mode = false

        this.seedphrase = seedphrase
        this.password = password

        this.backend = backend;
        this.l2 = l2;
        this.seedphraseWallet = new SeedphraseWallet(backend, seedphrase, password, false)

        const entropy: Uint8Array = bip39.mnemonicToEntropy(seedphrase, wordlist);

        const scalar = BigInt('0x' + bytesToHex(entropy))
        console.log(scalar)

        const N = jubjub.Point.CURVE().n;

        this.privateKeyScalar = scalar % N
        this.dispatchEvent(new CustomEvent('initialized'))
    }

    public setL2Mode(state: boolean): void {
        this.l2Mode = state
    }

    public getL2Mode(): boolean {
        return this.l2Mode
    }

    async setNetwork(): Promise<void> {
        await this.seedphraseWallet.setNetwork()
    }

    public l2Address(): L2.L2Address {
        const P = jubjub.Point.CURVE().p;
        const Point = (jubjub as any).Point;
        const G: JubjubPoint = Point.BASE;

        const publicKey: JubjubPoint = G.multiply(this.privateKeyScalar);
        const {x, y} = pointToAffineXY(publicKey)
        const hash = mimcHash([x, y], P)

        return new L2.L2Address(`l2_${hash}`)
    }

    public async stringAddress(): Promise<string> {
        if (this.l2Mode) {
            return this.l2Address().toString()
        } else {
            return await this.seedphraseWallet.stringAddress()
        }
    }

    public getUserId(): string {
        if (this.l2Mode) {
            return this.l2Address().toString()
        } else {
            return this.seedphraseWallet.getUserId()
        }
    }

    private async signTransaction(tx: L2.L2Tx): Promise<L2.Signature>  {
        const { inputs, outputs, assets } = await this.l2.txParameters()
        const { hash } = await this.l2.txHash({ transaction: tx })
        console.log(hash)

        const { publicKey, signature } = eddsaSign(this.privateKeyScalar, hash.scalar)
        console.log(eddsaVerify(publicKey, hash.scalar, signature))

        const sig = new L2.Signature(signature, publicKey)
        return sig
    }

    private async fillSignatures(sigs: L2.Signature[]): Promise<L2.Signature[]> {
        const { inputs, outputs, assets } = await this.l2.txParameters()
        while (sigs.length < inputs) {
            sigs.push(L2.Signature.zero())
        }
        return sigs
    }

    private async bridgeIn(assetDict: { [key: string]: number }, recipient: L2.L2Address): Promise<void> {
        const balance = await this.seedphraseWallet.getBalance()
        const usedAddresses = await this.seedphraseWallet.getUsedAddresses()
        const changeAddress = await this.seedphraseWallet.getChangeAddress()

        const req = {
            amount: assetDict,
            destination_address: recipient,
            used_addresses: usedAddresses,
            change_address: changeAddress,

        }
        const resp = await this.l2.bridgeIn(req)

        const tx = resp.transaction

        const witness = this.seedphraseWallet.signTransaction(tx)

        const txId = await this.l2.submitL1Tx({transaction: tx, witness: witness})

        console.log(txId)
    }

    async l2Utxos(): Promise<L2.L2UTxO[]> {
        const utxos = await this.l2.utxos(new L2.L2Address("42"))
        return utxos 
    }


    public async sendTransaction(request: TransactionRequest): Promise<void> {
        // Regular tx
        if (!this.l2Mode && request.recipientType !== AddressType.L2) {
            this.seedphraseWallet.sendTransaction(request)
            return
        }

        // Bridge-in
        if (!this.l2Mode) {
            this.bridgeIn(request.assets, new L2.L2Address(request.recipient))
            return
        }

        const { inputs, outputs, assets } = await this.l2.txParameters()
        
        const l2Tx = new L2.L2Tx(inputs, outputs, assets)

        const utxos = await this.l2Utxos()
        utxos.forEach((u) => l2Tx.addInput(u.uRef))

        const bridge_outs = []

        let l2Recipient: L2.L2Address

        // Bridge-out
        if (request.recipientType !== AddressType.L2) {
            l2Recipient = await this.l2.getL2Address(request.recipient)
            bridge_outs.push(new L2.BridgeOut(request.assets, CSL.Address.from_bech32(request.recipient)))
        } else {
            l2Recipient = new L2.L2Address(request.recipient)
        }

        // L2 transaction
        
        const output = new L2.L2Output(l2Recipient, assets)

        Object.entries(request.assets).forEach(
          ([key, value]) => {
            if (key === 'lovelace') {
                output.addAsset(L2.AssetValue.ada(value))
            } else {
                const [policy, name] = key.split(".")
                output.addAsset(new L2.AssetValue(new L2.FieldElement(policy), new L2.FieldElement(name), value))
            }
          }
        );
        l2Tx.addOutput(L2.L2TxOutput.l2Output(output))
        
        const signature = await this.signTransaction(l2Tx)
        const signatures = await this.fillSignatures([signature])

        const resp = await this.l2.submitTx({ transaction: l2Tx, signatures: signatures, bridge_outs: bridge_outs})
        console.log(resp)
    }

    async getBalance(): Promise<BalanceResponse> {
        if (this.l2Mode) {
            return new Promise((resolve, reject) => resolve({ lovelace: 0, tokens: [], usd: 0 }))
        }
        return await this.seedphraseWallet.getBalance()
    }

    /**
     * @async
     * Get the approximate USD value of all wallet's assets 
     */
    async getUSDValue(): Promise<number> {
        if (this.l2Mode) {
            return new Promise((resolve, reject) => resolve(0))
        }
        return await this.seedphraseWallet.getUSDValue()
    }

    /**
     * @async
     * Get wallet's transaction history 
     */
    async getTxHistory(): Promise<Transaction[]> {
        if (this.l2Mode) {
            return new Promise((resolve, reject) => resolve([]))
        }
        return await this.seedphraseWallet.getTxHistory()
    }

    logout(): void {
    }
}            
