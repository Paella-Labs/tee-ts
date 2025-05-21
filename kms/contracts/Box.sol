// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol"; // Optional: for access control

contract Box is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 private _value;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 initialValue) public initializer {
        __Ownable_init(msg.sender); // Initialize Ownable
        __UUPSUpgradeable_init();   // Initialize UUPS
        _value = initialValue;
    }

    function store(uint256 newValue) public onlyOwner {
        _value = newValue;
    }

    function retrieve() public view returns (uint256) {
        return _value;
    }

    // Required for UUPS
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
