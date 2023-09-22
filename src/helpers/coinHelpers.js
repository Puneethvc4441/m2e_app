const {web3, getPkFromSeed} = require('./web3Helper');
const pg = require('pg');
const Pool = pg.Pool;
const DATABASE_OPTIONS = require('../../config.js');
const pgPool = new Pool(DATABASE_OPTIONS);
const encrypt = require('../../helpers/encryption');

exports.balance =  async (req, res) => {
    try{
        console.log(req.body);
        const owner = req.body.owner; 
        // get matic balance
        let maticBalance = await web3.eth.getBalance(owner);
        maticBalance = await web3.utils.fromWei(maticBalance, 'ether');
        maticBalance = parseFloat(maticBalance).toFixed(4);

        res.status(200).json({data: maticBalance, error: null});
    } catch (error) {
        res.status(400).json({data: null, error: error.toString()});
    }
}

exports.transfer =  async (req, res) => {
    const client = await pgPool.connect();
    try{
        console.log(req.body);
        // convert ether to wei using web3
        let from = req.body.from;
        let to = req.body.to;
        let amount = req.body.amount;

        amount = web3.utils.toWei(amount, 'ether');
        console.log({amount});
        const txObj = {
            from: from,
            to: to,
            value: amount,
            gas: 21000,
            gasPrice: 10000000000
        }
        //console.log({txObj});
        // import seed phrase here

        let seedPhrase = encrypt.encryptWithAES(req.body.ciphertext);
               
        let pk = await getPkFromSeed(seedPhrase);
    
        console.log({pk});
        if(pk != null){
            const signedTx = await web3.eth.accounts.signTransaction(txObj, pk);
        
            console.log("check point");
            const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            const getWalletInfo = `
            INSERT INTO core.wallet_spending_history
            (user_id, amount, "token", transfer, hash, status)
            VALUES( '${req.body.user_id}', ${req.body.amount}, 'matic', 'IN', '${receipt.transactionHash}', 'Done') returning *`;
            const wallet_spendingRes = await client.query(getWalletInfo); 

            const updateWalletInfo = `
            update core.wallet_spending set matic = matic+${req.body.amount} where user_id = '${req.body.user_id}'`;
            const updateWalletInfoRes = await client.query(updateWalletInfo); 
            

            res.json({data: receipt.transactionHash , error: null,"wallet":wallet_spendingRes.rows[0]});
           
        } else {
            res.status(402).json({data:null, error:"seed phrase or private key fetch failed/invalid"})
        }

    }catch(e){
        console.log(e);
        res.json({error: e.toString(), data: null});
    } finally {
        client.release();
    }
}


exports.sendMatic =  async (req, res) => {
    const client = await pgPool.connect();
    try{
        console.log(req.body);
        // convert ether to wei using web3
        let from = req.body.from;
        let to = req.body.to;
        let amount = req.body.amount;

        amount = web3.utils.toWei(amount, 'ether');
        console.log({amount});
        const txObj = {
            from: from,
            to: to,
            value: amount,
            gas: 21000,
            gasPrice: 10000000000
        }
        //console.log({txObj});
        // import seed phrase here

        let seedPhrase = encrypt.encryptWithAES(req.body.ciphertext);
               
        let pk = await getPkFromSeed(seedPhrase);
    
        console.log({pk});
        if(pk != null){
            const signedTx = await web3.eth.accounts.signTransaction(txObj, pk);
            console.log("check point");
            const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
          
            res.json({data: receipt.transactionHash , error: null});
           
        } else {
            res.status(402).json({data:null, error:"seed phrase or private key fetch failed/invalid"})
        }

    }catch(e){
        console.log(e);
        res.json({error: e.toString(), data: null});
    } finally {
        client.release();
    }
}