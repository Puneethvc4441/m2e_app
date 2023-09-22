const router = require("express").Router(); 
const {swap, transferTokenOrCoin, getPrice, createWallet} = require("./helpers/walletHelpers.js"); 
const {verifySeedPhrase} = require('./helpers/web3Helper');
//const { verifyJWT } = require("../helpers/googleHelper");
 
router.route("/swap")
    .post(swap);

router.route("/transfer")
    .post(transferTokenOrCoin);

router.route("/price")
    .post(getPrice);

router.route("/create")
    .get(createWallet);

router.route("/verifySeed")
    .post(verifySeedPhrase);

module.exports = router;