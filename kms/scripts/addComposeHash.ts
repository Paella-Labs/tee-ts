import { ethers } from "hardhat";
import hre from "hardhat";
import prompts from "prompts";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Using account:", signer.address);

  const contractResponse = await prompts({
    type: "text",
    name: "contractAddress",
    message: "Enter the CrossmintAppAuth contract address:",
    validate: (value: string) => {
      if (!ethers.isAddress(value)) return "Must be a valid Ethereum address";
      return true;
    },
  });

  const contractAddress = contractResponse.contractAddress;

  const hashResponse = await prompts({
    type: "text",
    name: "composeHash",
    message: "Enter the compose hash (32-byte hex string):",
    validate: (value: string) => {
      const hexValue = value.startsWith("0x") ? value.slice(2) : value;

      if (hexValue.length !== 64)
        return "Compose hash must be 64 hex characters (32 bytes)";
      if (!/^[0-9a-fA-F]{64}$/.test(hexValue))
        return "Compose hash must be a valid hex string";
      return true;
    },
  });

  const composeHash = hashResponse.composeHash.startsWith("0x")
    ? hashResponse.composeHash
    : `0x${hashResponse.composeHash}`;

  const reasonResponse = await prompts({
    type: "text",
    name: "reason",
    message: "Enter the reason for adding this compose hash:",
    validate: (value: string) => {
      if (!value || value.trim() === "") return "Reason must not be empty";
      return true;
    },
  });

  const reason = reasonResponse.reason;

  console.log("\nOperation Parameters:");
  console.log("  Contract Address:", contractAddress);
  console.log("  Compose Hash:", composeHash);
  console.log("  Reason:", reason);

  const confirmResponse = await prompts({
    type: "confirm",
    name: "confirmed",
    message: "Confirm these parameters and proceed?",
    initial: false,
  });

  if (!confirmResponse.confirmed) {
    console.log("Operation cancelled by user.");
    return;
  }

  const CrossmintAppAuth = await ethers.getContractFactory("CrossmintAppAuth");
  const contract = CrossmintAppAuth.attach(contractAddress);

  console.log("Adding compose hash...");
  const tx = await contract.addComposeHash(composeHash, reason);
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait();
  console.log("Compose hash added successfully!");

  const isAllowed = await contract.allowedComposeHashes(composeHash);
  console.log(`Verification - Compose hash allowed: ${isAllowed}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
