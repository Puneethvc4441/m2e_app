const router = require("express").Router(); 
const {safeMint,nftBalance} = require("./helpers/mintingHelpers.js"); 
 
router.route("/mint")
    .post(safeMint);

router.route("/data")
.post(nftBalance)

module.exports = router;