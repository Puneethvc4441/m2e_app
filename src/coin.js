const router = require("express").Router(); 
const {balance, transfer, sendMatic} = require("./helpers/coinHelpers.js"); 
 
router.route("/balance") 
    .post(balance);

router.route("/transfer")
    .post(transfer);
    router.route("/sendMatic")
    .post(sendMatic);

module.exports = router;