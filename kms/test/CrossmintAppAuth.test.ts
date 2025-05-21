import { ethers, upgrades } from "hardhat";
import { expect } from "chai";

describe("CrossmintAppAuth", () => {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let crossmintAppAuth: any;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let owner: any;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let user: any;
  let appId: string;

  beforeEach(async () => {
    // Get signers
    [owner, user] = await ethers.getSigners();

    // Mock app ID (using a random address)
    appId = "0x1234567890123456789012345678901234567890";

    // Deploy the contract through the proxy
    const CrossmintAppAuthFactory = await ethers.getContractFactory(
      "CrossmintAppAuth"
    );
    crossmintAppAuth = await upgrades.deployProxy(
      CrossmintAppAuthFactory,
      [owner.address, appId, false, true], // owner, appId, disableUpgrades, allowAnyDevice
      { kind: "uups" }
    );

    await crossmintAppAuth.waitForDeployment();
  });

  describe("Initialization", () => {
    it("should initialize with correct values", async () => {
      expect(await crossmintAppAuth.appId()).to.equal(appId);
      expect(await crossmintAppAuth.allowAnyDevice()).to.equal(true);
      expect(await crossmintAppAuth.owner()).to.equal(owner.address);
    });

    it("should not be able to re-initialize", async () => {
      await expect(
        crossmintAppAuth.initialize(user.address, user.address, true, false)
      ).to.be.rejected;
    });
  });

  describe("Manage Compose Hashes", () => {
    const testComposeHash = ethers.id("testComposeHash");
    const testReason = "Test reason for compose hash";

    it("should allow owner to add a compose hash with reason", async () => {
      const tx = await crossmintAppAuth.addComposeHash(
        testComposeHash,
        testReason
      );
      await tx.wait();

      // Check if compose hash is allowed
      expect(
        await crossmintAppAuth.allowedComposeHashes(testComposeHash)
      ).to.equal(true);
    });

    it("should not allow adding compose hash without reason", async () => {
      await expect(
        crossmintAppAuth.addComposeHash(testComposeHash, "")
      ).to.be.rejectedWith("Reason must be provided");
    });

    it("should not allow non-owner to add a compose hash", async () => {
      await expect(
        crossmintAppAuth
          .connect(user)
          .addComposeHash(testComposeHash, testReason)
      ).to.be.rejected;
    });

    it("should allow owner to remove a compose hash", async () => {
      // First add the compose hash
      await (
        await crossmintAppAuth.addComposeHash(testComposeHash, testReason)
      ).wait();
      expect(
        await crossmintAppAuth.allowedComposeHashes(testComposeHash)
      ).to.equal(true);

      // Then remove it
      const tx = await crossmintAppAuth.removeComposeHash(testComposeHash);
      await tx.wait();

      // Check if compose hash is no longer allowed
      expect(
        await crossmintAppAuth.allowedComposeHashes(testComposeHash)
      ).to.equal(false);
    });

    it("should not allow non-owner to remove a compose hash", async () => {
      await (
        await crossmintAppAuth.addComposeHash(testComposeHash, testReason)
      ).wait();
      await expect(
        crossmintAppAuth.connect(user).removeComposeHash(testComposeHash)
      ).to.be.rejected;
    });
  });

  describe("Manage Devices", () => {
    const testDeviceId = ethers.id("testDeviceId");
    const testReason = "Test reason for device";

    beforeEach(async () => {
      // Set allowAnyDevice to false for device testing
      await (await crossmintAppAuth.setAllowAnyDevice(false)).wait();
    });

    it("should allow owner to add a device with reason", async () => {
      const tx = await crossmintAppAuth.addDevice(testDeviceId, testReason);
      await tx.wait();

      // Check if device is allowed
      expect(await crossmintAppAuth.allowedDeviceIds(testDeviceId)).to.equal(
        true
      );
    });

    it("should not allow adding device without reason", async () => {
      await expect(
        crossmintAppAuth.addDevice(testDeviceId, "")
      ).to.be.rejectedWith("Reason must be provided");
    });

    it("should not allow non-owner to add a device", async () => {
      await expect(
        crossmintAppAuth.connect(user).addDevice(testDeviceId, testReason)
      ).to.be.rejected;
    });

    it("should allow owner to remove a device", async () => {
      // First add the device
      await (await crossmintAppAuth.addDevice(testDeviceId, testReason)).wait();
      expect(await crossmintAppAuth.allowedDeviceIds(testDeviceId)).to.equal(
        true
      );

      // Then remove it
      const tx = await crossmintAppAuth.removeDevice(testDeviceId);
      await tx.wait();

      // Check if device is no longer allowed
      expect(await crossmintAppAuth.allowedDeviceIds(testDeviceId)).to.equal(
        false
      );
    });

    it("should not allow non-owner to remove a device", async () => {
      await (await crossmintAppAuth.addDevice(testDeviceId, testReason)).wait();
      await expect(crossmintAppAuth.connect(user).removeDevice(testDeviceId)).to
        .be.rejected;
    });

    it("should allow owner to set allowAnyDevice", async () => {
      const tx = await crossmintAppAuth.setAllowAnyDevice(true);
      await tx.wait();

      expect(await crossmintAppAuth.allowAnyDevice()).to.equal(true);
    });

    it("should not allow non-owner to set allowAnyDevice", async () => {
      await expect(crossmintAppAuth.connect(user).setAllowAnyDevice(true)).to.be
        .rejected;
    });
  });

  describe("App Boot Authorization", () => {
    const testComposeHash = ethers.id("testComposeHash");
    const testComposeHashReason = "Test reason for compose hash";
    const testDeviceId = ethers.id("testDeviceId");
    const testDeviceReason = "Test reason for device";
    const wrongComposeHash = ethers.id("wrongComposeHash");
    const wrongDeviceId = ethers.id("wrongDeviceId");

    beforeEach(async () => {
      // Add allowed compose hash and device
      await (
        await crossmintAppAuth.addComposeHash(
          testComposeHash,
          testComposeHashReason
        )
      ).wait();
      await (
        await crossmintAppAuth.addDevice(testDeviceId, testDeviceReason)
      ).wait();
    });

    it("should allow app with correct appId, compose hash when allowAnyDevice is true", async () => {
      // Set allowAnyDevice to true
      await (await crossmintAppAuth.setAllowAnyDevice(true)).wait();

      const bootInfo = {
        appId: appId,
        composeHash: testComposeHash,
        instanceId: ethers.ZeroAddress,
        deviceId: wrongDeviceId, // Device ID doesn't matter when allowAnyDevice is true
        mrAggregated: ethers.ZeroHash,
        mrSystem: ethers.ZeroHash,
        mrImage: ethers.ZeroHash,
        tcbStatus: "",
        advisoryIds: [],
      };

      const [isAllowed, reason] = await crossmintAppAuth.isAppAllowed(bootInfo);
      expect(isAllowed).to.equal(true);
      expect(reason).to.equal("");
    });

    it("should allow app with correct appId, compose hash, and device when allowAnyDevice is false", async () => {
      // Set allowAnyDevice to false
      await (await crossmintAppAuth.setAllowAnyDevice(false)).wait();

      const bootInfo = {
        appId: appId,
        composeHash: testComposeHash,
        instanceId: ethers.ZeroAddress,
        deviceId: testDeviceId,
        mrAggregated: ethers.ZeroHash,
        mrSystem: ethers.ZeroHash,
        mrImage: ethers.ZeroHash,
        tcbStatus: "",
        advisoryIds: [],
      };

      const [isAllowed, reason] = await crossmintAppAuth.isAppAllowed(bootInfo);
      expect(isAllowed).to.equal(true);
      expect(reason).to.equal("");
    });

    it("should not allow app with wrong appId", async () => {
      const bootInfo = {
        appId: user.address, // Wrong app ID
        composeHash: testComposeHash,
        instanceId: ethers.ZeroAddress,
        deviceId: testDeviceId,
        mrAggregated: ethers.ZeroHash,
        mrSystem: ethers.ZeroHash,
        mrImage: ethers.ZeroHash,
        tcbStatus: "",
        advisoryIds: [],
      };

      const [isAllowed, reason] = await crossmintAppAuth.isAppAllowed(bootInfo);
      expect(isAllowed).to.equal(false);
      expect(reason).to.equal("Wrong app controller");
    });

    it("should not allow app with wrong compose hash", async () => {
      const bootInfo = {
        appId: appId,
        composeHash: wrongComposeHash, // Wrong compose hash
        instanceId: ethers.ZeroAddress,
        deviceId: testDeviceId,
        mrAggregated: ethers.ZeroHash,
        mrSystem: ethers.ZeroHash,
        mrImage: ethers.ZeroHash,
        tcbStatus: "",
        advisoryIds: [],
      };

      const [isAllowed, reason] = await crossmintAppAuth.isAppAllowed(bootInfo);
      expect(isAllowed).to.equal(false);
      expect(reason).to.equal("Compose hash not allowed");
    });

    it("should not allow app with wrong device when allowAnyDevice is false", async () => {
      // Set allowAnyDevice to false
      await (await crossmintAppAuth.setAllowAnyDevice(false)).wait();

      const bootInfo = {
        appId: appId,
        composeHash: testComposeHash,
        instanceId: ethers.ZeroAddress,
        deviceId: wrongDeviceId, // Wrong device ID
        mrAggregated: ethers.ZeroHash,
        mrSystem: ethers.ZeroHash,
        mrImage: ethers.ZeroHash,
        tcbStatus: "",
        advisoryIds: [],
      };

      const [isAllowed, reason] = await crossmintAppAuth.isAppAllowed(bootInfo);
      expect(isAllowed).to.equal(false);
      expect(reason).to.equal("Device not allowed");
    });
  });

  describe("Upgrade Management", () => {
    it("should allow owner to disable upgrades", async () => {
      const tx = await crossmintAppAuth.disableUpgrades();
      await tx.wait();

      // Create a new implementation
      const CrossmintAppAuthV2 = await ethers.getContractFactory(
        "CrossmintAppAuth"
      );

      // Attempt to upgrade should fail
      await expect(
        upgrades.upgradeProxy(
          await crossmintAppAuth.getAddress(),
          CrossmintAppAuthV2
        )
      ).to.be.rejected;
    });

    it("should not allow non-owner to disable upgrades", async () => {
      await expect(crossmintAppAuth.connect(user).disableUpgrades()).to.be
        .rejected;
    });

    it("should be upgradeable when upgrades are not disabled", async () => {
      // Create a new implementation
      const CrossmintAppAuthV2 = await ethers.getContractFactory(
        "CrossmintAppAuth"
      );

      // Upgrade should succeed
      const upgraded = await upgrades.upgradeProxy(
        await crossmintAppAuth.getAddress(),
        CrossmintAppAuthV2
      );

      expect(await upgraded.getAddress()).to.equal(
        await crossmintAppAuth.getAddress()
      );
    });
  });
});
