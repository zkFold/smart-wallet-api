import * as CSL from '@emurgo/cardano-serialization-lib-browser';
import axios from 'axios';
import { serialize } from '../JSON';
import { BigIntWrap } from '../Types'
import { Buffer } from 'buffer';

export class FieldElement {
    private readonly scalar: string

    public constructor(scalar: string) {
        this.scalar = scalar
    }

    public static readonly zero: FieldElement = new FieldElement("0")

    public toString(): string {
        return this.scalar
    }

    public toJSON() {
        return this.toString()
    }
}

export class L2Address {

    private readonly fieldElement: FieldElement 

    public constructor(address: string) {
        this.fieldElement = new FieldElement(address) 
    }

    public static readonly empty: L2Address = new L2Address("0")

    public toString(): string {
        return this.fieldElement.toString()
    }

    public toJSON() {
        return this.toString()
    }
}

// ==============================================================

export class L2OutputRef {
    private readonly orTxId: FieldElement 
    private readonly orIndex: number

    public constructor(txId: FieldElement, index: number) {
        this.orTxId = txId
        this.orIndex = index
    }

    public static readonly empty: L2OutputRef = new L2OutputRef(FieldElement.zero, 0)

    public toJSON() {
        return {
            orTxId: this.orTxId.toJSON(),
            orIndex: this.orIndex,
        }
    }
}

export class AssetValue {
    private readonly assetPolicy: FieldElement
    private readonly assetName: FieldElement
    private readonly assetQuantity: BigIntWrap

    public constructor(assetPolicy: FieldElement, assetName: FieldElement, assetQuantity: BigIntWrap) {
        this.assetPolicy = assetPolicy
        this.assetName = assetName
        this.assetQuantity = assetQuantity
    }

    public static readonly empty: AssetValue = new AssetValue(FieldElement.zero, FieldElement.zero, BigIntWrap.zero)

    public static ada(quantity: BigIntWrap): AssetValue {
        return new AssetValue(FieldElement.zero, FieldElement.zero, quantity)
    }

    public toJSON() {
        return {
            assetPolicy: this.assetPolicy.toJSON(),
            assetName: this.assetName.toJSON(),
            assetQuantity: this.assetQuantity.toJSON(),
        }
    }

}

export class L2Output {
    private readonly oAddress: L2Address
    private readonly oAssets: AssetValue[]
    private readonly numAssets: number

    public constructor(address: L2Address, numAssets: number) {
        this.oAddress = address
        this.numAssets = numAssets
        this.oAssets = []
    }

    public static empty(numAssets: number): L2Output {
        return new L2Output(L2Address.empty, numAssets)
    }

    public addAsset(asset: AssetValue): void {
        if (this.oAssets.length >= this.numAssets) {
            throw new Error("Attempted to add more assets than the L2Output supports")
        }
        this.oAssets.push(asset)
    }

    private fillAssets() {
        const assets = this.oAssets.map((x) => x.toJSON())
        while (assets.length < this.numAssets) {
            assets.push(AssetValue.empty.toJSON())
        }
        return assets
    }

    public toJSON() {
        return {
            oAddress: this.oAddress.toString(),
            oAssets: this.fillAssets()
        }
    }
}

export class L2UTxO {
    private readonly uRef: L2OutputRef
    private readonly uOutput: L2Output

    public constructor(uRef: L2OutputRef, uOutput: L2Output) {
        this.uRef = uRef
        this.uOutput = uOutput
    }

    public static empty(numAssets: number): L2UTxO {
        return new L2UTxO(L2OutputRef.empty, L2Output.empty(numAssets))
    }

    public toJSON() {
        return {
            uRef: this.uRef.toJSON(),
            uOutput: this.uOutput.toJSON(),
        }
    }

}

export class L2TxOutput {
    private readonly output: L2Output
    private readonly bridgeOut: boolean

    public constructor(output: L2Output, bridgeOut: boolean) {
        this.output = output
        this.bridgeOut = bridgeOut
    }

    public static empty(numAssets: number): L2TxOutput {
        return new L2TxOutput(L2Output.empty(numAssets), false)
    }

    public static l2Output(output: L2Output): L2TxOutput {
        return new L2TxOutput(output, false)
    }

    public static bridgeOut(output: L2Output): L2TxOutput {
        return new L2TxOutput(output, true)
    }

    public toJSON() { // TODO: probably won't work -- fix this
        return {
            output: this.output.toJSON(),
            bridgeOut: this.bridgeOut
        }
    }
}

export class L2Tx {
    private readonly inputs: L2OutputRef[]
    private readonly outputs: L2TxOutput[]
    private readonly numInputs: number
    private readonly numOutputs: number
    private readonly numAssets: number

    public constructor(numInputs: number, numOutputs: number, numAssets: number) {
        this.numInputs = numInputs
        this.numOutputs = numOutputs
        this.numAssets = numAssets
        this.inputs = []
        this.outputs = []
    }

    public addInput(input: L2OutputRef): void {
        if (this.inputs.length > this.numInputs) {
            throw new Error("Attempted to add more inputs than the Transaction supports")
        }
        this.inputs.push(input)
    }

    public addOutput(output: L2TxOutput): void {
        if (this.outputs.length > this.numOutputs) {
            throw new Error("Attempted to add more outputs than the Transaction supports")
        }
        this.outputs.push(output)
    }
    
    private fillInputs() {
        const inputs = this.inputs.map((x) => x.toJSON())
        while (inputs.length < this.numInputs) {
            inputs.push(L2OutputRef.empty.toJSON())
        }
        return inputs
    }

    private fillOutputs() {
        const outputs = this.outputs.map((x) => x.toJSON())
        while (outputs.length < this.numOutputs) {
            outputs.push(L2TxOutput.empty(this.numAssets).toJSON())
        }
        return outputs
    }

    public toJSON() {
        return {
            inputs: this.fillInputs(),
            outputs: this.fillOutputs(),
        }
    }
}

export class SubmitTxRequest {

}

export class SubmitTxResponse {

}

// ==============================================================

export interface TxParametersResponse {
    inputs: number,
    outputs: number,
    assets: number,
}

// ==============================================================

export interface TxHashRequest {
    transaction: L2Tx
}

export interface TxHashResponse {
    hash: FieldElement
}

// ==============================================================

export interface BridgeInRequest {
    amount: {[key: string]: number},
    destination_address: L2Address,
    used_addresses: CSL.Address[],
    change_address: CSL.Address
}

export interface BridgeInResponse {
    transaction: string
}

// ==============================================================

export interface SubmitL1TxRequest {
    transaction: string,
    witness: CSL.TransactionWitnessSet,
}

export interface SubmitL1TxResponse {
    tx_id: string
}

// ==============================================================

/**
 * A wrapper for interaction with the aggregation server backend.
 * @class
 */
export class L2Backend {
    private url: string
    private secret: string | null

    /**
     * Creates a new Backend object.
     * @param {string} url     - Backend's URL
     * @param {string} secret  - optional Backend's secret (API key)
     */
    constructor(url: string, secret: string | null = null) {
        this.url = url
        this.secret = secret
    }

    private headers(additional: Record<string, string> = {}) {
        if (Object.keys(additional).length === 0 && !this.secret) {
            return {}
        }
        const headers: Record<string, any> = {
            headers: additional
        }
        if (this.secret) {
            headers.headers['api-key'] = this.secret
        }
        return headers
    }

    /**
     * Health check 
     * @async
     */
    public async health(): Promise<void> {
        await axios.get(`${this.url}/v0/health`, this.headers())
        return
    }

    /**
     * Obtain UTxO stored at an L2 address 
     * @async
     * @param {L2Address} address
     * @returns {L2UTxO[]}
     */
    public async utxos(address: L2Address): Promise<L2UTxO[]> {
        const { data } = await axios.get(`${this.url}/v0/utxos?address=${address.toString()}`, this.headers())
        return data.qlurUtxos
    }

    /**
     * Obtain current transaction parameters (supported inputs, outputs and assets) 
     * @async
     * @returns {TxParametersResponse}
     */
    public async txParameters(): Promise<TxParametersResponse> {
        const { data } = await axios.get(`${this.url}/v0/tx/parameters/`, this.headers())

        return data
    }

    /**
     * Obtain hash of an L2 transaction 
     * @async
     * @param {TxHashRequest} txRequest
     * @returns {TxHashResponse}
     */
    public async txHash(tx: TxHashRequest): Promise<TxHashResponse> {
        const { data } = await axios.post(`${this.url}/v0/tx/hash/`, tx, this.headers())

        return data
    }


    /**
     * Submit an L2 transaction
     * @async
     * @param {SubmitTxRequest} txRequest
     * @returns {SubmitTxResponse}
     */
    public async submitTx(txRequest: SubmitTxRequest): Promise<SubmitTxResponse> {
        const { data } = await axios.post(`${this.url}/v0/tx/`, txRequest, this.headers())

        return data
    }

    /**
     * Bridge assets from L1 to L2 
     * @async
     * @param {BridgeInRequest} bridgeInRequest 
     * @returns {BridgeInResponse}
     */
    public async bridgeIn(bridgeInRequest: BridgeInRequest): Promise<BridgeInResponse> {
        const dest: number = +bridgeInRequest.destination_address.toString()
        const req = {
            amount: bridgeInRequest.amount,
            destination_address: dest,
            used_addresses: bridgeInRequest.used_addresses.map((x) => x.to_bech32()),
            change_address: bridgeInRequest.change_address.to_bech32(),
        }
        const { data } = await axios.post(`${this.url}/v0/bridge/in/`, req, this.headers())

        return data 
    }


    /**
     * Submit an L1 transaction 
     * @async
     * @param {SubmitL1TxRequest} txRequest
     * @returns {SubmitL1TxResponse}
     */
    public async submitL1Tx(txRequest: SubmitL1TxRequest): Promise<SubmitL1TxResponse> {
        const witnessHex = Buffer.from(txRequest.witness.to_bytes()).toString('hex')
        const { data } = await axios.post(`${this.url}/v0/l1/tx/submit/`, { transaction: txRequest.transaction, witness: witnessHex } , this.headers())

        return data 
    }

}
