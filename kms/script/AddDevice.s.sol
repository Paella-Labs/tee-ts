// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script } from "forge-std/src/Script.sol";
import { console2 } from "forge-std/src/console2.sol";
import { CrossmintAppAuth } from "../src/CrossmintAppAuth.sol";
import { BaseScript } from "./Base.s.sol";

contract AddDevice is BaseScript {
    function run() public broadcast {
        // Get parameters from environment variables
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        bytes32 deviceId = vm.envBytes32("DEVICE_ID");

        console2.log("Adding device to CrossmintAppAuth:");
        console2.log("  Proxy Address:", proxyAddress);
        console2.log("  Device ID:", vm.toString(deviceId));
        console2.log("  Caller:", broadcaster);

        CrossmintAppAuth appAuth = CrossmintAppAuth(proxyAddress);

        // Check if caller has the required role
        bytes32 managerRole = appAuth.MANAGER_ROLE();
        require(appAuth.hasRole(managerRole, broadcaster), "Caller does not have MANAGER_ROLE");

        // Add the device
        appAuth.addDevice(deviceId);

        // Verify it was added
        bool isAllowed = appAuth.allowedDeviceIds(deviceId);
        require(isAllowed, "Failed to add device");

        console2.log("Device added successfully!");
    }
}
