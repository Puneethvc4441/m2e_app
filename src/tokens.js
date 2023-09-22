const router = require("express").Router(); 
const {tokenGetMethod, tokenBalance, tokenSetMethod, sendToken} = require("./helpers/tokenHelpers.js"); 
 
router.route("/get") 
    .post(tokenGetMethod);

router.route("/balance")
    .post(tokenBalance);

router.route("/set")
    .post(tokenSetMethod);

    router.route("/sendToken")
    .post(sendToken);

module.exports = router;