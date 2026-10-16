// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LibClassNFT} from "../libraries/LibClassNFT.sol";

contract ClassNFTFacet {
    event Minted(address indexed to, uint256 indexed tokenId, string uri);

    /// @param uri e.g. ipfs://<metadataCID>
    function mint(address to, string calldata uri) external returns (uint256 tokenId) {
        tokenId = LibClassNFT.safeMint(to, uri);
        emit Minted(to, tokenId, uri);
    }

    function totalMinted() external view returns (uint256) {
        return LibClassNFT.totalMinted();
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return LibClassNFT.tokenURI(tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return LibClassNFT.ownerOf(tokenId);
    }
}
