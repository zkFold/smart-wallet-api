import { BigIntWrap } from './Common';

/**
 *  ProofBytes used by Plonkup.
 *  This object will be sent to the backend as a proof that user possesses a valid JSON Web Token 
 *  and used in the script redeemer.
 */
export interface ProofBytes {
    "a_xi_int": BigIntWrap,
    "b_xi_int": BigIntWrap,
    "c_xi_int": BigIntWrap,
    "cmA_bytes": string,
    "cmB_bytes": string,
    "cmC_bytes": string,
    "cmF_bytes": string,
    "cmH1_bytes": string,
    "cmH2_bytes": string,
    "cmQhigh_bytes": string,
    "cmQlow_bytes": string,
    "cmQmid_bytes": string,
    "cmZ1_bytes": string,
    "cmZ2_bytes": string,
    "f_xi_int": BigIntWrap,
    "h1_xi'_int": BigIntWrap,
    "h2_xi_int": BigIntWrap,
    "l1_xi": BigIntWrap,
    "l_xi": BigIntWrap[],
    "proof1_bytes": string,
    "proof2_bytes": string,
    "s1_xi_int": BigIntWrap,
    "s2_xi_int": BigIntWrap,
    "t_xi'_int": BigIntWrap,
    "t_xi_int": BigIntWrap,
    "z1_xi'_int": BigIntWrap,
    "z2_xi'_int": BigIntWrap
}

/**
 *  RSA public key provided by the prover 
 *
 *  @property {BigIntWrap}      public_e    - Public exponent 
 *  @property {BigIntWrap}      public_n    - Public modulus 
 *  @property {BigIntWrap}      public_size - Key size in bits 
 */
export interface PublicKey {
    public_e: BigIntWrap,
    public_n: BigIntWrap,
    public_size: BigIntWrap
}

/**
 *  RSA public key provided by the prover with its unique identifier 
 *
 *  @property {string}         pkbId        - Public key identifier
 *  @property {PublicKey}      pkbPublic    - Public key itself
 */
export interface ProverPublicKey {
    pkbId: string,
    pkbPublic: PublicKey
}

/**
 *  ZK Proof input 
 *
 *  @property {BigIntWrap}      piPubE         - Google's RSA public exponent 
 *  @property {BigIntWrap}      piPubN         - Google's RSA public modulus
 *  @property {BigIntWrap}      piSignature    - Signature attached to the Google OAuth JSON Web Token
 *  @property {BigIntWrap}      piTokenName    - The name of the token minted in the wallet initialisation transaction
 */
export interface ProofInput {
    piPubE: BigIntWrap,
    piPubN: BigIntWrap,
    piSignature: BigIntWrap,
    piTokenName: BigIntWrap,
}
