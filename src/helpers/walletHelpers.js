const {web3, networkId, getPkFromSeed} = require('./web3Helper');
const ethers = require('ethers');

const {runContract, hlthContract, wMaticContract} = require('./contract/tokens'); 
const {hlthRunWallet} = require('./contract/wallet');
const tokenUtils = require('./tokenUtils');
const encrypt = require('../../helpers/encryption');
const dotenv = require("dotenv");
dotenv.config();
const pg = require('pg');
const Pool = pg.Pool;
const DATABASE_OPTIONS = require('../../config.js');
const pgPool = new Pool(DATABASE_OPTIONS);
    
exports.getPrice = async (req, res) => {
    try{
        // console.log(req.body);
        let tokenIn ;
        let tokenOut ;

        if(req.body.tokenOut==="runn"){
            tokenOut ="run"
       }else{
            tokenOut = req.body.tokenOut;
       }
       if(req.body.tokenIn==="runn"){
            tokenIn ="run"
       }else{
            tokenIn = req.body.tokenIn;
       }
        const address = await tokenUtils.getAddresses(tokenIn, tokenOut);
        // console.log(address);
        let amountIn = req.body.amountIn;
        amountIn = web3.utils.toWei(amountIn, 'ether');
        let amountOut;
        //console.log(hlthRunWallet );
        if(address.isSingleHop == true) {
           // console.log("single hop");
            amountOut = await hlthRunWallet.methods.getEstimatedSingleHop(amountIn, address.in, address.out).call();
         //   console.log("next");
            amountOut = await web3.utils.fromWei(amountOut, 'ether');
          //  console.log(amountOut);
        } else {
            console.log("multi hop");
            amountOut = await hlthRunWallet.methods.getEstimatedMultiHop(amountIn, address.in, address.middle, address.out).call();
            console.log("next");
            amountOut = await web3.utils.fromWei(amountOut, 'ether');
            console.log(amountOut);
        }    
        res.status(200).json({data: amountOut, error: null});
        
    } catch (error) {
        res.status(400).json({data: null, error: error.toString()});
    }
}

exports.swap = async (req, res) => {
    try{
         //console.log("check point 1");
         let tokenIn
         let tokenOut 
        
         const from = req.body.address;
         if(req.body.tokenOut==="runn"){
              tokenOut ="run"
         }else{
              tokenOut = req.body.tokenOut;
         }
         if(req.body.tokenIn==="runn"){
              tokenIn ="run"
         }else{
              tokenIn = req.body.tokenIn;
         }
        // console.log({from});
        const address = await tokenUtils.getAddresses(tokenIn, tokenOut);
        let amountIn = req.body.amountIn;
        amountIn = web3.utils.toWei(amountIn, 'ether'); 
        //console.log("check point 1");
        // await getBalances(from, address, true) 
        const approve = await tokenUtils.approveTokens(from, address, amountIn, req.body.ciphertext);
        //console.log({approve})
        if(approve.data != null) {
            const receipt = await tokenUtils.swapTokens(from, address, amountIn, req.body.ciphertext);
             console.log("receipt-----"+ receipt);
            // await getBalances(from, address, false) 
            if(receipt.data != null) {
                res.status(200).json({data: receipt.data, error: null});
            } else {
                res.status(400).json({data: null, error: receipt.error});
            }
        } else {
            res.status(400).json({data: null, error: approve.error});
        }
    } catch (error) {
        res.status(400).json({data: null, error: error.toString()});
    }
} 

exports.transferTokenOrCoin = async (req, res) => {
    const client = await pgPool.connect();
    try{
        //console.log(req.body);
        let from = process.env.OWNER_ADDRESS;
        let to = req.body.to;
        let amount = req.body.amount;
        let token = req.body.token;
        
        let tokenAddress;
        let tokenInstance;
        let txObj;
        amount = web3.utils.toWei(amount, 'ether');
        console.log(typeof amount)
        
        if(token == "hlth" || token == "runn" ) {

            if(token == "hlth") {
                tokenAddress = hlthContract.options.address;
                tokenInstance = hlthContract;
            } else if(token == "runn") {
                tokenAddress = runContract.options.address;
                tokenInstance = runContract;
            } 
            txObj = hlthRunWallet.methods.transferToken(tokenAddress, to, amount);
            const tokenBalance = await tokenInstance.methods.balanceOf(hlthRunWallet.options.address).call();        
            if(parseInt(tokenBalance) < parseInt(amount)) {
                res.json({error: "Insufficient token balance", response: null});
            }
        } else if(token == "matic") {
            const ethBalance = await web3.eth.getBalance(hlthRunWallet.options.address);
            // console.log({ethBalance});
            if(parseInt(ethBalance) < parseInt(req.body.amount)) {
                res.json({error: "Insufficient token balance", response: null});
            }
            txObj = hlthRunWallet.methods.transferCoin(amount,to);
           // console.log({txObj});
        }       

        const check_bal =`select ${token} from core.wallet_spending where user_id ='${req.body.user_id}'`;
        const wallet_spendingRes = await client.query(check_bal); 
        const wallet_res =  wallet_spendingRes.rows[0]
        console.log(wallet_res ,  parseInt(req.body.amount))
  if (wallet_res[token] < parseInt(req.body.amount)){
    res.json({error: "Insufficient token balance in your account", response: null});
  }else{
    const gas = await txObj.estimateGas({ from });
    const gasPrice = await web3.eth.getGasPrice(); 


   
    const data = txObj.encodeABI();
    const txObj1 = {
        to: hlthRunWallet.options.address,
        data,  
        gas,
        gasPrice,
        chainId: networkId
    }; 
    console.log("------------hcekc--------")
     // import seed phrase here
     let seedPhrase = encrypt.encryptWithAES(process.env.CIPHER_TEXT);
           
    let pk = await getPkFromSeed(seedPhrase);
    //console.log({pk});
     if(pk != null){
    const signature = await web3.eth.accounts.signTransaction(txObj1, pk);
    
    let receipt = await web3.eth.sendSignedTransaction(signature.rawTransaction) 
    
    const getWalletInfo = `
    INSERT INTO core.wallet_spending_history
    (user_id, amount, "token", transfer, hash, status)
    VALUES( '${req.body.user_id}', ${req.body.amount}, '${token}', 'OUT', '${receipt.transactionHash}', 'Done') returning *`;
    const wallet_spendingRes = await client.query(getWalletInfo); 

    const updateWalletInfo = `
    update core.wallet_spending set ${token} = ${token}-${req.body.amount} where user_id = '${req.body.user_id}'`;
    const updateWalletInfoRes = await client.query(updateWalletInfo); 
    res.json({data: receipt.transactionHash , error: null,"wallet":wallet_spendingRes.rows[0]});
} else {
    res.status(402).json({data:null, error:"seed phrase or private key fetch failed/invalid"})
}

  }
    // wallet_spendingRes.rows[0].token
         
       
    }catch(e){
        console.log(e);
        res.json({error: e.toString(), data: null});
    } 
}

exports.createWallet = async (req, res) =>{
    try{

        const wallet = ethers.Wallet.createRandom()
        res.json({data:{mnemonic:wallet.mnemonic.phrase, address: wallet.address, privateKey:wallet.privateKey }, error: null})
       
    } catch(e){
        console.log(e);
        res.json({error: e.toString(), data: null});
    }
}

