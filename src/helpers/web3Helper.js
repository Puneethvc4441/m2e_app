const Web3 = require('web3');
const ethers = require('ethers');
const dotenv = require("dotenv");
const { isValidMnemonic } = require ('@ethersproject/hdnode');
dotenv.config();
let web3;
let networkId; 
if(process.env.MAINNET ==  "false"  ) {
    web3 = new Web3('https://rpc-mumbai.maticvigil.com/');
    networkId = 80001;
} else {
    web3 = new Web3('https://rpc-mainnet.maticvigil.com/');
    networkId = 137;
}

const verifySeedPhrase = async (req,res) =>{
    try{
        const seedPhrase = req.body.seedPhrase;
        const boolval = isValidMnemonic(seedPhrase);
        let address = null;
        const wallet = ethers.Wallet.fromMnemonic(seedPhrase);
        if(boolval == true){
            address = wallet.address;
        }
        res.json({data:boolval, address: address, error: null})
        //console.log({boolval})
    }
    catch(e){
        console.log(e);
        res.json({error: e.toString(), data: null});
    }
}

const getPkFromSeed = async (seedPhrase) => {
    try{
        const boolval =isValidMnemonic(seedPhrase);
        //console.log({boolval})
        const wallet = ethers.Wallet.fromMnemonic(seedPhrase);
        const privateKey = wallet.privateKey;
        
        if(boolval == true){
            console.log(`Private key ethers: ${privateKey}`);
            return privateKey;
            }else{ 
            return null;
            }
          }
    catch(e){
        console.log(e);
        return null;
    }
}



module.exports = {web3, networkId, getPkFromSeed, verifySeedPhrase};