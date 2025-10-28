import axios from 'axios';
import forge from 'node-forge';
import { ProofBytes, ProverPublicKey, ProofInput, BigIntWrap } from '../Types';
import { deserialize, serialize } from '../JSON';

/**
 * A wrapper for interaction with the prover 
 * @class
 */
export class Prover {
    private url: string;

    /**
     * Creates a new Prover object.
     * @param {string} url     - Prover's URL
     */
    constructor(url: string) {
        this.url = url
    }

    private headers(additional: Record<string, string> = {}) {
        if (Object.keys(additional).length === 0) {
            return {}
        }
        const headers: Record<string, any> = {
            headers: additional
        }
        return headers
    }

    /**
     * Get all public keys held by the Prover 
     * @async
     * @returns {ProverPublicKey[]}
     */
    public async serverKeys(): Promise<ProverPublicKey[]> {
        const { data } = await axios.get(`${this.url}/v0/keys`, this.headers())
        return this.parseProverKeys(data)
    }

    /**
     * Submit a proof request to the Prover. It will return a Request ID which can be used to retrieve proof status
     * @async
     * @param {ProofInput} proofInput for the expMod circuit: exponent, modulus, signature and token name
     * @returns {string} proof request ID
     */
    public async requestProof(proofInput: ProofInput): Promise<string> {
        const keys = await this.serverKeys()

        const key = keys[0]

        const payload = serialize(proofInput)

        // 1. Generate AES-256 key and IV
        const aesKey = forge.random.getBytesSync(32) // 256 bits
        const iv = forge.random.getBytesSync(16)     // 128-bit IV for AES-CBC

        // 2. AES encrypt the plaintext with AES-256-CBC and OAEP padding
        const cipher = forge.cipher.createCipher('AES-CBC', aesKey)
        cipher.start({ iv: iv })
        cipher.update(forge.util.createBuffer(payload))
        cipher.finish()
        const encryptedData = cipher.output.getBytes() // Encrypted payload

        // 3. Prepend IV to the ciphertext
        const ivPlusCipher = iv + encryptedData

        const n = new forge.jsbn.BigInteger(key.pkbPublic.public_n.toString(), 10)
        const e = new forge.jsbn.BigInteger(key.pkbPublic.public_e.toString(), 10)
        const publicKey = forge.pki.setRsaPublicKey(n, e)

        const oaepOptions = {
            md: forge.md.sha256.create(),          // hash for OAEP
            mgf1: {
              md: forge.md.sha256.create()         // hash for MGF1
            },
            label: ''
          }

        // 5. Encrypt AES key using RSA OAEP 
        const encryptedKey = publicKey.encrypt(aesKey, 'RSA-OAEP', oaepOptions)

        const proveRequest = {
            server_key_id: key.pkbId,
            aes_encryption_key: forge.util.bytesToHex(encryptedKey),
            encrypted_payload: forge.util.bytesToHex(ivPlusCipher)
        }

        const { data } = await axios.post(`${this.url}/v0/prove`, proveRequest, this.headers())

        return data
    }

    /**
     * Retrieve the status of a Proof Request 
     * @async
     * @param {string} proofId request ID 
     * @returns {ProofBytes | string} ProofBytes if the proof has finished or 'Pending' otherwise
     */
    public async proofStatus(proofId: string): Promise<ProofBytes | null> {
        const { data } = await axios.post(`${this.url}/v0/proof-status`, proofId,
            // to prevent Axios from parsing the result and messing with numbers
            { ...this.headers({ "Content-Type": "application/json" }), ...{ responseType: 'text' } }
        )
        return this.parseProofStatus(data)
    }

    /**
     * Obtain a Proof from the Prover. Unlike requestProof(), this method waits for the proof completion 
     * @async
     * @param {ProofInput} proofInput for the expMod circuit: exponent, modulus, signature and token name
     * @returns {ProofBytes} ZK proof bytes for the expMod circuit
     */
    public async prove(proofInput: ProofInput): Promise<ProofBytes> {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
        const proofId = await this.requestProof(proofInput)

        while (true) {
            try {
                const response = await this.proofStatus(proofId)

                console.log(`Status: ${response}`)

                if (typeof response === 'object' && response !== null) {
                    return response
                }

                await delay(30_000)

            } catch (error) {
                console.error('Error checking status:', error)
            }
        }

    }

    private parseProverKeys(json: any[]): ProverPublicKey[] {
        const result = []
        const arrayLength = json.length
        for (let i = 0; i < arrayLength; i++) {
            const safe = {
                pkbId: json[i].id,
                pkbPublic: {
                    public_e: new BigIntWrap(json[i].public.public_e),
                    public_n: new BigIntWrap(json[i].public.public_n),
                    public_size: new BigIntWrap(json[i].public.public_size),
                }
            }
            result.push(safe)
        }
        return result
    }

    private parseProofStatus(json: string): ProofBytes | null {
        const unsafe = deserialize(json)
        if (unsafe.tag == "Completed") {
            return this.parseProofBytes(unsafe.contents.bytes)
        }
        return unsafe.tag
    }

    private parseProofBytes(json: string): ProofBytes | null {
        console.log(json)
        let unsafe
        if (typeof json === 'string') {
            unsafe = deserialize(json)
        } else if (typeof json === "object") {
            unsafe = json
        } else {
            return null
        }

        let l_xi = []

        for (let i = 0; i < unsafe.l_xi.length; ++i) {
            l_xi.push(new BigIntWrap(unsafe.l_xi[i]))
        }

        const wrapped = {
            "a_xi_int": new BigIntWrap(unsafe.a_xi_int),
            "b_xi_int": new BigIntWrap(unsafe.b_xi_int),
            "c_xi_int": new BigIntWrap(unsafe.c_xi_int),
            "cmA_bytes": unsafe.cmA_bytes,
            "cmB_bytes": unsafe.cmB_bytes,
            "cmC_bytes": unsafe.cmC_bytes,
            "cmF_bytes": unsafe.cmF_bytes,
            "cmH1_bytes": unsafe.cmH1_bytes,
            "cmH2_bytes": unsafe.cmH2_bytes,
            "cmQhigh_bytes": unsafe.cmQhigh_bytes,
            "cmQlow_bytes": unsafe.cmQlow_bytes,
            "cmQmid_bytes": unsafe.cmQmid_bytes,
            "cmZ1_bytes": unsafe.cmZ1_bytes,
            "cmZ2_bytes": unsafe.cmZ2_bytes,
            "f_xi_int": new BigIntWrap(unsafe.f_xi_int),
            "h1_xi'_int": new BigIntWrap(unsafe["h1_xi'_int"]),
            "h2_xi_int": new BigIntWrap(unsafe.h2_xi_int),
            "l1_xi": new BigIntWrap(unsafe.l1_xi),
            "l_xi": l_xi,
            "proof1_bytes": unsafe.proof1_bytes,
            "proof2_bytes": unsafe.proof2_bytes,
            "s1_xi_int": new BigIntWrap(unsafe.s1_xi_int),
            "s2_xi_int": new BigIntWrap(unsafe.s2_xi_int),
            "t_xi'_int": new BigIntWrap(unsafe["t_xi'_int"]),
            "t_xi_int": new BigIntWrap(unsafe.t_xi_int),
            "z1_xi'_int": new BigIntWrap(unsafe["z1_xi'_int"]),
            "z2_xi'_int": new BigIntWrap(unsafe["z2_xi'_int"])
        }

        return wrapped
    }

}

