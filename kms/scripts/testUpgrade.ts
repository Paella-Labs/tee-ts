import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);

  // Deploy Box
  console.log("Deploying Box...");
  const Box = await ethers.getContractFactory("Box");
  const box = await upgrades.deployProxy(Box, [42], {
    kind: "uups",
    initializer: "initialize",
  });
  await box.waitForDeployment();

  const boxAddress = await box.getAddress();
  console.log("Box proxy deployed to:", boxAddress);

  const implAddress = await upgrades.erc1967.getImplementationAddress(
    boxAddress
  );
  console.log("Box implementation deployed to:", implAddress);

  // Test initial functionality
  const value = await box.retrieve();
  console.log("Box value:", value.toString());

  // Upgrade to BoxV2
  console.log("\nUpgrading to BoxV2...");
  const BoxV2 = await ethers.getContractFactory("BoxV2");
  const boxV2 = await upgrades.upgradeProxy(boxAddress, BoxV2, {
    kind: "uups",
    call: { fn: "initializeV2" },
  });

  const boxV2Address = await boxV2.getAddress();
  console.log("BoxV2 proxy address (should be the same):", boxV2Address);

  const implV2Address = await upgrades.erc1967.getImplementationAddress(
    boxV2Address
  );
  console.log("BoxV2 implementation deployed to:", implV2Address);

  // Test V2 functionality
  const valueAfterUpgrade = await boxV2.retrieve();
  console.log(
    "Value after upgrade (should be preserved):",
    valueAfterUpgrade.toString()
  );

  // Test new increment function
  await boxV2.increment();
  const incrementedValue = await boxV2.retrieve();
  console.log("Value after increment:", incrementedValue.toString());

  console.log("\nUpgrade successful!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
