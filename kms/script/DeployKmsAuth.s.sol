// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script } from "forge-std/src/Script.sol";
import { console2 } from "forge-std/src/console2.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { KmsAuth } from "../src/KmsAuth.sol";
import { BaseScript } from "./Base.s.sol";

contract DeployKmsAuth is BaseScript {
    function run() public broadcast returns (address proxy, address implementation) {
        // Get deployment parameters from environment variables
        address initialOwner = vm.envOr("INITIAL_OWNER", broadcaster);

        console2.log("Deploying KmsAuth with parameters:");
        console2.log("  Deployer:", broadcaster);
        console2.log("  Initial Owner:", initialOwner);

        // Deploy implementation
        implementation = address(new KmsAuth());
        console2.log("Implementation deployed at:", implementation);

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            KmsAuth.initialize.selector, initialOwner
        );

        // Deploy proxy
        proxy = address(new ERC1967Proxy(implementation, initData));
        console2.log("Proxy deployed at:", proxy);

        console2.log("KmsAuth deployment completed successfully!");
        console2.log("Proxy address:", proxy);
        console2.log("Implementation address:", implementation);
    }
} 