// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script } from "forge-std/src/Script.sol";
import { console2 } from "forge-std/src/console2.sol";
import { CrossmintAppAuth } from "../src/CrossmintAppAuth.sol";
import { BaseScript } from "./Base.s.sol";

contract UpgradeCrossmintAppAuth is BaseScript {
    function run() public broadcast {
        // Get parameters from environment variables
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        console2.log("Upgrading CrossmintAppAuth:");
        console2.log("  Proxy Address:", proxyAddress);
        console2.log("  Caller:", broadcaster);

        CrossmintAppAuth appAuth = CrossmintAppAuth(proxyAddress);

        // Check if caller has the required role
        bytes32 upgraderRole = appAuth.UPGRADER_ROLE();
        require(appAuth.hasRole(upgraderRole, broadcaster), "Caller does not have UPGRADER_ROLE");

        // Deploy new implementation
        CrossmintAppAuth newImplementation = new CrossmintAppAuth();
        console2.log("New implementation deployed at:", address(newImplementation));

        // Upgrade the proxy
        appAuth.upgradeToAndCall(address(newImplementation), "");

        console2.log("Upgrade completed successfully!");
        console2.log("Proxy address:", proxyAddress);
        console2.log("New implementation address:", address(newImplementation));
    }
}
