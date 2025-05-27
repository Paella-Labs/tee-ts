// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script } from "forge-std/src/Script.sol";
import { console2 } from "forge-std/src/console2.sol";
import { CrossmintAppAuth } from "../src/CrossmintAppAuth.sol";
import { BaseScript } from "./Base.s.sol";

contract AddComposeHash is BaseScript {
    function run() public broadcast {
        // Get parameters from environment variables
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        bytes32 composeHash = vm.envBytes32("COMPOSE_HASH");
        string memory tag = vm.envString("TAG");

        console2.log("Adding compose hash to CrossmintAppAuth:");
        console2.log("  Proxy Address:", proxyAddress);
        console2.log("  Compose Hash:", vm.toString(composeHash));
        console2.log("  Tag:", tag);
        console2.log("  Caller:", broadcaster);

        CrossmintAppAuth appAuth = CrossmintAppAuth(proxyAddress);

        // Check if caller has the required role
        bytes32 managerRole = appAuth.MANAGER_ROLE();
        require(appAuth.hasRole(managerRole, broadcaster), "Caller does not have MANAGER_ROLE");

        // Add the compose hash
        appAuth.addComposeHash(composeHash, tag);

        // Verify it was added
        bool isAllowed = appAuth.allowedComposeHashes(composeHash);
        require(isAllowed, "Failed to add compose hash");

        console2.log("Compose hash added successfully!");
    }
}
