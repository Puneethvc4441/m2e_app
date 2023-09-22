const router = require("express").Router(); 
const {createMarketItem,getListedItemDetails,approveNFT} = require("./helpers/marketHelpers.js"); 
const {verifySeedPhrase} = require('./helpers/web3Helper');
//const { verifyJWT } = require("../helpers/googleHelper");
 
router.route("/approveNFT")
    .post(approveNFT);

router.route("/createMarketIteam")
    .post(createMarketItem);

router.route("/getListedItemDetails")
    .post(getListedItemDetails);



module.exports = router;