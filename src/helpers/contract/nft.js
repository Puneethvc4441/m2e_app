const {web3} = require('../web3Helper');
const nft = require('./abis/nft.json');

// create nft contract instance
const nftContract = new web3.eth.Contract(nft.abi, nft.address);

module.exports = {nftContract};
