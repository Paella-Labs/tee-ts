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

  const deviceResponse = await prompts({
    type: "text",
    name: "deviceId",
    message: "Enter the device ID (32-byte hex string):",
    validate: (value: string) => {
      const hexValue = value.startsWith("0x") ? value.slice(2) : value;

      if (hexValue.length !== 64)
        return "Device ID must be 64 hex characters (32 bytes)";
      if (!/^[0-9a-fA-F]{64}$/.test(hexValue))
        return "Device ID must be a valid hex string";
      return true;
    },
  });

  const deviceId = deviceResponse.deviceId.startsWith("0x")
    ? deviceResponse.deviceId
    : `0x${deviceResponse.deviceId}`;

  const reasonResponse = await prompts({
    type: "text",
    name: "reason",
    message: "Enter the reason for adding this device:",
    validate: (value: string) => {
      if (!value || value.trim() === "") return "Reason must not be empty";
      return true;
    },
  });

  const reason = reasonResponse.reason;

  console.log("\nOperation Parameters:");
  console.log("  Contract Address:", contractAddress);
  console.log("  Device ID:", deviceId);
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

  console.log("Adding device...");
  const tx = await contract.addDevice(deviceId, reason);
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait();
  console.log("Device added successfully!");

  const isAllowed = await contract.allowedDeviceIds(deviceId);
  console.log(`Verification - Device allowed: ${isAllowed}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
