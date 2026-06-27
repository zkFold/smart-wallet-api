import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { bytesToHex } from './Utils'
import { Backend } from './Service/Backend'
import { SeedphraseWallet } from './SeedphraseWallet'
import * as L2 from './Service/L2'
import { jubjub } from '@noble/curves/misc.js'
import { 
    mimcHash, 
    eddsaSign, 
    eddsaVerify, 
    JubjubPoint, 
    pointToAffineXY 
} from './EdDSA'
import { 
    AddressType, 
    BalanceResponse, 
    Transaction, 
    TransactionRequest, 
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
        const { hash } = await this.l2.txHash({ transaction: tx })

        const { publicKey, signature } = eddsaSign(this.privateKeyScalar, hash.scalar)
        if (!eddsaVerify(publicKey, hash.scalar, signature)) {
            throw new Error("Failed to verify locally generated L2 signature")
        }

        return new L2.Signature(signature, publicKey)
    }

    private async fillSignatures(sigs: L2.Signature[]): Promise<L2.Signature[]> {
        const { inputs } = await this.l2.txParameters()
        while (sigs.length < inputs) {
            sigs.push(L2.Signature.zero())
        }
        return sigs
    }

    private async bridgeIn(assetDict: { [key: string]: number }, recipient: L2.L2Address): Promise<L2.SubmitL1TxResponse> {
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

        return await this.l2.submitL1Tx({transaction: tx, witness: witness})
    }

    private assetFieldElement(hex: string | undefined): L2.FieldElement {
        if (!hex) {
            return L2.FieldElement.zero
        }
        return new L2.FieldElement(hex.startsWith("0x") ? hex : `0x${hex}`)
    }

    async l2Utxos(): Promise<L2.L2UTxO[]> {
        const utxos = await this.l2.utxos(this.l2Address())
        return utxos 
    }


    public async sendTransaction(request: TransactionRequest): Promise<void> {
        // Regular tx
        if (!this.l2Mode && request.recipientType !== AddressType.L2) {
            await this.seedphraseWallet.sendTransaction(request)
            return
        }

        // Bridge-in
        if (!this.l2Mode) {
            await this.bridgeIn(request.assets, new L2.L2Address(request.recipient))
            return
        }

        const { inputs, outputs, assets } = await this.l2.txParameters()
        
        const l2Tx = new L2.L2Tx(inputs, outputs, assets)

        const utxos = (await this.l2Utxos()).slice(0, inputs)
        if (utxos.length === 0) {
            throw new Error("No L2 UTxOs available to spend")
        }
        utxos.forEach((u) => l2Tx.addInput(u.uRef))

        const bridge_outs: L2.BridgeOut[] = []

        let l2Recipient: L2.L2Address
        let isBridgeOut = false

        // Bridge-out
        if (request.recipientType !== AddressType.L2) {
            l2Recipient = await this.l2.getL2Address(CSL.Address.from_bech32(request.recipient))
            bridge_outs.push(new L2.BridgeOut(request.assets, CSL.Address.from_bech32(request.recipient)))
            isBridgeOut = true
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
                output.addAsset(new L2.AssetValue(this.assetFieldElement(policy), this.assetFieldElement(name), value))
            }
          }
        );
        l2Tx.addOutput(isBridgeOut ? L2.L2TxOutput.bridgeOut(output) : L2.L2TxOutput.l2Output(output))
        
        const signature = await this.signTransaction(l2Tx)
        const signatures = await this.fillSignatures([signature])

        await this.l2.submitTx({ transaction: l2Tx, signatures: signatures, bridge_outs: bridge_outs, input_utxos: utxos })
    }

    async getBalance(): Promise<BalanceResponse> {
        if (this.l2Mode) {
            const utxos = await this.l2Utxos()
            const lovelace = utxos
                .flatMap((utxo) => utxo.uOutput.assets)
                .filter((asset) => asset.policy.scalar === 0n && asset.name.scalar === 0n)
                .reduce((total, asset) => total + asset.quantity, 0)
            return { lovelace, tokens: [], usd: 0 }
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
            const txs = await this.l2.txHistory(this.l2Address())

            const oldTxs = txs.txs.map((tx) => {
                return { transaction_id: tx.hash, value_diff: {}, timestamp: tx.submitted_at, from_addrs: [], to_addrs: [] }
            })
            /**            
            For reference:
            
            export interface TxInfo {
                batch_id: number,
                hash: string,
                id: number,
                payload: unknown,
                status: string,
                submitted_at: string,
            }
            
            export interface Transaction {
                transaction_id: string
                value_diff: { [asset: string]: number }
                timestamp: string
                from_addrs: CSL.Address[]
                to_addrs: CSL.Address[]
            }
            */
            return oldTxs 
        }
        return await this.seedphraseWallet.getTxHistory()
    }

    logout(): void {
    }
}            
