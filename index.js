const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const multer = require("multer");
const uploadMulter = multer();
dotenv.config();
const userApi = require("./src/users.js");
const googleFitApi = require("./src/google-fit");
const emailVerificationApi = require("./src/email-verification");
const ethereum = require("./src/ethereum");
const upload = require("./src/upload");
const run = require("./src/run-with-friends");
const auth = require("./src/authentication");
const localSensors = require("./src/local-sensor");
const passport = require("passport");
const shop = require("./src/shop");

const tokens = require("./src/tokens");
const wallet = require("./src/wallet");
const coin = require("./src/coin");
const nftMint = require("./src/nftMint");
const nftInfo = require("./src/nft");
const marketPlace = require("./src/marketplace")


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(uploadMulter.none());
require("./src/config/passport")(passport);
app.use(passport.initialize());

app.use("/users", userApi);
app.use("/google-fit", googleFitApi);
app.use("/email-verify", emailVerificationApi);
app.use("/ethereum", ethereum);
app.use("/upload", upload);
app.use("/run", run);
app.use("/auth", auth);
app.use("/raw", localSensors);
app.use("/shop", shop);

app.use("/token", tokens);
app.use("/wallet", wallet);
app.use("/coin", coin);
app.use("/nft",nftMint)
app.use("/sneaker",nftInfo)
app.use("/marketplace",marketPlace)


app.use("*", (req, res) => {
  res.status(404).send(`${req.originalUrl} not found on this server`);
});

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`Server is running and listening on ${port}`)
);
