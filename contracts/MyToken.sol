// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MyToken
 * @notice Simple ERC20 for FIN556 assignment on Hoodi testnet
 * - Name & symbol are fixed in constructor (change if you want)
 * - initialSupply is minted to deployer
 */
contract MyToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("HoodiToken", "HOODI") {
        _mint(msg.sender, initialSupply);
    }
}
