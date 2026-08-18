// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract CampusToken is ERC20, Ownable {
    uint8 private immutable tokenDecimals;
    bool public mintAuthorityActive;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        address creator_,
        bool keepMintAuthority_
    ) ERC20(name_, symbol_) Ownable(creator_) {
        require(bytes(name_).length > 0, "Name required");
        require(bytes(symbol_).length > 0, "Symbol required");
        require(decimals_ <= 18, "Decimals above 18");
        require(initialSupply_ > 0, "Supply required");
        require(creator_ != address(0), "Creator required");
        tokenDecimals = decimals_;
        mintAuthorityActive = keepMintAuthority_;
        _mint(creator_, initialSupply_ * (10 ** uint256(decimals_)));
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }

    function mint(address recipient, uint256 amount) external onlyOwner {
        require(mintAuthorityActive, "Mint authority revoked");
        _mint(recipient, amount);
    }

    function revokeMintAuthority() external onlyOwner {
        mintAuthorityActive = false;
    }
}
