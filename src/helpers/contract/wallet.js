const {web3} = require('../web3Helper');
const wallet = require('./abis/wallet.json');

// create wallet contract instance
const hlthRunWallet = new web3.eth.Contract(wallet.abi, wallet.address);

module.exports = {hlthRunWallet};



