// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Test } from "forge-std/src/Test.sol";
import { console2 } from "forge-std/src/console2.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { CrossmintAppAuth } from "../src/CrossmintAppAuth.sol";
import { IAppAuth } from "../src/IAppAuth.sol";

contract CrossmintAppAuthTest is Test {
    CrossmintAppAuth public appAuth;
    CrossmintAppAuth public implementation;

    address public admin = makeAddr("admin");
    address public manager = makeAddr("manager");
    address public upgrader = makeAddr("upgrader");
    address public user = makeAddr("user");
    address public appId = makeAddr("appId");

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    bytes32 public testComposeHash = keccak256("test-compose-hash");
    bytes32 public testDeviceId = keccak256("test-device-id");

    event ComposeHashAdded(bytes32 composeHash, string reason);
    event ComposeHashRemoved(bytes32 composeHash);
    event UpgradesDisabled();
    event DeviceAdded(bytes32 deviceId);
    event DeviceRemoved(bytes32 deviceId);
    event AllowAnyDeviceSet(bool allowAny);

    function setUp() public {
        // Deploy implementation
        implementation = new CrossmintAppAuth();

        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(
            CrossmintAppAuth.initialize.selector,
            admin,
            appId,
            false, // don't disable upgrades
            true // allow any device
        );

        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        appAuth = CrossmintAppAuth(address(proxy));

        // Grant roles
        vm.startPrank(admin);
        appAuth.grantRole(MANAGER_ROLE, manager);
        appAuth.grantRole(UPGRADER_ROLE, upgrader);
        vm.stopPrank();
    }

    function test_Initialize() public {
        assertEq(appAuth.appId(), appId);
        assertTrue(appAuth.allowAnyDevice());
        assertTrue(appAuth.hasRole(appAuth.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(appAuth.hasRole(MANAGER_ROLE, admin));
        assertTrue(appAuth.hasRole(UPGRADER_ROLE, admin));
        assertTrue(appAuth.hasRole(MANAGER_ROLE, manager));
        assertTrue(appAuth.hasRole(UPGRADER_ROLE, upgrader));
    }

    function test_Initialize_RevertWhen_InvalidAdmin() public {
        CrossmintAppAuth newImplementation = new CrossmintAppAuth();

        bytes memory initData = abi.encodeWithSelector(
            CrossmintAppAuth.initialize.selector,
            address(0), // invalid admin
            appId,
            false,
            true
        );

        vm.expectRevert("Invalid admin address");
        new ERC1967Proxy(address(newImplementation), initData);
    }

    function test_Initialize_RevertWhen_InvalidAppId() public {
        CrossmintAppAuth newImplementation = new CrossmintAppAuth();

        bytes memory initData = abi.encodeWithSelector(
            CrossmintAppAuth.initialize.selector,
            admin,
            address(0), // invalid app ID
            false,
            true
        );

        vm.expectRevert("Invalid app ID");
        new ERC1967Proxy(address(newImplementation), initData);
    }

    function test_AddComposeHash() public {
        vm.prank(manager);
        vm.expectEmit(true, false, false, true);
        emit ComposeHashAdded(testComposeHash, "v1.0.0");

        appAuth.addComposeHash(testComposeHash, "v1.0.0");

        assertTrue(appAuth.allowedComposeHashes(testComposeHash));
    }

    function test_AddComposeHash_RevertWhen_NotManager() public {
        vm.prank(user);
        vm.expectRevert();
        appAuth.addComposeHash(testComposeHash, "v1.0.0");
    }

    function test_AddComposeHash_RevertWhen_EmptyTag() public {
        vm.prank(manager);
        vm.expectRevert("Tag must be provided");
        appAuth.addComposeHash(testComposeHash, "");
    }

    function test_RemoveComposeHash() public {
        // First add a compose hash
        vm.prank(manager);
        appAuth.addComposeHash(testComposeHash, "v1.0.0");
        assertTrue(appAuth.allowedComposeHashes(testComposeHash));

        // Then remove it
        vm.prank(manager);
        vm.expectEmit(true, false, false, false);
        emit ComposeHashRemoved(testComposeHash);

        appAuth.removeComposeHash(testComposeHash);

        assertFalse(appAuth.allowedComposeHashes(testComposeHash));
    }

    function test_RemoveComposeHash_RevertWhen_NotManager() public {
        vm.prank(user);
        vm.expectRevert();
        appAuth.removeComposeHash(testComposeHash);
    }

    function test_SetAllowAnyDevice() public {
        assertTrue(appAuth.allowAnyDevice());

        vm.prank(manager);
        vm.expectEmit(false, false, false, true);
        emit AllowAnyDeviceSet(false);

        appAuth.setAllowAnyDevice(false);

        assertFalse(appAuth.allowAnyDevice());
    }

    function test_SetAllowAnyDevice_RevertWhen_NotManager() public {
        vm.prank(user);
        vm.expectRevert();
        appAuth.setAllowAnyDevice(false);
    }

    function test_AddDevice() public {
        vm.prank(manager);
        vm.expectEmit(true, false, false, false);
        emit DeviceAdded(testDeviceId);

        appAuth.addDevice(testDeviceId);

        assertTrue(appAuth.allowedDeviceIds(testDeviceId));
    }

    function test_AddDevice_RevertWhen_NotManager() public {
        vm.prank(user);
        vm.expectRevert();
        appAuth.addDevice(testDeviceId);
    }

    function test_RemoveDevice() public {
        // First add a device
        vm.prank(manager);
        appAuth.addDevice(testDeviceId);
        assertTrue(appAuth.allowedDeviceIds(testDeviceId));

        // Then remove it
        vm.prank(manager);
        vm.expectEmit(true, false, false, false);
        emit DeviceRemoved(testDeviceId);

        appAuth.removeDevice(testDeviceId);

        assertFalse(appAuth.allowedDeviceIds(testDeviceId));
    }

    function test_RemoveDevice_RevertWhen_NotManager() public {
        vm.prank(user);
        vm.expectRevert();
        appAuth.removeDevice(testDeviceId);
    }

    function test_IsAppAllowed_Success_AllowAnyDevice() public {
        // Add compose hash
        vm.prank(manager);
        appAuth.addComposeHash(testComposeHash, "v1.0.0");

        IAppAuth.AppBootInfo memory bootInfo = IAppAuth.AppBootInfo({
            appId: appId,
            composeHash: testComposeHash,
            instanceId: makeAddr("instance"),
            deviceId: testDeviceId,
            mrAggregated: keccak256("mrAggregated"),
            mrSystem: keccak256("mrSystem"),
            mrImage: keccak256("mrImage"),
            tcbStatus: "OK",
            advisoryIds: new string[](0)
        });

        (bool isAllowed, string memory reason) = appAuth.isAppAllowed(bootInfo);

        assertTrue(isAllowed);
        assertEq(reason, "");
    }

    function test_IsAppAllowed_Success_SpecificDevice() public {
        // Disable allow any device
        vm.prank(manager);
        appAuth.setAllowAnyDevice(false);

        // Add compose hash and device
        vm.prank(manager);
        appAuth.addComposeHash(testComposeHash, "v1.0.0");
        vm.prank(manager);
        appAuth.addDevice(testDeviceId);

        IAppAuth.AppBootInfo memory bootInfo = IAppAuth.AppBootInfo({
            appId: appId,
            composeHash: testComposeHash,
            instanceId: makeAddr("instance"),
            deviceId: testDeviceId,
            mrAggregated: keccak256("mrAggregated"),
            mrSystem: keccak256("mrSystem"),
            mrImage: keccak256("mrImage"),
            tcbStatus: "OK",
            advisoryIds: new string[](0)
        });

        (bool isAllowed, string memory reason) = appAuth.isAppAllowed(bootInfo);

        assertTrue(isAllowed);
        assertEq(reason, "");
    }

    function test_IsAppAllowed_RevertWhen_WrongAppId() public {
        IAppAuth.AppBootInfo memory bootInfo = IAppAuth.AppBootInfo({
            appId: makeAddr("wrongAppId"),
            composeHash: testComposeHash,
            instanceId: makeAddr("instance"),
            deviceId: testDeviceId,
            mrAggregated: keccak256("mrAggregated"),
            mrSystem: keccak256("mrSystem"),
            mrImage: keccak256("mrImage"),
            tcbStatus: "OK",
            advisoryIds: new string[](0)
        });

        (bool isAllowed, string memory reason) = appAuth.isAppAllowed(bootInfo);

        assertFalse(isAllowed);
        assertEq(reason, "Wrong app controller");
    }

    function test_IsAppAllowed_RevertWhen_ComposeHashNotAllowed() public {
        IAppAuth.AppBootInfo memory bootInfo = IAppAuth.AppBootInfo({
            appId: appId,
            composeHash: keccak256("not-allowed-hash"),
            instanceId: makeAddr("instance"),
            deviceId: testDeviceId,
            mrAggregated: keccak256("mrAggregated"),
            mrSystem: keccak256("mrSystem"),
            mrImage: keccak256("mrImage"),
            tcbStatus: "OK",
            advisoryIds: new string[](0)
        });

        (bool isAllowed, string memory reason) = appAuth.isAppAllowed(bootInfo);

        assertFalse(isAllowed);
        assertEq(reason, "Compose hash not allowed");
    }

    function test_IsAppAllowed_RevertWhen_DeviceNotAllowed() public {
        // Disable allow any device
        vm.prank(manager);
        appAuth.setAllowAnyDevice(false);

        // Add compose hash but not device
        vm.prank(manager);
        appAuth.addComposeHash(testComposeHash, "v1.0.0");

        IAppAuth.AppBootInfo memory bootInfo = IAppAuth.AppBootInfo({
            appId: appId,
            composeHash: testComposeHash,
            instanceId: makeAddr("instance"),
            deviceId: keccak256("not-allowed-device"),
            mrAggregated: keccak256("mrAggregated"),
            mrSystem: keccak256("mrSystem"),
            mrImage: keccak256("mrImage"),
            tcbStatus: "OK",
            advisoryIds: new string[](0)
        });

        (bool isAllowed, string memory reason) = appAuth.isAppAllowed(bootInfo);

        assertFalse(isAllowed);
        assertEq(reason, "Device not allowed");
    }

    function test_DisableUpgrades() public {
        vm.prank(admin);
        vm.expectEmit(false, false, false, false);
        emit UpgradesDisabled();

        appAuth.disableUpgrades();
    }

    function test_DisableUpgrades_RevertWhen_NotAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        appAuth.disableUpgrades();
    }

    function test_AuthorizeUpgrade_RevertWhen_UpgradesDisabled() public {
        // Disable upgrades
        vm.prank(admin);
        appAuth.disableUpgrades();

        // Try to upgrade (this will call _authorizeUpgrade internally)
        CrossmintAppAuth newImplementation = new CrossmintAppAuth();

        vm.prank(upgrader);
        vm.expectRevert("Upgrades are permanently disabled");
        appAuth.upgradeToAndCall(address(newImplementation), "");
    }

    function test_AuthorizeUpgrade_RevertWhen_NotUpgrader() public {
        CrossmintAppAuth newImplementation = new CrossmintAppAuth();

        vm.prank(user);
        vm.expectRevert();
        appAuth.upgradeToAndCall(address(newImplementation), "");
    }

    function test_UpgradeToAndCall_Success() public {
        CrossmintAppAuth newImplementation = new CrossmintAppAuth();

        vm.prank(upgrader);
        appAuth.upgradeToAndCall(address(newImplementation), "");

        // Verify the upgrade worked by checking the implementation address
        // Note: This is a simplified test - in practice you'd verify functionality
    }

    function test_Fuzz_AddComposeHash(bytes32 composeHash, string memory tag) public {
        vm.assume(bytes(tag).length > 0);

        vm.prank(manager);
        appAuth.addComposeHash(composeHash, tag);

        assertTrue(appAuth.allowedComposeHashes(composeHash));
    }

    function test_Fuzz_AddDevice(bytes32 deviceId) public {
        vm.prank(manager);
        appAuth.addDevice(deviceId);

        assertTrue(appAuth.allowedDeviceIds(deviceId));
    }

    function test_Fuzz_IsAppAllowed_WrongAppId(address wrongAppId) public {
        vm.assume(wrongAppId != appId);

        IAppAuth.AppBootInfo memory bootInfo = IAppAuth.AppBootInfo({
            appId: wrongAppId,
            composeHash: testComposeHash,
            instanceId: makeAddr("instance"),
            deviceId: testDeviceId,
            mrAggregated: keccak256("mrAggregated"),
            mrSystem: keccak256("mrSystem"),
            mrImage: keccak256("mrImage"),
            tcbStatus: "OK",
            advisoryIds: new string[](0)
        });

        (bool isAllowed, string memory reason) = appAuth.isAppAllowed(bootInfo);

        assertFalse(isAllowed);
        assertEq(reason, "Wrong app controller");
    }

    function test_IsComposeHashAllowed_Success() public {
        // Add a compose hash
        vm.prank(manager);
        appAuth.addComposeHash(testComposeHash, "v1.0.0");

        // Test that the function returns true for allowed hash
        assertTrue(appAuth.isComposeHashAllowed(testComposeHash));
    }

    function test_IsComposeHashAllowed_NotAllowed() public {
        bytes32 unknownHash = keccak256("unknown-hash");

        // Test that the function returns false for non-existent hash
        assertFalse(appAuth.isComposeHashAllowed(unknownHash));
    }

    function test_IsComposeHashAllowed_AfterRemoval() public {
        // Add a compose hash
        vm.prank(manager);
        appAuth.addComposeHash(testComposeHash, "v1.0.0");

        // Verify it's allowed
        assertTrue(appAuth.isComposeHashAllowed(testComposeHash));

        // Remove the compose hash
        vm.prank(manager);
        appAuth.removeComposeHash(testComposeHash);

        // Verify it's no longer allowed
        assertFalse(appAuth.isComposeHashAllowed(testComposeHash));
    }

    function test_IsComposeHashAllowed_MultipleHashes() public {
        bytes32 hash1 = keccak256("hash1");
        bytes32 hash2 = keccak256("hash2");
        bytes32 hash3 = keccak256("hash3");

        // Add two hashes
        vm.prank(manager);
        appAuth.addComposeHash(hash1, "v1.0.0");
        vm.prank(manager);
        appAuth.addComposeHash(hash2, "v2.0.0");

        // Test that allowed hashes return true
        assertTrue(appAuth.isComposeHashAllowed(hash1));
        assertTrue(appAuth.isComposeHashAllowed(hash2));

        // Test that non-added hash returns false
        assertFalse(appAuth.isComposeHashAllowed(hash3));
    }

    function test_Fuzz_IsComposeHashAllowed(bytes32 composeHash) public {
        // Initially should be false for any hash
        assertFalse(appAuth.isComposeHashAllowed(composeHash));

        // Add the hash
        vm.prank(manager);
        appAuth.addComposeHash(composeHash, "fuzz-test");

        // Should now return true
        assertTrue(appAuth.isComposeHashAllowed(composeHash));

        // Remove the hash
        vm.prank(manager);
        appAuth.removeComposeHash(composeHash);

        // Should return false again
        assertFalse(appAuth.isComposeHashAllowed(composeHash));
    }
}
