// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./IAppAuth.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract CrossmintAppAuth is Initializable, AccessControlUpgradeable, UUPSUpgradeable, IAppAuth {
    // Role definitions
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // App ID this contract is managing
    address public appId;

    // Mapping of allowed compose hashes for this app
    mapping(bytes32 => bool) public allowedComposeHashes;

    // State variable to track if upgrades are disabled
    bool private _upgradesDisabled;

    // Whether allow any device to boot this app or only allow devices
    bool public allowAnyDevice;

    // Mapping of allowed device IDs for this app
    mapping(bytes32 => bool) public allowedDeviceIds;

    // Events
    event ComposeHashAdded(bytes32 composeHash, string tag);
    event ComposeHashRemoved(bytes32 composeHash);
    event UpgradesDisabled();
    event DeviceAdded(bytes32 deviceId);
    event DeviceRemoved(bytes32 deviceId);
    event AllowAnyDeviceSet(bool allowAny);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // Initialize the contract
    function initialize(
        address initialAdmin,
        address _appId,
        bool _disableUpgrades,
        bool _allowAnyDevice
    )
        public
        initializer
    {
        require(initialAdmin != address(0), "Invalid admin address");
        require(_appId != address(0), "Invalid app ID");

        __AccessControl_init();
        __UUPSUpgradeable_init();

        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(UPGRADER_ROLE, initialAdmin);
        _grantRole(MANAGER_ROLE, initialAdmin);

        appId = _appId;
        _upgradesDisabled = _disableUpgrades;
        allowAnyDevice = _allowAnyDevice;
    }

    // Function to authorize upgrades (required by UUPSUpgradeable)
    function _authorizeUpgrade(address) internal view override {
        require(!_upgradesDisabled, "Upgrades are permanently disabled");
        require(hasRole(UPGRADER_ROLE, _msgSender()), "Upgrade: Must have upgrader role");
    }

    // Add a compose hash to allowed list
    function addComposeHash(bytes32 composeHash, string calldata tag) external onlyRole(MANAGER_ROLE) {
        require(bytes(tag).length > 0, "Tag must be provided");
        allowedComposeHashes[composeHash] = true;
        emit ComposeHashAdded(composeHash, tag);
    }

    // Remove a compose hash from allowed list
    function removeComposeHash(bytes32 composeHash) external onlyRole(MANAGER_ROLE) {
        allowedComposeHashes[composeHash] = false;
        emit ComposeHashRemoved(composeHash);
    }

    // Set whether any device is allowed to boot this app
    function setAllowAnyDevice(bool _allowAnyDevice) external onlyRole(MANAGER_ROLE) {
        allowAnyDevice = _allowAnyDevice;
        emit AllowAnyDeviceSet(_allowAnyDevice);
    }

    // Add a device ID to allowed list
    function addDevice(bytes32 deviceId) external onlyRole(MANAGER_ROLE) {
        allowedDeviceIds[deviceId] = true;
        emit DeviceAdded(deviceId);
    }

    // Remove a device ID from allowed list
    function removeDevice(bytes32 deviceId) external onlyRole(MANAGER_ROLE) {
        allowedDeviceIds[deviceId] = false;
        emit DeviceRemoved(deviceId);
    }

    // Check if an app is allowed to boot
    function isAppAllowed(IAppAuth.AppBootInfo calldata bootInfo)
        external
        view
        override
        returns (bool isAllowed, string memory reason)
    {
        // Check if this controller is responsible for the app
        if (bootInfo.appId != appId) {
            return (false, "Wrong app controller");
        }

        // Check if compose hash is allowed
        if (!allowedComposeHashes[bootInfo.composeHash]) {
            return (false, "Compose hash not allowed");
        }

        // Check if device is allowed (when device restriction is enabled)
        if (!allowAnyDevice && !allowedDeviceIds[bootInfo.deviceId]) {
            return (false, "Device not allowed");
        }

        return (true, "");
    }

    // Function to permanently disable upgrades
    function disableUpgrades() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _upgradesDisabled = true;
        emit UpgradesDisabled();
    }

    // Add storage gap for upgradeable contracts
    uint256[50] private __gap;
}
