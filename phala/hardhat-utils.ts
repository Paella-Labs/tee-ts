const KMS_CONTRACT_ADDRESS =
  process.env.KMS_CONTRACT_ADDRESS ||
  "0x59E4a36B01a87fD9D1A4C12377253FE9a7b018Ba";

// biome-ignore lint/suspicious/noExplicitAny:
export async function getKmsAuth(ethers: any) {
  return await ethers.getContractAt("KmsAuth", KMS_CONTRACT_ADDRESS);
}

// biome-ignore lint/suspicious/noExplicitAny:
export async function waitForTx(tx: any) {
  console.log(`Waiting for transaction ${tx.hash} to be confirmed...`);
  return await tx.wait();
}
