// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IDiamondCut} from "lib/diamond-1-hardhat/contracts/interfaces/IDiamondCut.sol";
import {IDiamond} from "lib/diamond-1-hardhat/contracts/interfaces/IDiamond.sol";
import {NFTSelectors} from "../src/diamond/NFTSelectors.sol";
import {NFTInit} from "../src/diamond/upgradeInitializers/NFTInit.sol";

contract CutNFTFacet is Script {
    function run() external {
        address diamond = vm.envAddress("DIAMOND");
        address nftFacet = vm.envOr("NFT_FACET", address(0xde66Bf807c62a75eF1B5aFb3Fff33812b86386B2));
        address nftInit = vm.envOr("NFT_INIT", address(0x793206f049F0185778C3A57390C57c41566569BA));

        vm.startBroadcast();

        // Prepare the cut to add ClassNFTFacet functions to existing Diamond
        IDiamond.FacetCut[] memory cut = new IDiamond.FacetCut[](1);
        cut[0] = IDiamond.FacetCut({
            facetAddress: nftFacet,
            action: IDiamond.FacetCutAction.Add,
            functionSelectors: NFTSelectors.nft()
        });

        // Execute diamondCut on the existing Diamond
        bytes memory initCalldata = abi.encodeWithSelector(NFTInit.init.selector, "Web3Bridge Class", "W3B");
        IDiamondCut(diamond).diamondCut(cut, nftInit, initCalldata);

        vm.stopBroadcast();

        console.log("=== Successfully Cut NFT Facet into Existing Diamond ===");
        console.log("Diamond Address:   ", diamond);
        console.log("ClassNFTFacet:     ", nftFacet);
    }
}
