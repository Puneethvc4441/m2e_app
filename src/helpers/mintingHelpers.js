const ethers = require('ethers');
const { nftContract } = require('./contract/nft');
const {web3, networkId, getPkFromSeed} = require('./web3Helper');
const encrypt = require('../../helpers/encryption');
require('dotenv').config();

const safeMint = async (req,res) =>{
    try{
        const to = req.body.to;
        const uri = req.body.uri;
        const type = req.body.type;
        const from = process.env.OWNER_ADDRESS;
        let txObj;
        //console.log(nftContract.methods);
        if(type == "safeMint"){
            txObj = await nftContract.methods.safeMint(to,uri);
        }
       else if(type == "batchMintForSingleUser"){
            txObj = await nftContract.methods.batchMintForSingleUser(to,uri);
        }else if(type == "batchMintForMultipleUsers"){
            txObj = await nftContract.methods.batchMintForMultipleUsers(to,uri);
        }
        
        const gas = await txObj.estimateGas({ from }); 
        const gasPrice = await web3.eth.getGasPrice();
        const gasFee = gas * gasPrice; 
        
        //check if the sender has enough ether to pay gas fee
        const senderEthBalance = await web3.eth.getBalance(from);
       // console.log("senderEthBalance ", senderEthBalance)
        
        if(parseInt(senderEthBalance) < parseInt(gasFee)) {
            return{error: "Insufficient balance to pay gas fee", response: null};
        } else {
            const data = txObj.encodeABI(); 
            
            const txObj2 = {
                to: nftContract.options.address,
                data,  
                gas,
                gasPrice,
                chainId: networkId
            };  
            //console.log({txObj2});
            // import seed phrase here
            let seedPhrase = encrypt.encryptWithAES(req.body.ciphertext);
               
            let pk = await getPkFromSeed(seedPhrase);
         if(pk != null){
            const signature = await web3.eth.accounts.signTransaction(txObj2, pk);
          console.log({signature});
            let receipt = await web3.eth.sendSignedTransaction(signature.rawTransaction) 
            console.log({receipt})
            res.json({data: receipt.transactionHash , error: null});
        }else {
            res.status(402).json({data:null, error:"seed phrase or private key fetch failed/invalid"}) 

        }
    }
}catch(e){
    console.log(e);
    res.json({error: e.toString(), data: null});
    }
} 

const nftBalance = async (req,res) =>{
    try{
        const id = req.body.id;
        const method = req.body.method; 
        let result;
        if(method == "owner"){
        result= await nftContract.methods.ownerOf(id).call();
        }else if(method == "totalSupply") {
            result= await nftContract.methods.tokenIdCounter().call(); 
        }
        res.status(200).json({data: result, error: null});
    } catch (error) {
        res.status(400).json({data: null, error: error.toString()});
    }

}




module.exports = {safeMint,nftBalance}