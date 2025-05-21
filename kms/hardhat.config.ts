import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

const {
  BASE_SEPOLIA_RPC_URL,
  BASE_MAINNET_RPC_URL,
  PRIVATE_KEY,
  ETHERSCAN_API_KEY,
} = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
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
      // Specific Hardhat network configurations can go here
    },
    // Only include these networks when PRIVATE_KEY is properly set
    ...(PRIVATE_KEY && PRIVATE_KEY.length >= 64
      ? {
          baseSepolia: {
            url: BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org", // Fallback public RPC
            accounts: [
              PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`,
            ],
            chainId: 84532,
          },
          baseMainnet: {
            url: BASE_MAINNET_RPC_URL || "https://mainnet.base.org", // Fallback public RPC
            accounts: [
              PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`,
            ],
            chainId: 8453,
          },
        }
      : {}),
  },
  etherscan: {
    apiKey: {
      base: ETHERSCAN_API_KEY || "", // For Base Mainnet
      baseSepolia: ETHERSCAN_API_KEY || "", // For Base Sepolia
    },
    customChains: [
      // Required for Base verification if not natively supported by Hardhat Etherscan plugin yet
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "baseMainnet",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
  sourcify: {
    // Optional: for Sourcify verification
    enabled: true,
  },
};

export default config;
