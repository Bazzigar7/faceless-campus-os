// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract CampusEdition is ERC1155, ERC1155Supply, ERC2981, Ownable {
    using Address for address payable;

    uint256 public constant TOKEN_ID = 1;
    string public name;
    string public symbol;
    uint256 public immutable maxSupply;
    uint256 public immutable mintPrice;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory metadataUri_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        address creator_,
        uint96 royaltyBps_
    ) ERC1155(metadataUri_) Ownable(creator_) {
        require(bytes(name_).length > 0, "Name required");
        require(bytes(symbol_).length > 0, "Symbol required");
        require(maxSupply_ > 0, "Supply required");
        require(creator_ != address(0), "Creator required");
        require(royaltyBps_ <= 1000, "Royalty above 10%");
        name = name_;
        symbol = symbol_;
        maxSupply = maxSupply_;
        mintPrice = mintPrice_;
        _setDefaultRoyalty(creator_, royaltyBps_);
    }

    function mint(uint256 amount) external payable {
        require(amount > 0, "Amount required");
        require(totalSupply(TOKEN_ID) + amount <= maxSupply, "Edition sold out");
        require(msg.value == mintPrice * amount, "Incorrect mint payment");
        _mint(msg.sender, TOKEN_ID, amount, "");
    }

    function setMetadataUri(string calldata metadataUri_) external onlyOwner {
        _setURI(metadataUri_);
    }

    function withdraw() external onlyOwner {
        payable(owner()).sendValue(address(this).balance);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._update(from, to, ids, values);
    }
}
