// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

library LibClassNFT {
    bytes32 constant NFT_STORAGE_POSITION = keccak256("web3bridge.diamond.nft.storage");

    struct NFTStorage {
        string name;
        string symbol;
        uint256 nextTokenId;
        mapping(uint256 => address) owners;
        mapping(address => uint256) balances;
        mapping(uint256 => string) tokenURIs;
    }

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Minted(address indexed to, uint256 indexed tokenId, string uri);

    error NonexistentToken(uint256 tokenId);
    error InvalidRecipient();
    error UnsafeRecipient();

    function nftStorage() internal pure returns (NFTStorage storage ns) {
        bytes32 position = NFT_STORAGE_POSITION;
        assembly {
            ns.slot := position
        }
    }

    function totalMinted() internal view returns (uint256) {
        return nftStorage().nextTokenId;
    }

    function tokenURI(uint256 tokenId) internal view returns (string memory) {
        address tokenOwner = nftStorage().owners[tokenId];
        if (tokenOwner == address(0)) revert NonexistentToken(tokenId);
        return nftStorage().tokenURIs[tokenId];
    }

    function ownerOf(uint256 tokenId) internal view returns (address) {
        address tokenOwner = nftStorage().owners[tokenId];
        if (tokenOwner == address(0)) revert NonexistentToken(tokenId);
        return tokenOwner;
    }

    function safeMint(address to, string calldata uri) internal returns (uint256 tokenId) {
        if (to == address(0)) revert InvalidRecipient();

        NFTStorage storage ns = nftStorage();
        tokenId = ns.nextTokenId++;

        ns.balances[to] += 1;
        ns.owners[tokenId] = to;
        ns.tokenURIs[tokenId] = uri;

        emit Transfer(address(0), to, tokenId);
        emit Minted(to, tokenId, uri);

        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, address(0), tokenId, "") returns (bytes4 retval) {
                if (retval != IERC721Receiver.onERC721Received.selector) revert UnsafeRecipient();
            } catch {
                revert UnsafeRecipient();
            }
        }
    }
}
