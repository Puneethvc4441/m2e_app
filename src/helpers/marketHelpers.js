const {web3, networkId, getPkFromSeed} = require('./web3Helper');
const ethers = require('ethers');
const {marketPlaceContract} = require('./contract/tokens'); 
const {nftContract} = require('./contract/nft');
const tokenUtils = require('./tokenUtils');
const encrypt = require('../../helpers/encryption');
const dotenv = require("dotenv");
dotenv.config();

exports.approveNFT =  async (req, res) => {
    try{
        const from = process.env.OWNER_ADDRESS;
       // console.log({from});
        const tokenId = req.body.tokenId;
        const to = process.env.MARKET_ADDRESS;
        
        let txObj;
        txObj = nftContract.methods.approve(to,tokenId);
        console.log(nftContract.methods);
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
            to: to,
            data,  
            gas,
            gasPrice: gasPrice * 10,
            chainId: networkId
          };    
        
    console.log("------ test ------");
     // import seed phrase here
     let seedPhrase = encrypt.encryptWithAES(req.body.ciphertext);
     let pk = await getPkFromSeed(seedPhrase);
    if(pk != null){
        const signature = await web3.eth.accounts.signTransaction(txObj2, pk);
       // console.log({signature});
        let receipt = await web3.eth.sendSignedTransaction(signature.rawTransaction) 
       // console.log({receipt});
        res.json({data: receipt.transactionHash , error: null});
      //  console.log("passss");
    }else {
        res.status(402).json({data:null, error:"seed phrase or private key fetch failed/invalid"}) 

        }
    }
    }catch(e){
    console.log(e);
    res.json({error: e.toString(), data: null});
    }
} 

exports.createMarketItem = async (req,res) =>{
    try{
        const from = process.env.OWNER_ADDRESS;
        const tokenId = req.body.tokenId;
        const nftContract = process.env.NFT_CONTRACT;
        const type = req.body.type;
        const price = req.body.price;
       
        let txObj;
           //console.log(nftContract.methods);
           if(type == "createMarketItem"){
            txObj = await marketPlaceContract.methods.createMarketItem(nftContract,tokenId,price);
        }
       else if(type == "createMultiplMarketItem"){
            txObj = await marketPlaceContract.methods.createMultiplMarketItem(nftContract,tokenId,price);
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
                to: marketPlaceContract.options.address,
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

exports.getListedItemDetails = async (req,res) =>{
    try{
        const id = req.body.id;
        const method = req.body.method; 
        let result;
        if(method == "getListedItemDetails"){
        result= await marketPlaceContract.methods.getListedItemDetails(id).call();
        }else if(method == "fetchMarketItems") {
            result= await marketPlaceContract.methods.fetchMarketItems().call(); 
        }
        res.status(200).json({data: result, error: null});
    } catch (error) {
        res.status(400).json({data: null, error: error.toString()});
    }

}