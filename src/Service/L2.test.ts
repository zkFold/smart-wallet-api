import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import {
    AssetValue,
    FieldElement,
    L2Address,
    L2Backend,
    L2Output,
    L2OutputRef,
    L2Tx,
    L2TxOutput,
    Signature,
    stringifyWithBigInt,
} from './L2'

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}))

const mockedAxios = axios as unknown as { get: Mock, post: Mock }

describe('L2 DTO serialization', () => {
    it('serializes field elements as JSON numbers for aggregator requests', () => {
        const body = stringifyWithBigInt({
            destination_address: new L2Address('l2_46158797386681279449660551146192109801082715412008826514275147611100144249071'),
        })

        expect(body).toBe(
            '{"destination_address":46158797386681279449660551146192109801082715412008826514275147611100144249071}',
        )
    })

    it('uses pubkey, R, s order for signatures', () => {
        expect(Signature.zero().toJSON()).toEqual([
            { x: 0, y: 0 },
            [{ x: 0, y: 0 }, 0],
        ])
    })

    it('marks bridge-out outputs distinctly from normal L2 outputs', () => {
        const output = new L2Output(new L2Address('l2_42'), 2)
        output.addAsset(AssetValue.ada(5_000_000))

        expect(L2TxOutput.l2Output(output).toJSON()[1]).toBe(false)
        expect(L2TxOutput.bridgeOut(output).toJSON()[1]).toBe(true)
    })

    it('rejects more inputs than the circuit supports', () => {
        const tx = new L2Tx(1, 1, 2)
        tx.addInput(new L2OutputRef(FieldElement.zero, 0))

        expect(() => tx.addInput(new L2OutputRef(FieldElement.zero, 1))).toThrow(
            'Attempted to add more inputs than the Transaction supports',
        )
    })
})

describe('L2Backend', () => {
    beforeEach(() => {
        mockedAxios.get.mockReset()
        mockedAxios.post.mockReset()
    })

    it('converts L1 addresses using the deployed API path and preserves big integers', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: '{"l2_address":46158797386681279449660551146192109801082715412008826514275147611100144249071}',
        })
        const backend = new L2Backend('http://rollup.example/')
        const address = { to_bech32: () => 'addr_test1...' } as any

        const l2Address = await backend.getL2Address(address)

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'http://rollup.example/v0/l1/address/convert',
            { address: 'addr_test1...' },
            expect.objectContaining({ responseType: 'text' }),
        )
        expect(l2Address.toString()).toBe(
            'l2_46158797386681279449660551146192109801082715412008826514275147611100144249071',
        )
    })

    it('queries UTxOs with a decimal L2 address and maps response DTOs', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: `{
              "utxos": [
                {
                  "uRef": {
                    "orTxId": 7786014233545767533496597645509592677733634159266275478375685925956151991687,
                    "orIndex": 0
                  },
                  "uOutput": {
                    "oAddress": 46158797386681279449660551146192109801082715412008826514275147611100144249071,
                    "oAssets": [
                      {"assetPolicy": 0, "assetName": 0, "assetQuantity": 5000000},
                      {"assetPolicy": 0, "assetName": 0, "assetQuantity": 0}
                    ]
                  }
                }
              ]
            }`,
        })
        const backend = new L2Backend('http://rollup.example')

        const utxos = await backend.utxos(new L2Address('l2_46158797386681279449660551146192109801082715412008826514275147611100144249071'))

        expect(mockedAxios.get).toHaveBeenCalledWith(
            'http://rollup.example/v0/utxos?address=46158797386681279449660551146192109801082715412008826514275147611100144249071',
            expect.objectContaining({ responseType: 'text' }),
        )
        expect(utxos).toHaveLength(1)
        expect(utxos[0].uRef.toJSON().orTxId.toString()).toBe(
            '7786014233545767533496597645509592677733634159266275478375685925956151991687',
        )
        expect(utxos[0].uOutput.address.toString()).toBe(
            'l2_46158797386681279449660551146192109801082715412008826514275147611100144249071',
        )
    })

    it('derives output count from input count when tx parameters omit outputs', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: '{"inputs":2,"assets":2}' })
        const backend = new L2Backend('http://rollup.example')

        await expect(backend.txParameters()).resolves.toEqual({ inputs: 2, outputs: 2, assets: 2 })
    })

    it('parses transaction hashes without losing field-element precision', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: '{"hash":29931946378447235425800399358983051578702798626614613666022638876278288045341}',
        })
        const backend = new L2Backend('http://rollup.example')
        const tx = new L2Tx(2, 2, 2)

        const response = await backend.txHash({ transaction: tx })

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'http://rollup.example/v0/tx/hash',
            expect.any(String),
            expect.objectContaining({ responseType: 'text' }),
        )
        expect(response.hash.toString()).toBe(
            '29931946378447235425800399358983051578702798626614613666022638876278288045341',
        )
    })
})
