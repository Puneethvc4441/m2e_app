const {web3, networkId, getPkFromSeed} = require('./web3Helper');
const {runContract, hlthContract, wMaticContract} = require('./contract/tokens');
const {hlthRunWallet} = require('./contract/wallet'); 
const encrypt = require('../../helpers/encryption');

async function getAddresses(tokenIn, tokenOut) {

    let addressIn;
    let addressOut;
    let addressMiddle;
    let isSingleHop = true;

    console.log(tokenIn, hlthContract.options.address);

    if (tokenIn == "hlth" && tokenOut == "run") {
        addressIn = hlthContract.options.address;
        addressOut = runContract.options.address;
    } else if (tokenIn == "run" && tokenOut == "hlth") {
        addressIn = runContract.options.address;
        addressOut = hlthContract.options.address;
     } else if (tokenIn == "matic" && tokenOut == "hlth") {
        addressIn = wMaticContract.options.address;
        addressOut = hlthContract.options.address;
    } else if (tokenIn == "hlth" && tokenOut == "matic") {
        addressIn = hlthContract.options.address;
        addressOut = wMaticContract.options.address;
    } else if (tokenIn == "matic" && tokenOut == "run") {
        addressIn = wMaticContract.options.address;
        addressOut = runContract.options.address;
        addressMiddle = hlthContract.options.address;
        isSingleHop = false;
    } else if (tokenIn == "run" && tokenOut == "matic") {
        addressIn = runContract.options.address;
        addressOut = wMaticContract.options.address;
        addressMiddle = hlthContract.options.address;
        isSingleHop = false;
    }
 
    const address = {
        in: addressIn,
        out: addressOut,
        middle: addressMiddle,
        isSingleHop: isSingleHop
    }
    return address;
}

async function swapTokens(from, address, amountIn, ciphertext) { 
    try{ 
    let txObj; 
    // console.log('swapTokens', hlthRunWallet.options.address) ;
    if(address.isSingleHop == true) {
        txObj = await hlthRunWallet.methods.swapExactInputSingleHop(amountIn, address.in, address.out);
    } else {
        console.log(hlthRunWallet.methods);
        txObj = await hlthRunWallet.methods.swapExactInputMultiHop(amountIn, address.in, address.middle, address.out);

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
        const txObj1 = {
              to: hlthRunWallet.options.address,
              data,  
              gas,
              gasPrice,
              chainId: networkId
            }
        
     // import seed phrase here
     let seedPhrase = encrypt.encryptWithAES(ciphertext);
               
        let pk = await getPkFromSeed(seedPhrase);
     if(pk != null){    
        const signature = await web3.eth.accounts.signTransaction(txObj1,pk);
        console.log("signature---");
        let receipt = await web3.eth.sendSignedTransaction(signature.rawTransaction) 
        return{data: receipt.transactionHash , error: null};
        // console.log("receipt----", receipt);
    }else {
            res.status(402).json({data:null, error:"seed phrase or private key fetch failed/invalid"})
        }   
    } 
    }catch (error) {
        console.log("asskasdk");
        return{error: error.toString(), response: null};
    }

}

async function approveTokens(from, address, amountIn, ciphertext) { 
 try{ 
   
    if(address.in == wMaticContract.options.address) {
        tokenInstance = wMaticContract;
        
    } else if(address.in == hlthContract.options.address) {
        tokenInstance = hlthContract;
        
    } else if(address.in == runContract.options.address) {
        tokenInstance = runContract;
    }
   
    const txObj = await tokenInstance.methods.approve(hlthRunWallet.options.address, amountIn);
    
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
            to: tokenInstance.options.address,
            data,  
            gas,
            gasPrice,
            chainId: networkId
          };    
        
    
     // import seed phrase here
     let seedPhrase = encrypt.encryptWithAES(ciphertext);
               
        let pk = await getPkFromSeed(seedPhrase);
     if(pk != null){    
     const signature = await web3.eth.accounts.signTransaction(txObj2, pk);
        
        let receipt = await web3.eth.sendSignedTransaction(signature.rawTransaction) 
        // console.log("receipt----", receipt);
        console.log('approve token done')
        return{data: receipt.transactionHash , error: null};
        }else {
            res.status(402).json({data:null, error:"seed phrase or private key fetch failed/invalid"})
        }
    }
    } catch (error) {
        return{error: error.toString(), data: null};
    }

}

async function getBalances(from, address, beforeSwap) {
    let swap;
    if(beforeSwap == true) {
        swap = "before swap";
    } else {
        swap = "after swap";
    }
    if(address.in == hlthContract.options.address || address.out == hlthContract.options.address) {
        let hlthBalance = await hlthContract.methods.balanceOf(from).call();
        hlthBalance = await web3.utils.fromWei(hlthBalance, 'ether');
        console.log(`hlth balance : ( ${swap} )` + hlthBalance);
    }
    
    if(address.in == runContract.options.address || address.out == runContract.options.address) {
        let runBalance = await runContract.methods.balanceOf(from).call();
        runBalance = await web3.utils.fromWei(runBalance, 'ether');
        console.log(`run balance : ( ${swap} )` + runBalance);
    }

    if(address.in == wMaticContract.options.address || address.out == wMaticContract.options.address) {
        let maticBalance = await web3.eth.getBalance(from);
        maticBalance = await web3.utils.fromWei(maticBalance, 'ether');
        console.log(`matic balance : ( ${swap} )` + maticBalance);
    }
}

module.exports = { swapTokens, approveTokens, getBalances, getAddresses };