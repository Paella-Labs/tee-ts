import "dotenv/config";
import "@openzeppelin/hardhat-upgrades";
import { type HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";
import { deployContract } from "./scripts/deploy";
import { accountBalance } from "./lib/deployment-helpers";
import { getKmsAuth, waitForTx } from "./hardhat-utils";

const PRIVATE_KEY = (() => {
  if (process.env.PRIVATE_KEY == null) {
    throw new Error("PRIVATE_KEY is not set");
  }
  if (process.env.PRIVATE_KEY.length === 0) {
    throw new Error("PRIVATE_KEY is empty");
  }
  if (!process.env.PRIVATE_KEY.startsWith("0x")) {
    throw new Error("PRIVATE_KEY is not prefixed with 0x");
  }
  return process.env.PRIVATE_KEY as string;
})();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337,
    },
    phala: {
      url: "https://rpc.phala.network",
      accounts: [PRIVATE_KEY],
    },
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/demo",
      accounts: [PRIVATE_KEY],
    },
    test: {
      url: "http://127.0.0.1:8545/",
      accounts: [PRIVATE_KEY],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: {
      phala: "empty",
      default: process.env.ETHERSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "phala",
        chainId: 2035,
        urls: {
          apiURL: "https://explorer-phala-mainnet-0.t.conduit.xyz/api",
          browserURL: "https://explorer-phala-mainnet-0.t.conduit.xyz:443",
        },
      },
    ],
  },
};

task("app:deploy", "Deploy AppAuth with a UUPS proxy")
  .addFlag("allowAnyDevice", "Allow any device to boot this app")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log("Deploying with account:", deployerAddress);
    console.log(
      "Account balance:",
      await accountBalance(ethers, deployerAddress)
    );

    const kmsContract = await getKmsAuth(ethers);
    const appId = await kmsContract.nextAppId();
    console.log("App ID:", appId);
    const appAuth = await deployContract(hre, "CrossmintAppAuth", [
      deployerAddress,
      appId,
      false,
      taskArgs.allowAnyDevice,
    ]);
    if (!appAuth) {
      return;
    }
    const proxyAddress = await appAuth.getAddress();
    const tx = await kmsContract.registerApp(proxyAddress);
    const receipt = await waitForTx(tx);
    // Parse the AppRegistered event from the logs
    const appRegisteredEvent = receipt.logs
      // biome-ignore lint/suspicious/noExplicitAny:
      .filter((log: any) => log.fragment?.name === "AppRegistered")
      // biome-ignore lint/suspicious/noExplicitAny:
      .map((log: any) => {
        const { appId } = log.args;
        return { appId };
      })[0];

    if (appRegisteredEvent) {
      console.log("App registered in KMS successfully");
      console.log("Registered AppId:", appRegisteredEvent.appId);
    } else {
      console.log("App registered in KMS successfully (event not found)");
    }
  });

export default config;
