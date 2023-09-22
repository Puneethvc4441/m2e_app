const {web3, networkId, getPkFromSeed} = require('./web3Helper');
const {hlthContract, runContract, wMaticContract} = require('./contract/tokens');
const pg = require('pg');
const Pool = pg.Pool;
const DATABASE_OPTIONS = require('../../config.js');
const pgPool = new Pool(DATABASE_OPTIONS);

const encrypt = require('../../helpers/encryption');


exports.tokenGetMethod =  async (req, res) => {
    try{
        // console.log(req.body);
        const token = req.body.token;
        const method = req.body.method; 

        let tokenInstance;
        if(token == "hlth") {
            tokenInstance = hlthContract;
        } else if (token == "run") {
            tokenInstance = runContract;
        } else if(token == "matic") {
            tokenInstance = wMaticContract;
        }
        let result;   
        // console.log(tokenInstance.methods);  
        if(method == "symbol") {
            result = await tokenInstance.methods.symbol().call();
        } else if(method == "name") {
            result = await tokenInstance.methods.name().call();
        } else if(method == "decimals") {
            result = await tokenInstance.methods.decimals().call();
        } else if(method == "totalSupply") {
            result = await tokenInstance.methods.totalSupply().call();
            result = await web3.utils.fromWei(result, 'ether');
        } else if(method == "allowance") {
            result = await tokenInstance.methods.allowance(req.body.owner, req.body.spender).call();
            result = await web3.utils.fromWei(result, 'ether');
        } else if(method == "balanceOf") {
            result = await tokenInstance.methods.balanceOf(req.body.owner).call();
            result = await web3.utils.fromWei(result, 'ether');
        }
        res.status(200).json({data: result, error: null});
    } catch (error) {
        res.status(400).json({data: null, error: error.toString()});
    }
}

exports.tokenBalance =  async (req, res) => {
    try{
        console.log(req.body);
        const address = req.body.address;
        // get balance of hlth
        let hlthBalance = await hlthContract.methods.balanceOf(address).call();
        // convert to ether
        hlthBalance = await web3.utils.fromWei(hlthBalance, 'ether');
        hlthBalance = parseFloat(hlthBalance).toFixed(4);
        // get balance of run
        let runBalance = await runContract.methods.balanceOf(address).call();
        // convert to ether
        runBalance = await web3.utils.fromWei(runBalance, 'ether');
        runBalance = parseFloat(runBalance).toFixed(4);
        // get balance of matic
        // let wmaticBalance = await wMaticContract.methods.balanceOf(address).call();
        // // convert to ether
        // wmaticBalance = await web3.utils.fromWei(wmaticBalance, 'ether');
        // wmaticBalance = parseFloat(wmaticBalance).toFixed(4);

        // get eth balance
        let ethBalance = await web3.eth.getBalance(address);
        ethBalance = await web3.utils.fromWei(ethBalance, 'ether');
        ethBalance = parseFloat(ethBalance).toFixed(4);

        res.status(200).json({data: {hlthBalance:hlthBalance, runBalance:runBalance,  MaticBalance: ethBalance}, error: null});
    } catch (error) {
        res.status(400).json({data: null, error: error.toString()});
    }
}

exports.tokenSetMethod =  async (req, res) => {
    const client = await pgPool.connect();
    try{
        //console.log(req.body);
        // convert ether to wei using web3
        let from = req.body.from;
        let to = req.body.to;
        let amount = req.body.amount;
        let token = req.body.token;
        let method = req.body.method;
        let tokenInstance;

        if(token == "hlth") {
            tokenInstance = hlthContract;
        } else if(token == "runn") {
            tokenInstance = runContract;
        } else if(token == "matic") {
            tokenInstance = wMaticContract;
        }
        //console.log(typeof amount)
            
        amount = web3.utils.toWei(amount, 'ether');
        // console.log(typeof amount)
        let txObj;
       
        if(method == "transfer") {
            txObj = tokenInstance.methods.transfer(to,amount);
             
        } else if(method == "approve") {
           
            txObj = tokenInstance.methods.approve(to,amount);
            
        } else if(method == "mint") {
            txObj = tokenInstance.methods.mint(to,amount);
           // console.log(txObj);
        }
        const gas = await txObj.estimateGas({ from });
        const gasPrice = await web3.eth.getGasPrice();
        const gasFee = gas * gasPrice;
        // const gasFee = await estimateGasFee(txObj, from);
        // check if sender has token balance
        const tokenBalance = await tokenInstance.methods.balanceOf(from).call();
        //check if the sender has enough ether to pay gas fee
        const senderEthBalance = await web3.eth.getBalance(from);
        
        if(parseInt(tokenBalance) < parseInt(amount) && method != "mint") {
            res.json({error: "Insufficient token balance", response: null});
        } else if(parseInt(senderEthBalance) < parseInt(gasFee)) {
            res.json({error: "Insufficient balance to pay gas fee", response: null});
        } else {
            const data = txObj.encodeABI(); 
            const txObj1 = {
                  to: tokenInstance.options.address,
                  data,  
                  gas,
                  gasPrice,
                  chainId: networkId
            }
        
    
         // import seed phrase here
       
         let seedPhrase = encrypt.encryptWithAES(req.body.ciphertext);
               
        let pk = await getPkFromSeed(seedPhrase);
         if(pk != null){
            const signature = await web3.eth.accounts.signTransaction(txObj1, pk);
          
            let receipt = await web3.eth.sendSignedTransaction(signature.rawTransaction) 


            const getWalletInfo = `
            INSERT INTO core.wallet_spending_history
            (user_id, amount, "token", transfer, hash, status)
            VALUES( '${req.body.user_id}', ${req.body.amount}, '${token}', 'IN', '${receipt.transactionHash}', 'Pending') returning *`;
            const wallet_spendingRes = await client.query(getWalletInfo); 

            const updateWalletInfo = `
            update core.wallet_spending set ${token} = ${token}+${req.body.amount} where user_id = '${req.body.user_id}'`;
            const updateWalletInfoRes = await client.query(updateWalletInfo); 



            res.json({data: receipt.transactionHash , error: null,"wallet":wallet_spendingRes.rows[0]});
        }else {
            res.status(402).json({data:null, error:"seed phrase or private key fetch failed/invalid"})
        }
    }
    }catch(e){
        console.log(e);
        res.json({error: e.toString(), data: null});
    } finally {
        client.release();
    }
}



exports.sendToken =  async (req, res) => {
    const client = await pgPool.connect();
    try{
        //console.log(req.body);
        // convert ether to wei using web3
        let from = req.body.from;
        let to = req.body.to;
        let amount = req.body.amount;
        let token = req.body.token;
        let method = req.body.method;
        let tokenInstance;

        if(token == "hlth") {
            tokenInstance = hlthContract;
        } else if(token == "runn") {
            tokenInstance = runContract;
        } else if(token == "matic") {
            tokenInstance = wMaticContract;
        }
        //console.log(typeof amount)
            
        amount = web3.utils.toWei(amount, 'ether');
        // console.log(typeof amount)
        let txObj;
       
        if(method == "transfer") {
            txObj = tokenInstance.methods.transfer(to,amount);
             
        } else if(method == "approve") {
           
            txObj = tokenInstance.methods.approve(to,amount);
            
        } else if(method == "mint") {
            txObj = tokenInstance.methods.mint(to,amount);
           // console.log(txObj);
        }
        const gas = await txObj.estimateGas({ from });
        const gasPrice = await web3.eth.getGasPrice();
        const gasFee = gas * gasPrice;
        // const gasFee = await estimateGasFee(txObj, from);
        // check if sender has token balance
        const tokenBalance = await tokenInstance.methods.balanceOf(from).call();
        //check if the sender has enough ether to pay gas fee
        const senderEthBalance = await web3.eth.getBalance(from);
        
        if(parseInt(tokenBalance) < parseInt(amount) && method != "mint") {
            res.json({error: "Insufficient token balance", response: null});
        } else if(parseInt(senderEthBalance) < parseInt(gasFee)) {
            res.json({error: "Insufficient balance to pay gas fee", response: null});
        } else {
            const data = txObj.encodeABI(); 
            const txObj1 = {
                  to: tokenInstance.options.address,
                  data,  
                  gas,
                  gasPrice,
                  chainId: networkId
            }
        
    
         // import seed phrase here
       
         let seedPhrase = encrypt.encryptWithAES(req.body.ciphertext);
               
        let pk = await getPkFromSeed(seedPhrase);
         if(pk != null){
            const signature = await web3.eth.accounts.signTransaction(txObj1, pk);
          
            let receipt = await web3.eth.sendSignedTransaction(signature.rawTransaction) 

            res.json({data: receipt.transactionHash , error: null});
        }else {
            res.status(402).json({data:null, error:"seed phrase or private key fetch failed/invalid"})
        }
    }
    }catch(e){
        console.log(e);
        res.json({error: e.toString(), data: null});
    } finally {
        client.release();
    }
}



