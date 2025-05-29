// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script } from "forge-std/src/Script.sol";
import { console2 } from "forge-std/src/console2.sol";
import { KmsAuth } from "../src/KmsAuth.sol";
import { BaseScript } from "./Base.s.sol";

contract VerifyAppRegistration is BaseScript {
    function run() public view {
        // Get parameters from environment variables
        address kmsContract = vm.envAddress("KMS_CONTRACT_ADDRESS");
        address appId = vm.envAddress("APP_ID");

        console2.log("Verifying app registration:");
        console2.log("  KMS Contract:", kmsContract);
        console2.log("  App ID:", appId);

        // Check if app is registered
        KmsAuth kms = KmsAuth(kmsContract);
        (bool isRegistered, address controller) = kms.apps(appId);

        console2.log("  Is Registered:", isRegistered);
        console2.log("  Controller:", controller);

        if (isRegistered) {
            console2.log("[SUCCESS] App is successfully registered!");
        } else {
            console2.log("[ERROR] App is NOT registered!");
        }
    }
} 