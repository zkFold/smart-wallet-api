import * as CSL from '@emurgo/cardano-serialization-lib-browser';
import axios, { type AxiosRequestConfig } from 'axios';
import { deserialize } from '../JSON';
import { Buffer } from 'buffer';
import { JubjubPoint, EddsaSignature, pointToAffineXY } from '../EdDSA'
import { jubjub } from '@noble/curves/misc.js'

export function bigintToJSON(num: bigint): string {
    return `__bigint__:${num}`
}

export function stringifyWithBigInt(obj: unknown): string {
  return JSON.stringify(obj).replace(/"__bigint__:(\d+)"/g, "$1");
}

export class FieldElement {
    public readonly scalar: bigint 

    public constructor(scalar: string | number | bigint) {
        const normalized = typeof scalar === "string" && scalar.startsWith("__bigint__:")
            ? scalar.slice("__bigint__:".length)
            : scalar
        this.scalar = BigInt(normalized)
    }

    public static readonly zero: FieldElement = new FieldElement("0")

    public static fromJSON(value: unknown): FieldElement {
        if (value instanceof FieldElement) {
            return value
        }
        if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
            return new FieldElement(value)
        }
        throw new Error(`Invalid field element: ${String(value)}`)
    }

    public toString(): string {
        return this.scalar.toString()
    }

    public toJSON() {
        return bigintToJSON(this.scalar) 
    }

}

export class L2Address {

    private readonly fieldElement: FieldElement 

    public constructor(address: string) {
        const [header, fieldElement] = address.split("_")
        if (header !== "l2") {
            throw new Error(`The provided address is not of the form 'l2_<decimal digits>': ${address}`)
        }
        this.fieldElement = new FieldElement(fieldElement) 
    }

    public static readonly empty: L2Address = new L2Address("l2_0")

    public static fromFieldElement(fieldElement: FieldElement): L2Address {
        return new L2Address(`l2_${fieldElement.toString()}`)
    }

    public static fromJSON(value: unknown): L2Address {
        return L2Address.fromFieldElement(FieldElement.fromJSON(value))
    }

    public toFieldElement(): FieldElement {
        return this.fieldElement
    }

    public toDecimalString(): string {
        return this.fieldElement.toString()
    }

    public toString(): string {
        return `l2_${this.fieldElement.toString()}`
    }

    public toJSON() {
        return this.fieldElement.toJSON()
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

    public static fromJSON(value: any): L2OutputRef {
        return new L2OutputRef(FieldElement.fromJSON(value.orTxId), Number(value.orIndex))
    }

    public toJSON() {
        return {
            orTxId: this.orTxId,
            orIndex: this.orIndex,
        }
    }
}

export class AssetValue {
    private readonly assetPolicy: FieldElement
    private readonly assetName: FieldElement
    private readonly assetQuantity: number 

    public constructor(assetPolicy: FieldElement, assetName: FieldElement, assetQuantity: number) {
        this.assetPolicy = assetPolicy
        this.assetName = assetName
        this.assetQuantity = assetQuantity
    }

    public static readonly empty: AssetValue = new AssetValue(FieldElement.zero, FieldElement.zero, 0)

    public static ada(quantity: number): AssetValue {
        return new AssetValue(FieldElement.zero, FieldElement.zero, quantity)
    }

    public static fromJSON(value: any): AssetValue {
        return new AssetValue(
            FieldElement.fromJSON(value.assetPolicy),
            FieldElement.fromJSON(value.assetName),
            Number(value.assetQuantity),
        )
    }

    public get policy(): FieldElement {
        return this.assetPolicy
    }

    public get name(): FieldElement {
        return this.assetName
    }

    public get quantity(): number {
        return this.assetQuantity
    }

    public toJSON() {
        return {
            assetPolicy: this.assetPolicy,
            assetName: this.assetName,
            assetQuantity: this.assetQuantity,
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

    public static fromJSON(value: any): L2Output {
        const assets = (value.oAssets ?? []).map((asset: any) => AssetValue.fromJSON(asset))
        const output = new L2Output(L2Address.fromJSON(value.oAddress), assets.length)
        assets.forEach((asset: AssetValue) => output.addAsset(asset))
        return output
    }

    public get address(): L2Address {
        return this.oAddress
    }

    public get assets(): AssetValue[] {
        return [...this.oAssets]
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
            oAddress: this.oAddress,
            oAssets: this.fillAssets()
        }
    }
}

export class L2UTxO {
    public readonly uRef: L2OutputRef
    public readonly uOutput: L2Output

    public constructor(uRef: L2OutputRef, uOutput: L2Output) {
        this.uRef = uRef
        this.uOutput = uOutput
    }

    public static empty(numAssets: number): L2UTxO {
        return new L2UTxO(L2OutputRef.empty, L2Output.empty(numAssets))
    }

    public static fromJSON(value: any): L2UTxO {
        return new L2UTxO(L2OutputRef.fromJSON(value.uRef), L2Output.fromJSON(value.uOutput))
    }

    public toJSON() {
        return {
            uRef: this.uRef,
            uOutput: this.uOutput,
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

    public toJSON() { 
        return [this.output, this.bridgeOut]
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
        if (this.inputs.length >= this.numInputs) {
            throw new Error("Attempted to add more inputs than the Transaction supports")
        }
        this.inputs.push(input)
    }

    public addOutput(output: L2TxOutput): void {
        if (this.outputs.length >= this.numOutputs) {
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

export class Signature {
    private readonly signature: EddsaSignature
    private readonly pubkey: JubjubPoint
    private isZero: boolean

    constructor(signature: EddsaSignature, pubkey: JubjubPoint) {
        this.signature = signature
        this.pubkey = pubkey
        this.isZero = false
    }

    public static zero(): Signature {
        const Point = (jubjub as any).Point;
        const gen: JubjubPoint = Point.BASE;
        const sig = new Signature({R: gen, s: 0n}, gen)
        sig.isZero = true
        return sig
    }


    public toJSON() {
        if (this.isZero) {
            return [{x: 0, y: 0}, [{x: 0, y: 0}, 0]]
        }
        const { R, s } = this.signature
        const rAffine = pointToAffineXY(R)
        const pubkeyAffine = pointToAffineXY(this.pubkey)
        return [ { x: bigintToJSON(pubkeyAffine.x)
                 , y: bigintToJSON(pubkeyAffine.y)
                 }
               , [ { x: bigintToJSON(rAffine.x)
                   , y: bigintToJSON(rAffine.y)
                   }
                 , bigintToJSON(s)
                 ]
               ]
    }
}

export class BridgeOut {
    private readonly value: { [key: string]: number }
    private readonly address: CSL.Address

    constructor(value: { [key: string]: number }, address: CSL.Address) {
        this.value = value 
        this.address = address 
    }

    public toJSON() {
        return [this.value, this.address.to_bech32()]
    }
}

export interface SubmitTxRequest {
    transaction: L2Tx,
    signatures: Signature[],
    bridge_outs: BridgeOut[],
    input_utxos: L2UTxO[],
}

export interface SubmitTxResponse {
    status: string,
    tx_hash: string,
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

export interface L2TxHistoryRequest {
    l2address: L2Address 
}

export interface TxInfo {
    batch_id?: number | null,
    hash: string,
    id: number,
    payload: unknown,
    status: string,
    submitted_at: string,
}

export interface L2TxHistoryResponse {
    total: number,
    txs: TxInfo[],
}

export interface TxResponse {
    record: TxInfo,
}

export interface PendingTxsResponse {
    txs: TxInfo[],
}

export interface BridgeOutEntry {
    tx_hash: string,
    value: { [key: string]: number },
    status: string,
}

export interface BridgeOutsResponse {
    entries: BridgeOutEntry[],
}

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
        this.url = url.replace(/\/+$/, "")
        this.secret = secret
    }

    private headers(additional: Record<string, string> = {}): AxiosRequestConfig {
        const headers: Record<string, string> = { ...additional }
        if (this.secret) {
            headers['api-key'] = this.secret
        }
        return Object.keys(headers).length === 0 ? {} : { headers }
    }

    private textConfig(additional: Record<string, string> = {}): AxiosRequestConfig {
        return { ...this.headers(additional), responseType: "text" }
    }

    private parseJSON<T>(data: unknown): T {
        if (typeof data !== "string") {
            return data as T
        }
        const parsed = deserialize(data)
        if (parsed === null) {
            throw new Error("Failed to parse aggregator JSON response")
        }
        return parsed as T
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
     * Obtain L2 representation of an L1 address 
     * @async
     * @param {CSL.Address} address
     * @returns {L2Address}
     */
    public async getL2Address(address: CSL.Address): Promise<L2Address> {
        const { data } = await axios.post(
            `${this.url}/v0/l1/address/convert`,
            { address: address.to_bech32() },
            this.textConfig({ "Content-Type": "application/json" }),
        )
        const response = this.parseJSON<{ l2_address: unknown }>(data)
        return L2Address.fromJSON(response.l2_address)
    }

    /**
     * Obtain UTxO stored at an L2 address 
     * @async
     * @param {L2Address} address
     * @returns {L2UTxO[]}
     */
    public async utxos(address: L2Address): Promise<L2UTxO[]> {
        const { data } = await axios.get(
            `${this.url}/v0/utxos?address=${encodeURIComponent(address.toDecimalString())}`,
            this.textConfig(),
        )
        const response = this.parseJSON<{ utxos: unknown[] }>(data)
        return response.utxos.map((utxo) => L2UTxO.fromJSON(utxo))
    }

    /**
     * Obtain current transaction parameters (supported inputs, outputs and assets) 
     * @async
     * @returns {TxParametersResponse}
     */
    public async txParameters(): Promise<TxParametersResponse> {
        const { data } = await axios.get(`${this.url}/v0/tx/parameters`, this.textConfig())
        const response = this.parseJSON<{ inputs: number, outputs?: number, assets: number }>(data)
        return {
            inputs: Number(response.inputs),
            outputs: Number(response.outputs ?? response.inputs),
            assets: Number(response.assets),
        }
    }

    /**
     * Obtain hash of an L2 transaction 
     * @async
     * @param {TxHashRequest} txRequest
     * @returns {TxHashResponse}
     */
    public async txHash(tx: TxHashRequest): Promise<TxHashResponse> {
        const { data } = await axios.post(
            `${this.url}/v0/tx/hash`,
            stringifyWithBigInt(tx),
            this.textConfig({ "Content-Type": "application/json" }),
        )
        const response = this.parseJSON<{ hash: unknown }>(data)
        return { hash: FieldElement.fromJSON(response.hash) }
    }


    /**
     * Submit an L2 transaction
     * @async
     * @param {SubmitTxRequest} txRequest
     * @returns {SubmitTxResponse}
     */
    public async submitTx(txRequest: SubmitTxRequest): Promise<SubmitTxResponse> {
        const { data } = await axios.post(
            `${this.url}/v0/tx`,
            stringifyWithBigInt(txRequest),
            this.textConfig({ "Content-Type": "application/json" }),
        )
        return this.parseJSON<SubmitTxResponse>(data)
    }

    /**
     * Bridge assets from L1 to L2 
     * @async
     * @param {BridgeInRequest} bridgeInRequest 
     * @returns {BridgeInResponse}
     */
    public async bridgeIn(bridgeInRequest: BridgeInRequest): Promise<BridgeInResponse> {
        const req = {
            amount: bridgeInRequest.amount,
            destination_address: bridgeInRequest.destination_address,
            used_addresses: bridgeInRequest.used_addresses.map((x) => x.to_bech32()),
            change_address: bridgeInRequest.change_address.to_bech32(),
        }
        const { data } = await axios.post(
            `${this.url}/v0/bridge/in`,
            stringifyWithBigInt(req),
            this.textConfig({ "Content-Type": "application/json" }),
        )
        return this.parseJSON<BridgeInResponse>(data)
    }


    /**
     * Submit an L1 transaction 
     * @async
     * @param {SubmitL1TxRequest} txRequest
     * @returns {SubmitL1TxResponse}
     */
    public async submitL1Tx(txRequest: SubmitL1TxRequest): Promise<SubmitL1TxResponse> {
        const witnessHex = Buffer.from(txRequest.witness.to_bytes()).toString('hex')
        const { data } = await axios.post(
            `${this.url}/v0/l1/tx/submit`,
            { transaction: txRequest.transaction, witness: witnessHex },
            this.textConfig({ "Content-Type": "application/json" }),
        )
        return this.parseJSON<SubmitL1TxResponse>(data)
    }


    /**
     * Obtain L2 transaction history 
     * @async
     * @param {L2Address} address
     * @returns {L2TxHistoryResponse}
     */
    public async txHistory(address: L2Address): Promise<L2TxHistoryResponse> {
        const { data } = await axios.get(
            `${this.url}/v0/txs?l2address=${encodeURIComponent(address.toDecimalString())}`,
            this.textConfig(),
        )
        return this.parseJSON<L2TxHistoryResponse>(data)
    }

    /**
     * Obtain a submitted L2 transaction by hash.
     * @async
     * @param {string} hash
     * @returns {TxResponse}
     */
    public async tx(hash: string): Promise<TxResponse> {
        const { data } = await axios.get(
            `${this.url}/v0/tx/${encodeURIComponent(hash)}`,
            this.textConfig(),
        )
        return this.parseJSON<TxResponse>(data)
    }

    /**
     * Obtain L2 transactions currently waiting for a batch.
     * @async
     * @returns {PendingTxsResponse}
     */
    public async pendingTxs(): Promise<PendingTxsResponse> {
        const { data } = await axios.get(`${this.url}/v0/txs/pending`, this.textConfig())
        return this.parseJSON<PendingTxsResponse>(data)
    }

    /**
     * Obtain bridge-out entries delivered to an L1 address.
     * @async
     * @param {CSL.Address} address
     * @returns {BridgeOutsResponse}
     */
    public async bridgeOuts(address: CSL.Address): Promise<BridgeOutsResponse> {
        const { data } = await axios.get(
            `${this.url}/v0/bridge/out?l1address=${encodeURIComponent(address.to_bech32())}`,
            this.textConfig(),
        )
        return this.parseJSON<BridgeOutsResponse>(data)
    }

}
