import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

// --- CONFIGURATION ---
// Update this with the address from the deployment script
const PROXY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

async function main() {
  if (!PROXY_ADDRESS || !PROXY_ADDRESS.startsWith("0x")) {
    console.error(
      "Error: PROXY_ADDRESS is not set correctly in scripts/upgrade.ts. Please set it to the deployed proxy address."
    );
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading contracts with the account:", deployer.address);
  console.log("Proxy address (Box V1):", PROXY_ADDRESS);

  // Get the current implementation address
  const currentImplAddress = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS
  );
  console.log("Current implementation address:", currentImplAddress);

  // Get the current value before upgrade
  const Box = await ethers.getContractFactory("Box");
  const box = Box.attach(PROXY_ADDRESS);
  const currentValue = await box.retrieve();
  console.log("Current value before upgrade:", currentValue.toString());

  // Prepare the V2 implementation
  const BoxV2 = await ethers.getContractFactory("BoxV2");
  console.log("\nPreparing to upgrade to BoxV2...");

  // Upgrade to BoxV2
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, BoxV2, {
    kind: "uups",
    call: { fn: "initializeV2" },
  });

  await upgraded.waitForDeployment();
  const upgradedAddress = await upgraded.getAddress();
  console.log("BoxV2 proxy address (should be the same):", upgradedAddress);

  // Get the new implementation address
  const newImplAddress = await upgrades.erc1967.getImplementationAddress(
    upgradedAddress
  );
  console.log("BoxV2 implementation deployed to:", newImplAddress);

  // Test that the value is preserved
  const valueAfterUpgrade = await upgraded.retrieve();
  console.log(
    "Value after upgrade (should be preserved):",
    valueAfterUpgrade.toString()
  );

  // Test the new increment function
  console.log("\nTesting new BoxV2 functionality...");
  console.log("Incrementing value...");
  const tx = await upgraded.increment();
  await tx.wait();
  console.log("Value incremented. Transaction hash:", tx.hash);

  const incrementedValue = await upgraded.retrieve();
  console.log("Value after increment:", incrementedValue.toString());

  // Store a new value
  console.log("Storing new value 789...");
  const storeTx = await upgraded.store(789);
  await storeTx.wait();
  console.log("Value stored. Transaction hash:", storeTx.hash);

  const finalValue = await upgraded.retrieve();
  console.log("Final value after update:", finalValue.toString());

  console.log("\nUpgrade to BoxV2 complete!");
  console.log("To verify the new implementation on Basescan:");
  console.log(
    `npx hardhat verify --network ${hre.network.name} ${newImplAddress}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
