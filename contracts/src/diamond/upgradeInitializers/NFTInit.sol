// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LibDiamond} from "lib/diamond-1-hardhat/contracts/libraries/LibDiamond.sol";
import {IDiamondCut} from "lib/diamond-1-hardhat/contracts/interfaces/IDiamondCut.sol";
import {IDiamondLoupe} from "lib/diamond-1-hardhat/contracts/interfaces/IDiamondLoupe.sol";
import {IERC173} from "lib/diamond-1-hardhat/contracts/interfaces/IERC173.sol";
import {IERC165} from "lib/diamond-1-hardhat/contracts/interfaces/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Metadata} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import {LibClassNFT} from "../libraries/LibClassNFT.sol";

contract NFTInit {
    function init(string memory name, string memory symbol) external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IERC721).interfaceId] = true;
        ds.supportedInterfaces[type(IERC721Metadata).interfaceId] = true;

        LibClassNFT.NFTStorage storage ns = LibClassNFT.nftStorage();
        ns.name = name;
        ns.symbol = symbol;
    }
}
