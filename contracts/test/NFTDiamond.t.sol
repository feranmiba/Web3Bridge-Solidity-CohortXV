// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {Diamond, DiamondArgs} from "lib/diamond-1-hardhat/contracts/Diamond.sol";
import {IDiamond} from "lib/diamond-1-hardhat/contracts/interfaces/IDiamond.sol";
import {DiamondCutFacet} from "lib/diamond-1-hardhat/contracts/facets/DiamondCutFacet.sol";
import {DiamondLoupeFacet} from "lib/diamond-1-hardhat/contracts/facets/DiamondLoupeFacet.sol";
import {OwnershipFacet} from "lib/diamond-1-hardhat/contracts/facets/OwnershipFacet.sol";
import {ClassNFTFacet} from "../src/diamond/facets/ClassNFTFacet.sol";
import {NFTInit} from "../src/diamond/upgradeInitializers/NFTInit.sol";
import {NFTSelectors} from "../src/diamond/NFTSelectors.sol";

contract MockFacetV2 {
    function version() external pure returns (string memory) {
        return "v2.0.0";
    }
}

contract NFTDiamondTest is Test {
    address internal owner = address(0xABCD);
    address internal alice = address(0x1111);

    Diamond internal diamond;
    ClassNFTFacet internal nft;
    DiamondCutFacet internal cutFacet;
    DiamondLoupeFacet internal loupeFacet;
    OwnershipFacet internal ownershipFacet;
    ClassNFTFacet internal nftFacet;
    NFTInit internal nftInit;

    function setUp() public {
        vm.startPrank(owner);

        cutFacet = new DiamondCutFacet();
        loupeFacet = new DiamondLoupeFacet();
        ownershipFacet = new OwnershipFacet();
        nftFacet = new ClassNFTFacet();
        nftInit = new NFTInit();

        IDiamond.FacetCut[] memory cut = new IDiamond.FacetCut[](4);
        cut[0] = IDiamond.FacetCut({
            facetAddress: address(cutFacet),
            action: IDiamond.FacetCutAction.Add,
            functionSelectors: NFTSelectors.diamondCut()
        });
        cut[1] = IDiamond.FacetCut({
            facetAddress: address(loupeFacet),
            action: IDiamond.FacetCutAction.Add,
            functionSelectors: NFTSelectors.diamondLoupe()
        });
        cut[2] = IDiamond.FacetCut({
            facetAddress: address(ownershipFacet),
            action: IDiamond.FacetCutAction.Add,
            functionSelectors: NFTSelectors.ownership()
        });
        cut[3] = IDiamond.FacetCut({
            facetAddress: address(nftFacet),
            action: IDiamond.FacetCutAction.Add,
            functionSelectors: NFTSelectors.nft()
        });

        DiamondArgs memory args = DiamondArgs({
            owner: owner,
            init: address(nftInit),
            initCalldata: abi.encodeWithSelector(NFTInit.init.selector, "Web3Bridge Class", "W3B")
        });

        diamond = new Diamond(cut, args);
        nft = ClassNFTFacet(address(diamond));

        vm.stopPrank();
    }

    function testMintAndReads() public {
        assertEq(nft.totalMinted(), 0);

        vm.prank(alice);
        uint256 tokenId = nft.mint(alice, "ipfs://QmHash123");

        assertEq(tokenId, 0);
        assertEq(nft.totalMinted(), 1);
        assertEq(nft.ownerOf(0), alice);
        assertEq(nft.tokenURI(0), "ipfs://QmHash123");
    }

    function testUpgradeFacet() public {
        vm.startPrank(owner);
        MockFacetV2 facetV2 = new MockFacetV2();

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = MockFacetV2.version.selector;

        IDiamond.FacetCut[] memory cut = new IDiamond.FacetCut[](1);
        cut[0] = IDiamond.FacetCut({
            facetAddress: address(facetV2),
            action: IDiamond.FacetCutAction.Add,
            functionSelectors: selectors
        });

        DiamondCutFacet(address(diamond)).diamondCut(cut, address(0), "");
        vm.stopPrank();

        MockFacetV2 diamondV2 = MockFacetV2(address(diamond));
        assertEq(diamondV2.version(), "v2.0.0");
    }
}
