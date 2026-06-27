import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import { Backend } from '../src/Service/Backend'
import {
    AssetValue,
    BridgeOut,
    FieldElement,
    L2Address,
    L2Backend,
    L2Output,
    L2OutputRef,
    L2Tx,
    L2TxOutput,
    L2UTxO,
    Signature,
    TxInfo,
} from '../src/Service/L2'
import { L2Wallet } from '../src/L2Wallet'
import { AddressType, TransactionRequest } from '../src/Types'

const DEFAULT_ROLLUP_URL = 'http://ec2-18-195-224-227.eu-central-1.compute.amazonaws.com:8102'
const DEFAULT_WALLET_B_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

type Network = 'mainnet' | 'preprod' | 'preview'

function env(name: string): string | undefined {
    const value = process.env[name]
    return value && value.trim().length > 0 ? value.trim() : undefined
}

function requiredEnv(name: string): string {
    const value = env(name)
    if (!value) {
        throw new Error(`Missing required environment variable ${name}`)
    }
    return value
}

function numberEnv(name: string, fallback: number): number {
    const value = env(name)
    return value ? Number(value) : fallback
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function refKey(utxo: L2UTxO): string {
    const ref = utxo.uRef.toJSON()
    return `${ref.orTxId.toString()}#${ref.orIndex}`
}

function adaOutput(address: L2Address, amount: number, assetSlots: number): L2Output {
    const output = new L2Output(address, assetSlots)
    output.addAsset(AssetValue.ada(amount))
    return output
}

function paddedSignatures(signature: Signature, inputSlots: number): Signature[] {
    const signatures = [signature]
    while (signatures.length < inputSlots) {
        signatures.push(signature)
    }
    return signatures
}

function demoBackend(network: Network): Backend {
    return {
        settings: async () => ({ network, version: 'v0' }),
    } as unknown as Backend
}

async function pollBridgeIn(
    l2: L2Backend,
    address: L2Address,
    before: Set<string>,
    pollMs: number,
    timeoutMs: number,
): Promise<L2UTxO> {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
        const utxos = await l2.utxos(address)
        const fresh = utxos.find((utxo) => !before.has(refKey(utxo)))
        const elapsed = Math.floor((Date.now() - started) / 1000)
        if (fresh) {
            console.log(`Bridge-in reflected in L2 after ${elapsed}s: ${refKey(fresh)}`)
            return fresh
        }
        console.log(`[bridge-in ${elapsed}s] waiting for L2 UTxO...`)
        await sleep(pollMs)
    }
    throw new Error('Timed out waiting for bridge-in L2 UTxO')
}

async function pollBatched(
    l2: L2Backend,
    txHash: string,
    bridgeOutAddress: CSL.Address,
    pollMs: number,
    timeoutMs: number,
): Promise<TxInfo> {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
        const tx = await l2.tx(txHash)
        const bridgeOuts = await l2.bridgeOuts(bridgeOutAddress)
        const bridgeOut = bridgeOuts.entries.find((entry) => entry.tx_hash === txHash)
        const elapsed = Math.floor((Date.now() - started) / 1000)
        console.log(
            `[batch ${elapsed}s] tx=${tx.record.status}, bridgeOut=${bridgeOut?.status ?? 'missing'}`,
        )
        if (tx.record.status === 'batched' && bridgeOut?.status === 'batched') {
            return tx.record
        }
        await sleep(pollMs)
    }
    throw new Error('Timed out waiting for L2 bridge-out batch')
}

async function main(): Promise<void> {
    const rollupUrl = env('ROLLUP_URL') ?? DEFAULT_ROLLUP_URL
    const network = (env('L2_DEMO_NETWORK') ?? 'preprod') as Network
    const amount = numberEnv('L2_DEMO_AMOUNT_LOVELACE', 5_000_000)
    const pollMs = numberEnv('L2_DEMO_POLL_SECONDS', 30) * 1000
    const timeoutMs = numberEnv('L2_DEMO_TIMEOUT_SECONDS', 1_800) * 1000
    const mnemonicA = requiredEnv('L2_DEMO_MNEMONIC_A')
    const mnemonicB = env('L2_DEMO_MNEMONIC_B') ?? DEFAULT_WALLET_B_MNEMONIC

    const l2 = new L2Backend(rollupUrl, env('ROLLUP_API_KEY') ?? null)
    const backend = demoBackend(network)
    const walletA = new L2Wallet(backend, l2, mnemonicA, env('L2_DEMO_PASSWORD_A') ?? '')
    const walletB = new L2Wallet(backend, l2, mnemonicB, env('L2_DEMO_PASSWORD_B') ?? '')
    await walletA.setNetwork()
    await walletB.setNetwork()

    const params = await l2.txParameters()
    const walletAL1 = CSL.Address.from_bech32(await walletA.stringAddress())
    const bridgeOutAddress = env('L2_DEMO_BRIDGE_OUT_ADDRESS')
        ? CSL.Address.from_bech32(requiredEnv('L2_DEMO_BRIDGE_OUT_ADDRESS'))
        : walletAL1

    console.log(`Rollup API: ${rollupUrl}`)
    console.log(`Wallet A L1: ${walletAL1.to_bech32()}`)
    console.log(`Wallet A L2: ${walletA.l2Address().toString()}`)
    console.log(`Wallet B L2: ${walletB.l2Address().toString()}`)
    console.log(`Bridge-out L1: ${bridgeOutAddress.to_bech32()}`)
    console.log(`Tx parameters: inputs=${params.inputs}, outputs=${params.outputs}, assets=${params.assets}`)

    const beforeBridgeIn = new Set((await l2.utxos(walletA.l2Address())).map(refKey))
    const bridgeInRequest: TransactionRequest = {
        recipient: walletA.l2Address().toString(),
        recipientType: AddressType.L2,
        assets: { lovelace: amount },
    }
    console.log('Submitting bridge-in...')
    await walletA.sendTransaction(bridgeInRequest)
    const bridgeUtxo = await pollBridgeIn(l2, walletA.l2Address(), beforeBridgeIn, pollMs, timeoutMs)

    console.log('Submitting L2 transfer A -> B and chained bridge-out B -> L1...')
    const tx1 = new L2Tx(params.inputs, params.outputs, params.assets)
    const tx1Output = adaOutput(walletB.l2Address(), amount, params.assets)
    tx1.addInput(bridgeUtxo.uRef)
    tx1.addOutput(L2TxOutput.l2Output(tx1Output))
    const sig1 = await walletA.signL2Transaction(tx1)
    const submitted1 = await l2.submitTx({
        transaction: tx1,
        signatures: paddedSignatures(sig1, params.inputs),
        bridge_outs: [],
        input_utxos: [bridgeUtxo],
    })
    console.log(`Transfer queued: ${submitted1.tx_hash} (${submitted1.status})`)

    const tx1OutputRef = new L2OutputRef(new FieldElement(submitted1.tx_hash), 0)
    const tx1Utxo = new L2UTxO(tx1OutputRef, tx1Output)
    const bridgeOutL2Address = await l2.getL2Address(bridgeOutAddress)
    const tx2 = new L2Tx(params.inputs, params.outputs, params.assets)
    tx2.addInput(tx1OutputRef)
    tx2.addOutput(L2TxOutput.bridgeOut(adaOutput(bridgeOutL2Address, amount, params.assets)))
    const sig2 = await walletB.signL2Transaction(tx2)
    const submitted2 = await l2.submitTx({
        transaction: tx2,
        signatures: paddedSignatures(sig2, params.inputs),
        bridge_outs: [new BridgeOut({ lovelace: amount }, bridgeOutAddress)],
        input_utxos: [tx1Utxo],
    })
    console.log(`Bridge-out queued: ${submitted2.tx_hash} (${submitted2.status})`)

    const batched = await pollBatched(l2, submitted2.tx_hash, bridgeOutAddress, pollMs, timeoutMs)
    console.log(`Bridge-out batched in batch ${batched.batch_id}`)
    console.log('SMART_WALLET_L2_DEMO_OK')
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
