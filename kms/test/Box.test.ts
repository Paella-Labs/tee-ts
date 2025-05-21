import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("Box (UUPS Proxy)", function () {
  it("Should deploy and upgrade correctly", async function () {
    // Deploy Box
    const Box = await ethers.getContractFactory("Box");
    const boxProxy = await upgrades.deployProxy(Box, [42], {
      kind: "uups",
      initializer: "initialize",
    });
    await boxProxy.waitForDeployment();
    const proxyAddress = await boxProxy.getAddress();
    console.log("Box proxy deployed to:", proxyAddress);

    // Check initial value
    const initialValue = await boxProxy.retrieve();
    expect(initialValue).to.equal(42n);

    // Store a new value
    await boxProxy.store(100);
    const updatedValue = await boxProxy.retrieve();
    expect(updatedValue).to.equal(100n);

    // Upgrade to BoxV2
    const BoxV2 = await ethers.getContractFactory("BoxV2");
    const upgraded = await upgrades.upgradeProxy(proxyAddress, BoxV2, {
      kind: "uups",
      call: { fn: "initializeV2" },
    });

    // Check state is preserved
    const valueAfterUpgrade = await upgraded.retrieve();
    expect(valueAfterUpgrade).to.equal(100n);

    // Call new V2 function
    await upgraded.increment();
    const incrementedValue = await upgraded.retrieve();
    expect(incrementedValue).to.equal(101n);

    console.log("Test passed - Box upgraded to BoxV2");
  });
});
