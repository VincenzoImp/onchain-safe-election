import * as paillier from "paillier-bigint";

async function getKeyPair() {
  const { publicKey, privateKey } = await paillier.generateRandomKeys(3072);
  return { publicKey, privateKey };
}

async function encrypt(publicKey: paillier.PublicKey, value: bigint) {
  return publicKey.encrypt(value);
}

async function decrypt(privateKey: paillier.PrivateKey, value: bigint) {
  return privateKey.decrypt(value);
}

function sum_encrypted(publicKey: paillier.PublicKey, ...values: bigint[]) {
  return publicKey.addition(...values);
}

const { publicKey, privateKey } = await getKeyPair();

export { encrypt, decrypt, sum_encrypted, publicKey, privateKey };
