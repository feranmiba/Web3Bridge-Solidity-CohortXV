// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IDiamondCut} from "lib/diamond-1-hardhat/contracts/interfaces/IDiamondCut.sol";
import {IDiamondLoupe} from "lib/diamond-1-hardhat/contracts/interfaces/IDiamondLoupe.sol";
import {IERC173} from "lib/diamond-1-hardhat/contracts/interfaces/IERC173.sol";
import {IERC165} from "lib/diamond-1-hardhat/contracts/interfaces/IERC165.sol";
import {ClassNFTFacet} from "./facets/ClassNFTFacet.sol";

library NFTSelectors {
    function diamondCut() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](1);
        s[0] = IDiamondCut.diamondCut.selector;
    }

    function diamondLoupe() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](5);
        s[0] = IDiamondLoupe.facets.selector;
        s[1] = IDiamondLoupe.facetFunctionSelectors.selector;
        s[2] = IDiamondLoupe.facetAddresses.selector;
        s[3] = IDiamondLoupe.facetAddress.selector;
        s[4] = IERC165.supportsInterface.selector;
    }

    function ownership() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](2);
        s[0] = IERC173.owner.selector;
        s[1] = IERC173.transferOwnership.selector;
    }

    function nft() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](4);
        s[0] = ClassNFTFacet.mint.selector;
        s[1] = ClassNFTFacet.totalMinted.selector;
        s[2] = ClassNFTFacet.tokenURI.selector;
        s[3] = ClassNFTFacet.ownerOf.selector;
    }
}
