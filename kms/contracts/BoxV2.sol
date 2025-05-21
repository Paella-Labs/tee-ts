// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract BoxV2 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 private _value;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // Note: We are "re-initializing" with version 2.
    // The `initializer` modifier ensures this can only be called once per version if `reinitializer` is not used.
    // For UUPS, the state is preserved, so we don't re-run the original initialize logic that sets the owner.
    // We only need to initialize new state variables introduced in this version, if any.
    // If there are no new state variables needing initialization in V2, this function might not be strictly necessary,
    // but it's good practice for clarity and future versions.
    function initializeV2() public reinitializer(2) {
        // Initialize any new state variables for V2 here
        // For this example, no new state variables are added that need initialization beyond what Box already had.
    }


    // Existing functions from Box.sol (must be present if not modified)
    // Or, inherit from Box.sol if you prefer, but for clarity here, we'll redefine.
    // Ensure storage layout compatibility.

    function initialize(uint256 initialValue) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        _value = initialValue;
    }

    function store(uint256 newValue) public onlyOwner {
        _value = newValue;
    }

    function retrieve() public view returns (uint256) {
        return _value;
    }

    // New function for V2
    function increment() public onlyOwner {
        _value += 1;
    }

    // Required for UUPS
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}