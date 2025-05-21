import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy CrossmintAppAuth contract
  console.log(
    "Deploying CrossmintAppAuth (implementation contract) and UUPS Proxy..."
  );

  const CrossmintAppAuth = await ethers.getContractFactory("CrossmintAppAuth");

  // Parameters for initialization
  const initialOwner = deployer.address;
  const appId = "0x1234567890123456789012345678901234567890"; // Example app ID, replace with actual value
  const disableUpgrades = false; // Allow upgrades initially
  const allowAnyDevice = true; // Allow any device initially

  console.log("Initial parameters:");
  console.log("  Owner:", initialOwner);
  console.log("  App ID:", appId);
  console.log("  Disable Upgrades:", disableUpgrades);
  console.log("  Allow Any Device:", allowAnyDevice);

  const appAuthProxy = await upgrades.deployProxy(
    CrossmintAppAuth,
    [initialOwner, appId, disableUpgrades, allowAnyDevice],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );

  await appAuthProxy.waitForDeployment();

  const proxyAddress = await appAuthProxy.getAddress();
  console.log("CrossmintAppAuth UUPS Proxy deployed to:", proxyAddress);

  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );
  console.log(
    "CrossmintAppAuth Implementation contract deployed to:",
    implementationAddress
  );

  // Test adding a compose hash
  const testComposeHash = ethers.hexlify(ethers.randomBytes(32));
  console.log("Adding test compose hash:", testComposeHash);
  const tx = await appAuthProxy.addComposeHash(testComposeHash);
  await tx.wait();
  console.log("Compose hash added. Transaction hash:", tx.hash);

  // Test if the compose hash was added
  const isComposeHashAllowed = await appAuthProxy.allowedComposeHashes(
    testComposeHash
  );
  console.log("Is compose hash allowed:", isComposeHashAllowed);

  console.log(
    "\nTo verify on Basescan (replace with your proxy and implementation addresses):"
  );
  console.log(
    `npx hardhat verify --network ${hre.network.name} ${proxyAddress}`
  );
  console.log(
    `npx hardhat verify --network ${hre.network.name} ${implementationAddress}`
  );
  console.log(
    "\nNote: For proxy verification, verify the implementation first, then the proxy. Basescan might automatically detect it as a proxy."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
