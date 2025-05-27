// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script } from "forge-std/src/Script.sol";
import { console2 } from "forge-std/src/console2.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { CrossmintAppAuth } from "../src/CrossmintAppAuth.sol";
import { BaseScript } from "./Base.s.sol";

contract DeployCrossmintAppAuth is BaseScript {
    function run() public broadcast returns (address proxy, address implementation) {
        // Get deployment parameters from environment variables
        address initialAdmin = vm.envOr("INITIAL_ADMIN", broadcaster);
        address appId = vm.envAddress("APP_ID");
        bool disableUpgrades = vm.envOr("DISABLE_UPGRADES", false);
        bool allowAnyDevice = vm.envOr("ALLOW_ANY_DEVICE", true);

        console2.log("Deploying CrossmintAppAuth with parameters:");
        console2.log("  Deployer:", broadcaster);
        console2.log("  Initial Admin:", initialAdmin);
        console2.log("  App ID:", appId);
        console2.log("  Disable Upgrades:", disableUpgrades);
        console2.log("  Allow Any Device:", allowAnyDevice);

        // Deploy implementation
        implementation = address(new CrossmintAppAuth());
        console2.log("Implementation deployed at:", implementation);

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            CrossmintAppAuth.initialize.selector, initialAdmin, appId, disableUpgrades, allowAnyDevice
        );

        // Deploy proxy
        proxy = address(new ERC1967Proxy(implementation, initData));
        console2.log("Proxy deployed at:", proxy);

        // Optionally add a test compose hash if specified
        bytes32 testComposeHash = vm.envOr("TEST_COMPOSE_HASH", bytes32(0));
        if (testComposeHash != bytes32(0)) {
            string memory testTag;
            try vm.envString("TEST_COMPOSE_REASON") returns (string memory tag) {
                testTag = tag;
            } catch {
                testTag = "v0.1.0-test";
            }

            console2.log("Adding test compose hash:", vm.toString(testComposeHash));
            console2.log("With tag:", testTag);

            CrossmintAppAuth appAuth = CrossmintAppAuth(proxy);
            appAuth.addComposeHash(testComposeHash, testTag);

            console2.log("Test compose hash added successfully");
        }

        console2.log("Deployment completed successfully!");
        console2.log("Proxy address:", proxy);
        console2.log("Implementation address:", implementation);
    }
}
