import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const initialValue = 123n;
  console.log("Initial value:", initialValue.toString());

  // Deploy Box contract
  console.log("Deploying Box (implementation contract) and UUPS Proxy...");

  const Box = await ethers.getContractFactory("Box");
  const boxProxy = await upgrades.deployProxy(Box, [initialValue], {
    kind: "uups",
    initializer: "initialize",
  });

  await boxProxy.waitForDeployment();

  const proxyAddress = await boxProxy.getAddress();
  console.log("Box UUPS Proxy deployed to:", proxyAddress);

  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );
  console.log(
    "Box Implementation contract deployed to:",
    implementationAddress
  );

  // Read the initial value
  const initialStoredValue = await boxProxy.retrieve();
  console.log(
    "Value retrieved from proxy (Box V1):",
    initialStoredValue.toString()
  );

  // Store a new value
  console.log("Storing new value 456...");
  const tx = await boxProxy.store(456);
  await tx.wait();
  console.log("Value stored. Transaction hash:", tx.hash);

  // Read the new value
  const updatedValue = await boxProxy.retrieve();
  console.log(
    "New value stored and retrieved from proxy (Box V1):",
    updatedValue.toString()
  );

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
