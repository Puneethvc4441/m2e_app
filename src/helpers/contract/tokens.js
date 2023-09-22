const {web3} = require('../web3Helper');
const hlth = require('./abis/hlth.json');
const run = require('./abis/run.json');
const wmatic = require('./abis/wmatic.json');
const marketPlace = require('./abis/marketPlace.json');

 
// create hlth contract instance
const hlthContract = new web3.eth.Contract(hlth.abi, hlth.address);
// create run contract instance
const runContract = new web3.eth.Contract(run.abi, run.address);
// create wmatic contract instances
const wMaticContract = new web3.eth.Contract(wmatic.abi, wmatic.address);
// create marketPlace contract instance
const marketPlaceContract = new web3.eth.Contract(marketPlace.abi, marketPlace.address);


module.exports = {hlthContract, runContract, wMaticContract,marketPlaceContract}

