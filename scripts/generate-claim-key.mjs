#!/usr/bin/env node
// Generates the Ed25519 key pair this school uses to sign payment claims to the
// control plane.
//
//   npm run claim-key
//
// Put the PRIVATE key in this school's env file (CLAIM_SIGNING_KEY) and keep it
// there: it never leaves the school's server, and the control plane never sees it.
// Send the PUBLIC key to whoever runs the control plane, who adds it to this
// school's page under "Payment claim keys". To rotate, add the new public key
// first, switch the env file over, then have the old key revoked.
//
// Keys are base64url of the raw 32 bytes, the encoding lib/controlPlaneClaim.ts uses.
import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const seed = privateKey
  .export({ format: "der", type: "pkcs8" })
  .subarray(-32)
  .toString("base64url");
const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64url");

console.log("Private key (secret, goes in this school's env file):");
console.log(`CLAIM_SIGNING_KEY=${seed}`);
console.log("");
console.log("Public key (send this to the control plane's owner):");
console.log(pub);
