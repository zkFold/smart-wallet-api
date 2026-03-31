// Implements MiMC + EdDSA over Jubjub to match zkFold/symbolic Haskell code.
//
// Haskell references:
// - MiMC constants: ZkFold.Algorithm.Hash.MiMC.Constants (seed=42 LE, iterate SHA256, take 218, wrap 0..0)
// - MiMC Feistel:   ZkFold.Algorithm.Hash.MiMC (mimcHash2 exponent 5, constants applied in reverse order)
// - EdDSA:          ZkFold.Symbolic.Algorithm.EdDSA (eddsaSign / eddsaVerify, scalarFieldFromFE)
//

import { sha256 } from '@noble/hashes/sha2.js';
import { jubjub } from '@noble/curves/misc.js';

// ---------- small bigint helpers ----------
function mod(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

function leBytesToBigInt(bytes: Uint8Array): bigint {
  // Matches Haskell LittleEndian Binary instance: sum byte[i] * 256^i
  // (variable-length, no fixed padding)
  let x = 0n;
  let pow = 1n;
  for (const b of bytes) {
    x += BigInt(b) * pow;
    pow <<= 8n;
  }
  return x;
}

function pow5(x: bigint, p: bigint): bigint {
  // (x^5 mod p) using x^2, x^4, x^5 like the optimized Haskell circuit version
  const x2 = mod(x * x, p);
  const x4 = mod(x2 * x2, p);
  return mod(x4 * x, p);
}

// ---------- MiMC constants (matches Haskell exactly) ----------
export function mimcConstantsRaw(): bigint[] {
  // Haskell:
  // mimcSeed :: LittleEndian = 42
  // cs = take 218 $ map (LE->Integer) $ iterate sha256 (toByteString mimcSeed)
  // mimcConstants = map fromConstant (0 : cs ++ [0])
  //
  // Important detail: toByteString (LittleEndian 42) is one byte: 0x2a.
  const seed = Uint8Array.from([42]); // LittleEndian variable-length encoding of 42

  const cs: bigint[] = [];
  let cur = seed;
  for (let i = 0; i < 218; i++) {
    cs.push(leBytesToBigInt(cur));
    cur = sha256(cur); // next = SHA256(prev)
  }
  return [0n, ...cs, 0n]; // total 220
}

export function mimcConstantsModP(p: bigint): bigint[] {
  return mimcConstantsRaw().map((c) => mod(c, p));
}

// ---------- MiMC-2n/n (Feistel) (matches Haskell mimcHash2) ----------
export function mimcHash2(
  roundConstants: readonly bigint[],
  k: bigint,
  xL: bigint,
  xR: bigint,
  p: bigint
): bigint {
  if (roundConstants.length === 0) throw new Error('mimcHash2: empty list');

  // Haskell uses reverse constants, then iterates (c :| cs) left-to-right.
  // Equivalent loop: idx from last -> first.
  for (let idx = roundConstants.length - 1; idx >= 0; idx--) {
    const c = roundConstants[idx];
    const t = mod(xL + k + c, p);
    const t5 = pow5(t, p);
    const out = mod(t5 + xR, p);

    if (idx !== 0) {
      // Feistel swap (except last round): (xL, xR) <- (out, xL)
      xR = xL;
      xL = out;
    } else {
      // last round: no swap, return
      return out;
    }
  }
  // unreachable
  throw new Error('mimcHash2: unreachable');
}

// ---------- MiMC hash for multiple inputs (matches Haskell mimcHashN) ----------
export function mimcHashN(
  roundConstants: readonly bigint[],
  k: bigint,
  inputs: readonly bigint[],
  p: bigint
): bigint {
  // Haskell:
  // go [] = hash2 0 0
  // go [z] = hash2 0 z
  // go [zL,zR] = hash2 zL zR
  // go (zL:zR:zs) = go (hash2 zL zR : zs)
  let arr = inputs.slice();

  if (arr.length === 0) return mimcHash2(roundConstants, k, 0n, 0n, p);
  if (arr.length === 1) return mimcHash2(roundConstants, k, 0n, mod(arr[0], p), p);

  // reduce pairwise from the left
  while (arr.length > 2) {
    const zL = mod(arr[0], p);
    const zR = mod(arr[1], p);
    const h = mimcHash2(roundConstants, k, zL, zR, p);
    arr = [h, ...arr.slice(2)];
  }
  return mimcHash2(roundConstants, k, mod(arr[0], p), mod(arr[1], p), p);
}

// Convenience wrapper: MiMC with zkFold constants and key=0
export function mimcHash(inputs: readonly bigint[], p: bigint): bigint {
  const C = mimcConstantsModP(p);
  return mimcHashN(C, 0n, inputs.map((x) => mod(x, p)), p);
}

// ---------- EdDSA (matches ZkFold.Symbolic.Algorithm.EdDSA) ----------
export type JubjubPoint = InstanceType<(typeof jubjub)['Point']>;

export function pointToAffineXY(P: JubjubPoint): { x: bigint; y: bigint } {
  // noble-curves points typically support toAffine()
  // (if API differs in your version, adapt here)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = (P as any).toAffine();
  return { x: BigInt(a.x), y: BigInt(a.y) };
}

export function scalarFieldFromFE(fe: bigint, curveOrder: bigint): bigint {
  // Haskell scalarFieldFromFE = fromUInt (from fe :: UInt(NumberOfBits(BaseField)))
  // fromUInt performs modulo by scalar field order.
  return mod(fe, curveOrder);
}

/**
 * Hash function used by EdDSA.hs:
 *   hashFn (rPoint :*: publicKey :*: message)
 * Where rPoint and publicKey are affine points (x,y) and message is a base-field element.
 *
 * This replicates the arithmetization order for AffinePoint: x then y. (See AffinePoint Binary put x then y.)
 */
export function hashForEddsa(
  rPoint: JubjubPoint,
  publicKey: JubjubPoint,
  messageFE: bigint,
  baseFieldModulus: bigint
): bigint {
  const r = pointToAffineXY(rPoint);
  const a = pointToAffineXY(publicKey);
  return mimcHash([r.x, r.y, a.x, a.y, mod(messageFE, baseFieldModulus)], baseFieldModulus);
}

/**
 * Deterministic nonce r per Haskell:
 *   r = scalarFieldFromFE ( hashFn (hashFn privKey :*: message) )
 * Where hashFn privKey is MiMC applied to the arithmetized privKey.
 *
 * For interoperability with a typical backend that treats privKey as a scalar integer,
 * we hash privKey as a single base-field element equal to privKey (embedded into base field).
 */
export function nonceR(
  privKeyScalar: bigint,
  messageFE: bigint,
  baseFieldModulus: bigint,
  scalarFieldOrder: bigint
): bigint {
  const hPriv = mimcHash([mod(privKeyScalar, baseFieldModulus)], baseFieldModulus);
  const h = mimcHash([hPriv, mod(messageFE, baseFieldModulus)], baseFieldModulus);
  return scalarFieldFromFE(h, scalarFieldOrder);
}

export type EddsaSignature = { R: JubjubPoint; s: bigint };

/**
 * Sign exactly like Haskell eddsaSign:
 *   publicKey = privKey * G
 *   r = scalarFieldFromFE ( hashFn (hashFn privKey :*: message) )
 *   R = r * G
 *   h = scalarFieldFromFE ( hashFn (R :*: publicKey :*: message) )
 *   s = r + h * privKey
 */
export function eddsaSign(
  privKeyScalar: bigint,
  messageFE: bigint
): { publicKey: JubjubPoint; signature: EddsaSignature } {
  const P = jubjub.Point.CURVE().p;
  const N = jubjub.Point.CURVE().n;

  const Point = (jubjub as any).Point;
  const G: JubjubPoint = Point.BASE;

  const sk = mod(privKeyScalar, N);
  const publicKey: JubjubPoint = G.multiply(sk);

  const r = nonceR(sk, messageFE, P, N);
  const R: JubjubPoint = G.multiply(r);

  const hBase = hashForEddsa(R, publicKey, messageFE, P);
  const h = scalarFieldFromFE(hBase, N);

  const s = mod(r + mod(h * sk, N), N);
  return { publicKey, signature: { R, s } };
}

/**
 * Verify exactly like Haskell eddsaVerify:
 *   s*G == R + H(R,A,M) * A
 */
export function eddsaVerify(
  publicKey: JubjubPoint,
  messageFE: bigint,
  sig: EddsaSignature
): boolean {
  const P = jubjub.Point.CURVE().p;
  const N = jubjub.Point.CURVE().n;

  const Point = (jubjub as any).Point;
  const G: JubjubPoint = Point.BASE;

  const hBase = hashForEddsa(sig.R, publicKey, messageFE, P);
  const h = scalarFieldFromFE(hBase, N);

  const lhs = G.multiply(mod(sig.s, N));
  const rhs = sig.R.add(publicKey.multiply(h));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (lhs as any).equals(rhs);
}
