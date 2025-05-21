import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

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
  console.log("Proxy address (CrossmintAppAuth):", PROXY_ADDRESS);

  const currentImplAddress = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS
  );
  console.log("Current implementation address:", currentImplAddress);

  const CrossmintAppAuth = await ethers.getContractFactory("CrossmintAppAuth");
  const appAuth = CrossmintAppAuth.attach(PROXY_ADDRESS);
  const appId = await appAuth.appId();
  const allowAnyDevice = await appAuth.allowAnyDevice();
  console.log("Current state before upgrade:");
  console.log("  App ID:", appId);
  console.log("  Allow Any Device:", allowAnyDevice);

  const testComposeHash = ethers.hexlify(ethers.randomBytes(32));
  const testReason = "Test compose hash added during upgrade process";
  console.log("Adding test compose hash:", testComposeHash);
  console.log("With reason:", testReason);
  const tx = await appAuth.addComposeHash(testComposeHash, testReason);
  await tx.wait();
  console.log("Compose hash added. Transaction hash:", tx.hash);

  const isComposeHashAllowed = await appAuth.allowedComposeHashes(
    testComposeHash
  );
  console.log("Is test compose hash allowed:", isComposeHashAllowed);

  console.log("\nUpgrading to new implementation...");
  const upgradedAppAuth = await upgrades.upgradeProxy(
    PROXY_ADDRESS,
    CrossmintAppAuth
  );
  await upgradedAppAuth.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS
  );
  console.log("New implementation address:", newImplAddress);

  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations before verification...");
    await tx.wait(5);

    console.log(
      `\nVerifying new implementation contract at ${newImplAddress}...`
    );
    try {
      await hre.run("verify:verify", {
        address: newImplAddress,
        constructorArguments: [],
      });
      console.log("New implementation contract verification complete!");
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("Already Verified") ||
          error.message.includes("already been verified"))
      ) {
        console.log("New implementation contract already verified!");
      } else {
        console.error("Error verifying new implementation contract:", error);
      }
    }
  } else {
    console.log("\nSkipping verification on local network.");
    console.log("\nTo verify on Basescan:");
    console.log(
      `npx hardhat verify --network ${hre.network.name} ${newImplAddress}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
