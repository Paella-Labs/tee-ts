import { expect } from "chai";
import { ethers } from "hardhat";
import type { CrossmintAppAuth } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { deployContract } from "../scripts/deploy";
import hre from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";

describe("CrossmintAppAuth", () => {
  let appAuth: CrossmintAppAuth;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let appId: string;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    appId = ethers.Wallet.createRandom().address;
    appAuth = (await deployContract(
      hre,
      "CrossmintAppAuth",
      [owner.address, appId, false, true],
      true
    )) as CrossmintAppAuth;
  });

  describe("Basic functionality", () => {
    it("Should set the correct owner", async () => {
      expect(await appAuth.owner()).to.equal(owner.address);
    });

    it("Should set the correct app ID", async () => {
      expect(await appAuth.appId()).to.equal(appId);
    });
  });

  describe("Compose hash management", () => {
    const testHash = ethers.randomBytes(32);

    it("Should allow adding compose hash", async () => {
      await appAuth.addComposeHash(testHash);
      expect(await appAuth.allowedComposeHashes(testHash)).to.be.true;
    });

    it("Should allow removing compose hash", async () => {
      await appAuth.addComposeHash(testHash);
      await appAuth.removeComposeHash(testHash);
      expect(await appAuth.allowedComposeHashes(testHash)).to.be.false;
    });

    it("Should emit event when adding compose hash", async () => {
      await expect(appAuth.addComposeHash(testHash))
        .to.emit(appAuth, "ComposeHashAdded")
        .withArgs(testHash);
    });

    it("Should emit event when removing compose hash", async () => {
      await appAuth.addComposeHash(testHash);
      await expect(appAuth.removeComposeHash(testHash))
        .to.emit(appAuth, "ComposeHashRemoved")
        .withArgs(testHash);
    });
  });

  describe("isAppAllowed", () => {
    const composeHash = ethers.randomBytes(32);
    const deviceId = ethers.randomBytes(32);
    const mrAggregated = ethers.randomBytes(32);
    const mrImage = ethers.randomBytes(32);
    const mrSystem = ethers.randomBytes(32);
    const instanceId = ethers.Wallet.createRandom().address;

    beforeEach(async () => {
      await appAuth.addComposeHash(composeHash);
    });

    it("Should allow valid boot info", async () => {
      const bootInfo = {
        appId: appId,
        composeHash,
        instanceId,
        deviceId,
        mrAggregated,
        mrImage,
        mrSystem,
        tcbStatus: "UpToDate",
        advisoryIds: [],
      };

      const [isAllowed, reason] = await appAuth.isAppAllowed(bootInfo);
      expect(reason).to.equal("");
      expect(isAllowed).to.be.true;
    });

    it("Should reject invalid app ID", async () => {
      const bootInfo = {
        tcbStatus: "UpToDate",
        advisoryIds: [],
        appId: ethers.Wallet.createRandom().address,
        composeHash,
        instanceId,
        deviceId,
        mrAggregated,
        mrImage,
        mrSystem,
      };

      const [isAllowed, reason] = await appAuth.isAppAllowed(bootInfo);
      expect(isAllowed).to.be.false;
      expect(reason).to.equal("Wrong app controller");
    });

    it("Should reject unallowed compose hash", async () => {
      const bootInfo = {
        tcbStatus: "UpToDate",
        advisoryIds: [],
        appId: appId,
        composeHash: ethers.randomBytes(32),
        instanceId,
        deviceId,
        mrAggregated,
        mrImage,
        mrSystem,
      };

      const [isAllowed, reason] = await appAuth.isAppAllowed(bootInfo);
      expect(isAllowed).to.be.false;
      expect(reason).to.equal("Compose hash not allowed");
    });
  });

  describe("Access control", () => {
    const testHash = ethers.randomBytes(32);

    it("Should prevent non-owners from adding compose hash", async () => {
      await expect(
        appAuth.connect(user).addComposeHash(testHash)
      ).to.be.revertedWithCustomError(appAuth, "OwnableUnauthorizedAccount");
    });

    it("Should prevent non-owners from removing compose hash", async () => {
      await appAuth.addComposeHash(testHash);
      await expect(
        appAuth.connect(user).removeComposeHash(testHash)
      ).to.be.revertedWithCustomError(appAuth, "OwnableUnauthorizedAccount");
    });
  });
});
