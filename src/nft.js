const router = require("express").Router();
const dotenv = require("dotenv");

//import fetch from 'node-fetch'
const pg = require("pg");
const Pool = pg.Pool;
const DATABASE_OPTIONS = require("../config.js");
const { verifyJWT } = require("../helpers/googleHelper");
const pgPool = new Pool(DATABASE_OPTIONS);

dotenv.config();


router.route("/getOwnedNft").post(async (req, res) => {
  const client = await pgPool.connect();

  try {
    const getNftQuery = `select * from core.nft  where id in (select nft_id  from core.nft_owner_info where owner_id ='${req.body.user_id}' ) ;`
    let result = await client.query(getNftQuery);
    res.status(200).send(result.rows)

  } catch (e) {
    console.log(e)
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});



router.route("/sell").post(async (req, res) => {
  const client = await pgPool.connect();

  try {
    
    const checkOrder = `select * from core.market_place  where owner_id='${req.body.user_id}' and nft_id ='${req.body.nft_id}'`
    // console.log(checkOrder)
    let checkOrderRes = await client.query(checkOrder);
    // console.log(checkOrderRes.rows.length >0)
if(checkOrderRes.rows.length >0){
   res.status(400).send({"data":"Already sell order was there"})

}else{
  const sellNftQuery = ` INSERT INTO core.market_place
    ( owner_id, nft_id, price)
    VALUES( '${req.body.user_id}' , '${req.body.nft_id}', ${req.body.price});`
    let result = await client.query(sellNftQuery);

    const UpdateNftQuery = ` update core.nft set for_sale = true where id ='${req.body.nft_id}';`
    let sellNftQueryRes = await client.query(UpdateNftQuery);
    res.status(200).send({"data":"Order placed Successfully"})
}
  

  } catch (e) {
    console.log(e)
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});


router.route("/revokeSell").post(async (req, res) => {
  const client = await pgPool.connect();

  try {
   

  const sellNftQuery = ` delete from core.market_place where nft_id = '${req.body.nft_id}';`
    let result = await client.query(sellNftQuery);

    const UpdateNftQuery = ` update core.nft set for_sale = false where id ='${req.body.nft_id}';`
    let sellNftQueryRes = await client.query(UpdateNftQuery);
    res.status(200).send({"data":"Order revoked Successfully"})

  

  } catch (e) {
    console.log(e)
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});


router.route("/saleInfo").post(async (req, res) => {
  const client = await pgPool.connect();

  try {
   

  const sellNftQuery = ` select id as order_id,price,created_on,nft_id from core.market_place where nft_id = '${req.body.nft_id}';`
    let result = await client.query(sellNftQuery);

    
    res.status(200).send({"data": result.rows[0]})

  

  } catch (e) {
    console.log(e)
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});

router.route("/updateSaleOrder").post(async (req, res) => {
  const client = await pgPool.connect();

  try {
   

  const sellNftQuery = `update core.market_place set price=${req.body.price},created_on =now ()  where id = '${req.body.order_id}';`
    let result = await client.query(sellNftQuery);

    
    res.status(200).send({"data": "Sale order changed successfully"})

  

  } catch (e) {
    console.log(e)
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});




router.route("/getListedNft").post(async (req, res) => {
  const client = await pgPool.connect();

  try {
    
    const checkOrder = `select nft.id as nft_id, nft.token_id,nft.filename,nft.class,nft.quality, nft.level,nft.shoe_mint ,mp.price,mp.id as order_id
    FROM core.nft nft 
    JOIN core.market_place mp  ON nft.id = mp.nft_id  where mp.owner_id  !='${req.body.user_id}'`
    // console.log(checkOrder)
    let checkOrderRes = await client.query(checkOrder);
    // console.log(checkOrderRes.rows.length >0)

    res.status(200).send({"data": checkOrderRes.rows})

  

  } catch (e) {
    console.log(e)
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});



router.route("/buy").post(async (req, res) => {
  const client = await pgPool.connect();

  try {
    const getOrderInfo = `select * from core.market_place  where id ='${req.body.order_id}'`
    const getOrderInfoRes = await client.query(getOrderInfo);
    const getOrderInfoResult =getOrderInfoRes.rows[0];
    

    const checkBalance = `select hlth from core.wallet_spending  where user_id ='${req.body.user_id}'`
// console.log(checkBalance)
    let checkBalanceRes = await client.query(checkBalance);
    // console.log(checkOrderRes.rows.length >0)
let wallet_res = checkBalanceRes.rows[0]
// console.log(wallet_res)
 
    if (wallet_res["hlth"] < parseInt(getOrderInfoResult.price)){
      res.json({error: "Insufficient token balance in your account", response: null});
    }
else{

  const updateWalletInfo = `
  update core.wallet_spending set hlth = hlth-${getOrderInfoResult.price} where user_id = '${req.body.user_id}'`;
  // console.log(updateWalletInfo)
  const updateWalletInfoRes = await client.query(updateWalletInfo); 

  const updateNftOwnerInfo = `
  update core.nft_owner_info  set owner_id  = '${req.body.user_id}'  , owner_wallet_address ='${req.body.address}' where nft_id  = '${getOrderInfoResult.nft_id}'`;

  const updateNftOwnerInfoRes = await client.query(updateNftOwnerInfo); 

  const deleteRecordMarket = `
  delete from core.market_place  where id ='${req.body.order_id}'`;

  const deleteRecordMarketRes = await client.query(deleteRecordMarket); 
    res.status(200).send({"data":"Order placed Successfully"})
}
  

  } catch (e) {
    console.log(e)
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});


router.route("/levelUpCostInfo").post(async (req, res) => {
  const client = await pgPool.connect();

  try {
   let level = parseInt(req.body.level)+1

  const sellNftQuery = `select hlth,run from core.level_price where level= ${level};`
    let result = await client.query(sellNftQuery);

    
    res.status(200).send({"data": result.rows[0]})

  

  } catch (e) {
    console.log(e)
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});




router.route("/levelUp").post(async (req, res) => {
  const client = await pgPool.connect();

  try {
    let level = parseInt(req.body.level)+1
    const getOrderInfo = `select hlth,run from core.level_price where level= ${level}`
    console.log(getOrderInfo)
    const getOrderInfoRes = await client.query(getOrderInfo);
    const getOrderInfoResult =getOrderInfoRes.rows[0];
    

    const checkBalance = `select hlth,runn from core.wallet_spending  where user_id ='${req.body.user_id}'`
// console.log(checkBalance)
    let checkBalanceRes = await client.query(checkBalance);
    // console.log(checkOrderRes.rows.length >0)
let wallet_res = checkBalanceRes.rows[0]
// console.log(wallet_res["hlth"])
 
    if ((wallet_res["hlth"] < parseInt(getOrderInfoResult.hlth)) || wallet_res["runn"] < parseInt(getOrderInfoResult.run)){
      res.json({error: "Insufficient token balance in your account", response: null});
    }
else{

  const updateWalletInfo = `
  update core.wallet_spending set hlth = hlth-${getOrderInfoResult.hlth} ,runn = runn-${getOrderInfoResult.run}where user_id = '${req.body.user_id}'`;
  // console.log(updateWalletInfo)
  const updateWalletInfoRes = await client.query(updateWalletInfo); 
console.log("here")
  const updateNftOwnerInfo = `
  update core.nft  set level  = 'level'   where id  = '${req.body.nft_id}'`;

  const updateNftOwnerInfoRes = await client.query(updateNftOwnerInfo); 

    res.status(200).send({"data":"Level Updated Successfully"})
}
  

  } catch (e) {
    console.log(e)
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});
module.exports = router;

