import axios from 'axios';
import JSONbig from 'json-bigint';
import forge from 'node-forge';
import { BigIntWrap, ProofBytes } from './Backend';
import { serialize } from './JSON';

export function parseProofBytes(json: string): ProofBytes | null {
    console.log(json);
    let unsafe;
    if (typeof json === 'string') {
        const parser = JSONbig({ useNativeBigInt: true });
        unsafe = parser.parse(json);
    } else if (typeof json === "object") {
        unsafe = json;
    } else {
        return null;
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
        "l_xi": new BigIntWrap(unsafe.l_xi),
        "proof1_bytes": unsafe.proof1_bytes,
        "proof2_bytes": unsafe.proof2_bytes,
        "s1_xi_int": new BigIntWrap(unsafe.s1_xi_int),
        "s2_xi_int": new BigIntWrap(unsafe.s2_xi_int),
        "t_xi'_int": new BigIntWrap(unsafe["t_xi'_int"]),
        "t_xi_int": new BigIntWrap(unsafe.t_xi_int),
        "z1_xi'_int": new BigIntWrap(unsafe["z1_xi'_int"]),
        "z2_xi'_int": new BigIntWrap(unsafe["z2_xi'_int"])
    };

    return wrapped;
}

export interface PublicKey {
    public_e: BigIntWrap,
    public_n: BigIntWrap,
    public_size: BigIntWrap
}

export interface BackendKey {
    pkbId: string,
    pkbPublic: PublicKey
}

export function parseBackendKeys(json: any[]): BackendKey[] {
    const result = [];
    const arrayLength = json.length;
    for (let i = 0; i < arrayLength; i++) {
        const safe = {
            pkbId: json[i].pkbId,
            pkbPublic: {
                public_e: new BigIntWrap(json[i].pkbPublic.public_e),
                public_n: new BigIntWrap(json[i].pkbPublic.public_n),
                public_size: new BigIntWrap(json[i].pkbPublic.public_size),
            }
        }
        result.push(safe);
    }
    return result;
}

export function parseProofStatus(json: string): ProofBytes | string {
    const parser = JSONbig({ useNativeBigInt: true });
    const unsafe = parser.parse(json);
    if (unsafe.tag == "Completed") {
        return parseProofBytes(unsafe.contents.presBytes) || "";
    }
    return unsafe.tag;

}

export interface ProofInput {
    piPubE: BigIntWrap,
    piPubN: BigIntWrap,
    piSignature: BigIntWrap,
    piTokenName: BigIntWrap,
}

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
        this.url = url;
    }

    private headers(additional: Record<string, string> = {}) {
        if (Object.keys(additional).length === 0) {
            return {}
        }
        const headers: Record<string, any> = {
            headers: additional
        }
        return headers;
    }

    /**
     * Get all public keys held by the Backend 
     * @async
     * @returns {BackendKey[]}
     */
    async serverKeys(): Promise<BackendKey[]> {
        const { data } = await axios.get(`${this.url}/v0/keys`, this.headers());
        console.log(data);
        return parseBackendKeys(data);
    }


    /**
     * Submit a proof request to the Backend. It will return a Request ID which can be used to retrieve proof status
     * @async
     * @param {ProofInput} inputs for the expMod circuit: exponent, modulus, signature and token name
     * @returns {string} proof request ID
     */
    async requestProof(proofInput: ProofInput): Promise<string> {
        const keys = await this.serverKeys();

        //TODO: choose the freshest one if we end up implementing key rotation
        const key = keys[0];

        // Use JSONbig for serialization to handle BigInt properly
        const payload = serialize(proofInput);

        // 1. Generate AES-256 key and IV
        const aesKey = forge.random.getBytesSync(32); // 256 bits
        const iv = forge.random.getBytesSync(16);     // 128-bit IV for AES-CBC

        // 2. AES encrypt the plaintext with AES-256-CBC and PKCS#7 padding
        const cipher = forge.cipher.createCipher('AES-CBC', aesKey);
        cipher.start({ iv: iv });
        cipher.update(forge.util.createBuffer(payload));
        cipher.finish();
        const encryptedData = cipher.output.getBytes(); // Encrypted payload

        // 3. Prepend IV to the ciphertext
        const ivPlusCipher = iv + encryptedData;

        const n = new forge.jsbn.BigInteger(key.pkbPublic.public_n.toString(), 10);
        const e = new forge.jsbn.BigInteger(key.pkbPublic.public_e.toString(), 10);
        const publicKey = forge.pki.setRsaPublicKey(n, e);

        // 5. Encrypt AES key using RSA PKCS#1 v1.5
        const encryptedKey = publicKey.encrypt(aesKey, 'RSAES-PKCS1-V1_5');

        const proveRequest = {
            preqKeyId: key.pkbId,
            preqAES: forge.util.bytesToHex(encryptedKey),
            preqPayload: forge.util.bytesToHex(ivPlusCipher)
        };

        const { data } = await axios.post(`${this.url}/v0/prove`, proveRequest, this.headers());

        return data;
    }

    /**
     * Retrieve the status of a Proof Request 
     * @async
     * @param {string} Proof request ID 
     * @returns {ProofBytes | string} ProofBytes if the proof has finished or 'Pending' otherwise
     */
    async proofStatus(proofId: string): Promise<ProofBytes | string> {
        const { data } = await axios.post(`${this.url}/v0/proof-status`, proofId,
            // to prevent Axios from parsing the result and messing with numbers
            { ...this.headers({ "Content-Type": "application/json" }), ...{ responseType: 'text' } }
        );
        return parseProofStatus(data);
    }

    /**
     * Obtain a Proof from the backend. Unlike requestProof(), this method waits for the proof completion 
     * @async
     * @param {ProofInput} inputs for the expMod circuit: exponent, modulus, signature and token name
     * @returns {ProofBytes} ZK proof bytes for the expMod circuit 
     */
    async prove(proofInput: ProofInput): Promise<ProofBytes> {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const proofId = await this.requestProof(proofInput);

        while (true) {
            try {
                const response = await this.proofStatus(proofId);

                console.log(`Status: ${response}`);

                if (typeof response === 'object') {
                    return response;
                }

                await delay(30_000);

            } catch (error) {
                console.error('Error checking status:', error);
                return null as any;
            }
        }

    }

}

