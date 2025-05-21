import { ethers, upgrades } from "hardhat";
import hre from "hardhat";
import prompts from "prompts";

const EXPECTED_DEPLOYER = "0xcD3c7E442C5012dC2aB2E8794708809a2883E290";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  if (deployer.address.toLowerCase() !== EXPECTED_DEPLOYER.toLowerCase()) {
    console.warn(
      `WARNING: Deployer address (${deployer.address}) does not match expected address (${EXPECTED_DEPLOYER})`
    );
  }

  console.log(
    "Deploying CrossmintAppAuth (implementation contract) and UUPS Proxy..."
  );

  const CrossmintAppAuth = await ethers.getContractFactory("CrossmintAppAuth");

  const initialOwner = deployer.address;

  const appIdResponse = await prompts({
    type: "text",
    name: "appId",
    message: "Enter the App ID (hex string, 40 characters):",
    validate: (value: string) => {
      // Remove 0x prefix if present to validate the raw hex string
      const hexValue = value.startsWith("0x") ? value.slice(2) : value;

      if (hexValue.length !== 40) return "App ID must be 40 hex characters";
      if (!/^[0-9a-fA-F]{40}$/.test(hexValue))
        return "App ID must be a valid hex string";
      return true;
    },
    initial: "1234567890123456789012345678901234567890",
  });

  // Ensure the appId has a 0x prefix for contract compatibility
  const appId = appIdResponse.appId.startsWith("0x")
    ? appIdResponse.appId
    : `0x${appIdResponse.appId}`;
  const disableUpgrades = false;
  const allowAnyDevice = true;

  console.log("\nDeployment Parameters:");
  console.log("  Deployer:", deployer.address);
  console.log("  Owner:", initialOwner);
  console.log("  App ID:", appId);
  console.log("  Disable Upgrades:", disableUpgrades);
  console.log("  Allow Any Device:", allowAnyDevice);

  const confirmResponse = await prompts({
    type: "confirm",
    name: "confirmed",
    message: "Confirm these parameters and proceed with deployment?",
    initial: false,
  });

  if (!confirmResponse.confirmed) {
    console.log("Deployment cancelled by user.");
    return;
  }

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

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );
  console.log(
    "CrossmintAppAuth Implementation contract deployed to:",
    implementationAddress
  );

  const testComposeHash = ethers.hexlify(ethers.randomBytes(32));
  const testReason = "Initial test compose hash for development";
  console.log("Adding test compose hash:", testComposeHash);
  console.log("With reason:", testReason);
  const tx = await appAuthProxy.addComposeHash(testComposeHash, testReason);
  await tx.wait();
  console.log("Compose hash added. Transaction hash:", tx.hash);

  const isComposeHashAllowed = await appAuthProxy.allowedComposeHashes(
    testComposeHash
  );
  console.log("Is compose hash allowed:", isComposeHashAllowed);

  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations before verification...");
    await appAuthProxy.deploymentTransaction()?.wait(5);

    console.log(
      `\nVerifying implementation contract at ${implementationAddress}...`
    );
    try {
      await hre.run("verify:verify", {
        address: implementationAddress,
        constructorArguments: [],
      });
      console.log("Implementation contract verification complete!");
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("Already Verified") ||
          error.message.includes("already been verified"))
      ) {
        console.log("Implementation contract already verified!");
      } else {
        console.error("Error verifying implementation contract:", error);
      }
    }

    console.log(`\nVerifying proxy contract at ${proxyAddress}...`);
    try {
      await hre.run("verify:verify", {
        address: proxyAddress,
        constructorArguments: [],
      });
      console.log("Proxy contract verification complete!");
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("Already Verified") ||
          error.message.includes("already been verified"))
      ) {
        console.log("Proxy contract already verified!");
      } else {
        console.error("Error verifying proxy contract:", error);
      }
    }
  } else {
    console.log("\nSkipping verification on local network.");
    console.log(
      "\nTo verify on Basescan (replace with your proxy and implementation addresses):"
    );
    console.log(
      `npx hardhat verify --network ${hre.network.name} ${proxyAddress}`
    );
    console.log(
      `npx hardhat verify --network ${hre.network.name} ${implementationAddress}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
