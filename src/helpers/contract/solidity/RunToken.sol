// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RunToken is ERC20, Ownable {
    constructor() ERC20("RunToken", "RUN") {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}