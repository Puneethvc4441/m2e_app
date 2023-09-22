// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";

contract HlthRunNFT is ERC721, ERC721URIStorage, Ownable, ERC721Burnable {

    uint public tokenIdCounter;

    constructor() ERC721("HlthRunNFT", "HlthRunNFT") {}

    function _baseURI() internal pure override returns (string memory) {
        return "https://nft-sneakers.s3.amazonaws.com/metadata/";
    }

    function safeMint(address to, string memory uri) public onlyOwner
    {
        tokenIdCounter++;
        _safeMint(to, tokenIdCounter);
        _setTokenURI(tokenIdCounter, uri);
    }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) 
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
       return super.tokenURI(tokenId);  
    }

    function batchMintForMultipleUsers(address [] memory to, string [] memory uri) public onlyOwner{
        require(to.length == uri.length, "Addresses and URI lengths should be same");
        uint length = uri.length;
        for(uint i=0; i<length; i++){
            safeMint(to[i], uri[i]);
        }
    }

    function batchMintForSingleUser(address to, string [] memory uri) public onlyOwner{ 
        uint length = uri.length;
        for(uint i=0; i<length; i++){
            safeMint(to , uri[i]);
        }
    }

    function validateInputsLength(address [] memory to, string [] memory uri) public pure returns (uint, uint) {
        return (to.length, uri.length);
    }
}