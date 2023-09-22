const router = require("express").Router();
const dotenv = require("dotenv");
const { generateMnemonic, EthHdWallet } = require("eth-hd-wallet");
const Web3 = require("web3");
const passport = require("passport");
const BigNumber = require("bignumber.js");
const fetch = require("node-fetch");
//import fetch from 'node-fetch'
const pg = require("pg");
const Pool = pg.Pool;
const DATABASE_OPTIONS = require("../config.js");
const { verifyJWT } = require("../helpers/googleHelper");
const pgPool = new Pool(DATABASE_OPTIONS);
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const { simpleEmail } = require("../helpers/emailSender.js");
const util = require("util");

const sendSimpleEmail = util.promisify(simpleEmail);

dotenv.config();

function web3BNToFloatString(
  bn,
  divideBy,
  decimals,
  roundingMode = BigNumber.ROUND_DOWN
) {
  const converted = new BigNumber(bn.toString());
  const divided = converted.div(divideBy);
  return divided.toFixed(decimals, roundingMode);
}

router.route("/test").get((req, res) => {
  res.send("Working");
});

router.route("/wallet").get(verifyJWT, (req, res) => {
  const mne = generateMnemonic();
  console.log(mne);

  const wallet = EthHdWallet.fromMnemonic(mne);

  const addresses = wallet.generateAddresses(1);
  res.status(201).send({ seed: mne, firstAddress: addresses[0] });
});

router.route("/wallet").post(verifyJWT, async (req, res) => {
  //logic to save address against user

  const { user_id, wallet_address } = req.body;
  const client = await pgPool.connect();

  try {
    const updateWalletAddressQuery = `update core.user set wallet_address ='${wallet_address}' where id ='${user_id}'`;
    await client.query(updateWalletAddressQuery);
    res.status(200).send({ wallet_address });
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/balance/:address").get(verifyJWT, async (req, res) => {
  const { address } = req.params;

  try {
    const erc20abi = [
      {
        constant: true,
        inputs: [],
        name: "name",
        outputs: [{ name: "", type: "string" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { name: "_spender", type: "address" },
          { name: "_value", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "totalSupply",
        outputs: [{ name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { name: "_from", type: "address" },
          { name: "_to", type: "address" },
          { name: "_value", type: "uint256" },
        ],
        name: "transferFrom",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", type: "string" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { name: "_to", type: "address" },
          { name: "_value", type: "uint256" },
        ],
        name: "transfer",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: true,
        inputs: [
          { name: "_owner", type: "address" },
          { name: "_spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      { payable: true, stateMutability: "payable", type: "fallback" },
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: "owner", type: "address" },
          { indexed: true, name: "spender", type: "address" },
          { indexed: false, name: "value", type: "uint256" },
        ],
        name: "Approval",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: "from", type: "address" },
          { indexed: true, name: "to", type: "address" },
          { indexed: false, name: "value", type: "uint256" },
        ],
        name: "Transfer",
        type: "event",
      },
    ];
    const url =
      "https://HLTH:789Forest@apis.ankr.com/9950f8d50d4b4cf48c8cd66fc544a31b/db2ee6d2208b14f582ce09cbc7811f74/binance/full/main"; // url string

    const web3 = new Web3(new Web3.providers.HttpProvider(url));

    const contract = new web3.eth.Contract(
      erc20abi,
      "0xE547715BA1A398c0022f49A0c233CEb8e09ad3b1"
    );

    const bn = await contract.methods.balanceOf(address).call();

    const pow = new BigNumber("10").pow(new BigNumber(18));
    const balance = web3BNToFloatString(bn, pow, 4, BigNumber.ROUND_DOWN);

    //associate address with user
    res.status(201).send({ balance });
  } catch (e) {
    console.log(e);
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    //client.release();
  }
});

router.route("/txnlist/:address").get(verifyJWT, async (req, res) => {
  const { address } = req.params;

  try {
    //const fetch = require("node-fetch");
    const response = await fetch(
      `https://api.bscscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=YourApiKeyToken&page=1&offset=4`
    );
    const body = await response.json();

    console.log(body.result.length);

    /*for (let tx of body.result) {
      console.log(tx.hash, " ,FROM::", tx.from, " ,TO::", tx.to);
      console.log("");
    }*/
    res.status(201).send({ txs: body.result });
  } catch (e) {
    console.log(e);
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    //client.release();
  }
});

router.route("/claim").post(verifyJWT, async (req, res) => {
  //logic to update user rewards
  //columns in user_token
  //current_tokens
  //total_tokens
  //current_distance

  //Logic
  //If current_distance < 10 ,return
  //else add to total_tokens, minus 10 from current_distance

  //reward/km =(((y1000)p))Δ

  const { user_id } = req.body;
  const client = await pgPool.connect();

  try {
    const userTokenQuery = `select total_tokens,current_distance from core.user_token where user_id ='${user_id}'`;
    const userTokenQueryRes = await client.query(userTokenQuery);

    /*const userCurrentDayClaimQuery = `select created_at from core.token_history where user_id ='${user_id}' and description = 'CLAIMED' and created_at::date = current_date`;
    const userCurrentDayClaimQueryRes = await client.query(
      userCurrentDayClaimQuery
    );*/

    if (
      userTokenQueryRes.rows.length > 0
      //&&
      //userCurrentDayClaimQueryRes.rows.length === 0
    ) {
      let currentDistance = Number(userTokenQueryRes.rows[0].current_distance);
      let totalTokens = Number(userTokenQueryRes.rows[0].total_tokens);
      const priceQuery = `select last_token_price,ecpm from core.prices`;
      const priceQueryRes = await client.query(priceQuery);

      let eCPM = Number(priceQueryRes.rows[0].ecpm);
      let TOKEN_PRICE_YESTERDAY = Number(
        priceQueryRes.rows[0].last_token_price
      );

      if (currentDistance >= 1) {
        /*let y = 1;
        let CPC = 1.2;
        let token_price = 0.01;
        const tokens_added =
          (((y * ((CPC * 1000) / 1000)) / token_price) * 0.6) / 10;*/

        // let ADS_BEFORE_CLAIM = 1;
        //let eCPM = 1.2;
        //let TOKEN_PRICE_YESTERDAY = 0.01;
        // let REWARD_PERC = Number(process.env.REWARD_PERC || 0.6); //Need to come from ENV
         let KMs_BEFORE_REWARD = currentDistance ;

        const tokens_per_km = 1
          // (((ADS_BEFORE_CLAIM * (eCPM / 100)) / TOKEN_PRICE_YESTERDAY) *
          //   REWARD_PERC) %
          // KMs_BEFORE_REWARD;

        const tokens_added = tokens_per_km * currentDistance;

        const tokenUpdateQuery = `update core.user_token set total_tokens =${
          totalTokens + tokens_added
        }
        ,current_distance = ${currentDistance - Number(KMs_BEFORE_REWARD)}
        where user_id ='${user_id}'`;
        await client.query(tokenUpdateQuery);

        const historyUpdateQuery = `insert into core.token_history(user_id,created_at,tokens_moved, description) values ('${user_id}','${new Date().toISOString()}',${tokens_added},'CLAIMED')`;
        await client.query(historyUpdateQuery);

        const distanceQuery = `select total_distance ,(total_distance - current_distance) as rewarded_distance from core.user_token ut where user_id ='${user_id}'`;
        const distanceQueryRes = await client.query(distanceQuery);

        let totalDistanceRecorded = 0;
        let totalDistanceRewarded = 0;

        if (distanceQueryRes.rows.length > 0) {
          totalDistanceRecorded = distanceQueryRes.rows[0].total_distance || 0;
          totalDistanceRewarded =
            distanceQueryRes.rows[0].rewarded_distance || 0;
        }
        res.status(200).send({
          totalTokens: totalTokens + tokens_added ,
          status: "Claimed",
          totalDistanceRecorded,
          totalDistanceRewarded,
        });
      } else {
        res.status(200).send({
          totalTokens,
          status: "You have already claimed the rewards",
        });
      }
    } else {
      res
        .status(200)
        .send({ totalTokens: 0, status: "Please run to claim rewards" });
    }
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/transfer").post(verifyJWT, async (req, res) => {
  if (process.env.TRANSFER_AVAILABLE === "false") {
    res.status(404).send("Transfer not available");
  } else {
    const { user_id, amount } = req.body;
    const client = await pgPool.connect();

    try {
      const userTokenQuery = `select total_tokens,current_distance from core.user_token where user_id ='${user_id}'`;
      const userTokenQueryRes = await client.query(userTokenQuery);

      if (userTokenQueryRes.rows.length > 0) {
        //let currentDistance = Number(userTokenQueryRes.rows[0].current_distance);
        let totalTokens = Number(userTokenQueryRes.rows[0].total_tokens);
        let tokens_to_transfer = Number(amount);

        if (amount === "-1") tokens_to_transfer = totalTokens;

        if (totalTokens >= tokens_to_transfer && tokens_to_transfer !== 0) {
          const tokenUpdateQuery = `update core.user_token set total_tokens =${
            totalTokens - tokens_to_transfer
          }  where user_id ='${user_id}'`;
          await client.query(tokenUpdateQuery);

          const historyUpdateQuery = `insert into core.token_history(user_id,created_at,tokens_moved, description) values ('${user_id}','${new Date().toISOString()}',${tokens_to_transfer},'TRANSFERRED')`;
          await client.query(historyUpdateQuery);
          res.status(200).send({
            tokensTransferred: 0,
            status: "Transferred",
          });
        } else {
          res
            .status(200)
            .send({ tokensTransferred: 0, status: "Not enough tokens" });
        }
      } else {
        res
          .status(200)
          .send({ tokensTransferred: 0, status: "Not enough tokens" });
      }
    } catch (e) {
      res.status(500).send({
        code: 500,
        error: e.message,
        status: "Server Error",
      });
    } finally {
      if (client) client.release();
    }
  }
});

router.route("/userhistory/:user_id").get(async (req, res) => {
  const { user_id } = req.params;

  console.log(user_id);

  const { offset: dataStartingIndex } = req.query;

  const offset = dataStartingIndex ? Number(dataStartingIndex) : 0;

  console.log(req.params);
  const client = await pgPool.connect();

  try {
    let totalRecords = 0;

    let historyCountQuery = `select  count(user_id) as total_history from core.token_history where user_id ='${user_id}' `;

    historyCountQueryRes = await client.query(historyCountQuery);

    totalRecords = Number(historyCountQueryRes.rows[0].total_historys);

    // res.status(200).send({
    //   history: null,
    //   status: "offset greater than no of records",
    // });

    const userWalletQuery = `select wallet_address from core.user where id ='${user_id}' `;
    const userWalletQueryRes = await client.query(userWalletQuery);
    const userWalletAddress = userWalletQueryRes.rows[0].wallet_address;
    let balance = "0.0";
    if (userWalletAddress !== null) {
      const erc20abi = [
        {
          constant: true,
          inputs: [],
          name: "name",
          outputs: [{ name: "", type: "string" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
        {
          constant: false,
          inputs: [
            { name: "_spender", type: "address" },
            { name: "_value", type: "uint256" },
          ],
          name: "approve",
          outputs: [{ name: "", type: "bool" }],
          payable: false,
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          constant: true,
          inputs: [],
          name: "totalSupply",
          outputs: [{ name: "", type: "uint256" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
        {
          constant: false,
          inputs: [
            { name: "_from", type: "address" },
            { name: "_to", type: "address" },
            { name: "_value", type: "uint256" },
          ],
          name: "transferFrom",
          outputs: [{ name: "", type: "bool" }],
          payable: false,
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          constant: true,
          inputs: [],
          name: "decimals",
          outputs: [{ name: "", type: "uint8" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
        {
          constant: true,
          inputs: [{ name: "_owner", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "balance", type: "uint256" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
        {
          constant: true,
          inputs: [],
          name: "symbol",
          outputs: [{ name: "", type: "string" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
        {
          constant: false,
          inputs: [
            { name: "_to", type: "address" },
            { name: "_value", type: "uint256" },
          ],
          name: "transfer",
          outputs: [{ name: "", type: "bool" }],
          payable: false,
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          constant: true,
          inputs: [
            { name: "_owner", type: "address" },
            { name: "_spender", type: "address" },
          ],
          name: "allowance",
          outputs: [{ name: "", type: "uint256" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
        { payable: true, stateMutability: "payable", type: "fallback" },
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: "owner", type: "address" },
            { indexed: true, name: "spender", type: "address" },
            { indexed: false, name: "value", type: "uint256" },
          ],
          name: "Approval",
          type: "event",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: "from", type: "address" },
            { indexed: true, name: "to", type: "address" },
            { indexed: false, name: "value", type: "uint256" },
          ],
          name: "Transfer",
          type: "event",
        },
      ];
      const url =
        "https://HLTH:789Forest@apis.ankr.com/9950f8d50d4b4cf48c8cd66fc544a31b/db2ee6d2208b14f582ce09cbc7811f74/binance/full/main"; // url string

      const web3 = new Web3(new Web3.providers.HttpProvider(url));

      const contract = new web3.eth.Contract(
        erc20abi,
        "0xE547715BA1A398c0022f49A0c233CEb8e09ad3b1"
      );

      try {
        const bn = await contract.methods.balanceOf(userWalletAddress).call();

        const pow = new BigNumber("10").pow(new BigNumber(18));
        balance = web3BNToFloatString(bn, pow, 4, BigNumber.ROUND_DOWN);
      } catch (e) {}
    }

    if (totalRecords === 0 || offset >= totalRecords) {
      res.status(200).send({ balance, history: [], userWalletAddress });
    } else {
      const userTokenHisotryQuery = `select user_id,created_at,tokens_moved, description from core.token_history where user_id ='${user_id}' order by created_at desc limit 10 offset ${offset}`;
      console.log(userTokenHisotryQuery);
      const userTokenHisotryQueryRes = await client.query(
        userTokenHisotryQuery
      );

      if (userTokenHisotryQueryRes.rows.length > 0) {
        let history = [];

        for (let i = 0; i < userTokenHisotryQueryRes.rows.length; i++) {
          let { tokens_moved, description, created_at } =
            userTokenHisotryQueryRes.rows[i];
          let createdAt = moment(created_at)
            .locale("en")
            .format("MMMM Do YYYY, hh:mm a");

          history.push({ tokens_moved, description, created_at: createdAt });
        }

        res.status(200).send({
          balance,
          history,
          userWalletAddress,
        });
      } else {
        res.status(200).send({ balance, history: [], userWalletAddress });
      }
    }
  } catch (e) {
    console.log(e);
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/getDistance").post(verifyJWT, async (req, res) => {
  const { user_id } = req.body;

  const client = await pgPool.connect();
  try {
    const distanceQuery = `select current_distance,total_distance as totalDistanceRecorded ,(total_distance - current_distance) as totalDistanceRewarded from core.user_token ut where user_id ='${user_id}'`;
    const distanceQueryRes = await client.query(distanceQuery);

    if (distanceQueryRes.rows.length > 0) {
      totalDistanceRecorded = distanceQueryRes.rows[0].total_distance || 0;
      totalDistanceRewarded = distanceQueryRes.rows[0].rewarded_distance || 0;
    }

    res.status(201).send({ data: distanceQueryRes.rows[0] });
  } catch (e) {
    console.log(e);
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    //client.release();
  }
});

router.route("/stake").post(verifyJWT, async (req, res) => {
  const { user_id, tokens, staking_type } = req.body;

  if (!process.env[staking_type] || !process.env[`${staking_type}_REWARD`]) {
    res.status(200).send({
      totalTokens: 0,
      status: "Invalid staking type",
    });
    return;
  }
  const days = Number(process.env[staking_type]);
  const rewardmultipler = Number(process.env[`${staking_type}_REWARD`]);
  const client = await pgPool.connect();

  try {
    const userTokenQuery = `select total_tokens,current_distance from core.user_token where user_id ='${user_id}'`;
    const userTokenQueryRes = await client.query(userTokenQuery);

    if (userTokenQueryRes.rows.length > 0) {
      //let currentDistance = Number(userTokenQueryRes.rows[0].current_distance);
      let totalTokens = Number(userTokenQueryRes.rows[0].total_tokens);
      let tokensToStake = Number(tokens);
      if (!tokens || tokens === "-1") tokensToStake = totalTokens;

      if (tokensToStake === 0) {
        res.status(200).send({
          totalTokens: 0,
          status: "You can't stake 0 tokens",
        });
      } else if (tokensToStake <= totalTokens) {
        //Subtravting tokens which are to go to staking
        const tokenUpdateQuery = `update core.user_token set total_tokens =${
          totalTokens - tokensToStake
        }  where user_id ='${user_id}'`;
        await client.query(tokenUpdateQuery);

        //insert tokens into staking table
        let staking_id = uuidv4();
        const stakeInsertQuery = `insert into core.staking(id, user_id,tokens,created_at,days, reward_multiplier) values ('${staking_id}','${user_id}',${tokensToStake},'${new Date().toISOString()}',${days},${rewardmultipler})`;
        await client.query(stakeInsertQuery);

        //insert staking info into stake_history table
        const stakeHistoryInsertQuery = `insert into core.stake_history(user_id, staking_id, created_at, tokens_moved, description,days, reward_multiplier) values ('${user_id}','${staking_id}','${new Date().toISOString()}',${tokensToStake},'STAKED',${days},${rewardmultipler})`;
        await client.query(stakeHistoryInsertQuery);
        res.status(200).send({
          tokensStaked: tokensToStake,
          staking_id,
          status: "Staked",
        });
      } else {
        res.status(200).send({
          totalTokens: 0,
          status: "Staking tokens are less than the token balance",
        });
      }
    } else {
      res
        .status(200)
        .send({ totalTokens: 0, status: "You don't have any tokens to stake" });
    }
  } catch (e) {
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});

//GF1, unstake with rewards
router.route("/unstakeall").post(verifyJWT, async (req, res) => {
  const client = await pgPool.connect();
  try {
    //Adding tokens to user tokens coming from staking
    const tokenUpdateQuery = `UPDATE core.user_token AS a
    SET total_tokens = total_tokens + b.tokens
    FROM 
        (
            SELECT user_id , SUM(tokens * reward_multiplier) as tokens
            FROM core.staking 
            where created_at::date < current_date - days
            GROUP BY user_id 
        ) b
    WHERE a.user_id = b.user_id`;
    //or shouldUnstake is true, only staked tokens should be rewarded in that case
    //add logic if needs to be held for 10 days
    await client.query(tokenUpdateQuery);
    //insert unstaking info into stake_history table
    const unstakeHistoryInsertQuery = `INSERT INTO core.stake_history (user_id, staking_id, created_at, tokens_moved, description,days, reward_multiplier)
                  SELECT user_id, id , '${new Date().toISOString()}' , tokens, 'UNSTAKED' ,days,reward_multiplier
                  FROM core.staking b
                  WHERE b.created_at::date < current_date - b.days`;
    //or shouldUnstake is true
    await client.query(unstakeHistoryInsertQuery);
    //delete already rewarded staking from staking table
    const stakeRemovalQuery = `delete from core.staking where created_at::date < current_date - days`;
    await client.query(stakeRemovalQuery);
    res.status(200).send({ status: "unstaked" });
  } catch (e) {
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});

router
  .route("/unstake/:user_id/:staking_id")
  .post(verifyJWT, async (req, res) => {
    const { user_id, staking_id } = req.params;
    const client = await pgPool.connect();
    try {
      //Adding tokens to user tokens coming from staking
      /*const tokenUpdateQuery = `UPDATE core.user_token AS a
    SET total_tokens = total_tokens + b.tokens
    FROM 
        (
            SELECT user_id , SUM(tokens) as tokens
            FROM core.staking 
            WHERE id = '${stake_id}'
            GROUP BY user_id 
        ) b
    WHERE a.user_id = b.user_id 
    and a.user_id  = '${user_id}'
    `;
      //or shouldUnstake is true, only staked tokens should be rewarded in that case
      //add logic if needs to be held for 10 days
      await client.query(tokenUpdateQuery);*/
      //insert unstaking info into stake_history table
      const stakeHistoryQuery = `select id from core.staking where id ='${staking_id}'`;
      const stakeHistoryQueryRes = await client.query(stakeHistoryQuery);

      if (stakeHistoryQueryRes.rows.length > 0) {
        const unstakeHistoryInsertQuery = `INSERT INTO core.stake_history (user_id, staking_id, created_at,tokens_moved, description, days,reward_multiplier)
                  SELECT user_id, id, '${new Date().toISOString()}' , tokens, 'UNSTAKE_PROCESSING',days,reward_multiplier
                  FROM core.staking b
                  WHERE b.user_id = '${user_id}'
                  and b.id = '${staking_id}'`;
        //or shouldUnstake is true
        await client.query(unstakeHistoryInsertQuery);

        const unstakeInsertQuery = `INSERT INTO core.unstaking (user_id, staking_id, created_at,tokens, days,reward_multiplier)
        SELECT user_id, id, '${new Date().toISOString()}' , tokens,  days,reward_multiplier
        FROM core.staking b
        WHERE b.user_id = '${user_id}'
        and b.id = '${staking_id}'`;
        //or shouldUnstake is true
        await client.query(unstakeInsertQuery);

        //delete from staking table so it is not picked up by first google function
        const stakeRemovalQuery = `delete from core.staking where id = '${staking_id}'`;
        await client.query(stakeRemovalQuery);

        res.status(200).send({
          status: "unstaked",
        });
      } else {
        res.status(200).send({
          status: "Staking not found",
        });
      }
    } catch (e) {
      res.status(500).send("Server Error");
    } finally {
      if (client) client.release();
    }
  });

//Google function 2
router.route("/finishunstaking").post(verifyJWT, async (req, res) => {
  const client = await pgPool.connect();
  try {
    //Adding tokens to user tokens after 10 days from manual unstaking
    const tokenUpdateQuery = `UPDATE core.user_token AS a
      SET total_tokens = total_tokens + b.tokens
      FROM 
          (
              SELECT user_id , SUM(tokens) as tokens
              FROM core.unstaking 
              where created_at::date < current_date - 10
              GROUP BY user_id 
          ) b
      WHERE a.user_id = b.user_id`;
    //or shouldUnstake is true, only staked tokens should be rewarded in that case
    //add logic if needs to be held for 10 days
    await client.query(tokenUpdateQuery);
    //insert unstaking info into stake_history table
    const unstakeHistoryInsertQuery = `INSERT INTO core.stake_history (user_id, staking_id, created_at, tokens_moved, description,days, reward_multiplier)
    SELECT user_id, staking_id , '${new Date().toISOString()}' , tokens, 'UNSTAKE_COMPLETED' ,days, reward_multiplier
    FROM core.unstaking b
    WHERE b.created_at::date < current_date - 10`;
    //or shouldUnstake is true
    await client.query(unstakeHistoryInsertQuery);
    //delete record from unstaking table after 10 days
    const stakeRemovalQuery = `delete from core.unstaking where created_at::date < current_date - 10`;
    await client.query(stakeRemovalQuery);
    res.status(200).send({ status: "unstaked" });
  } catch (e) {
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});

router.route("/stakeinfo/:user_id").get(verifyJWT, async (req, res) => {
  const { user_id } = req.params;
  const client = await pgPool.connect();
  try {
    let allStakingInfo = [];

    let ongoingStakingQuery = `select a.staking_id ,
      a.created_at as start_date ,
      a.created_at::date + a.days as redeeming_date,
      a.days as staking_period, 
      a.reward_multiplier as reward_perc,
      a.tokens_moved  as tokens_staked,
      a.tokens_moved* a.reward_multiplier as rewards ,
      'ONGOING' as status
      from core.stake_history a
      left join (
      select * from core.stake_history sh where description != 'STAKED'
      ) b
      on a.staking_id = b.staking_id
      where a.user_id = '${user_id}'
      and a.description = 'STAKED'
      and b.staking_id is null`;

    ongoingStakingQueryRes = await client.query(ongoingStakingQuery);

    allStakingInfo = allStakingInfo.concat(ongoingStakingQueryRes.rows);

    let unstakedWithRewardsQuery = `select a.staking_id ,
    a.created_at as start_date ,
    b.created_at as redeeming_date,
    a.days as staking_period, 
    a.reward_multiplier as reward_perc,
    a.tokens_moved  as tokens_staked,
    a.tokens_moved* a.reward_multiplier as rewards ,
    'REWARDED' as status
    from core.stake_history a
    left join (
    select * from core.stake_history sh where description = 'UNSTAKED'
    ) b
    on a.staking_id = b.staking_id
    where a.user_id ='${user_id}'
    and a.description = 'STAKED'`;

    let unstakedWithRewardsRes = await client.query(unstakedWithRewardsQuery);
    allStakingInfo = allStakingInfo.concat(unstakedWithRewardsRes.rows);

    let unstakedWithoutRewardsQuery = `select a.staking_id ,
    a.created_at as start_date ,
    b.created_at as redeeming_date,
    a.days as staking_period, 
    a.reward_multiplier as reward_perc,
    a.tokens_moved  as tokens_staked,
    0 as rewards ,
    'UNSTAKED_MANUALLY' as status
    from core.stake_history a
    left join (
    select * from core.stake_history sh where description = 'UNSTAKE_COMPLETED'
    ) b
    on a.staking_id = b.staking_id
    where a.user_id ='${user_id}'
    and a.description = 'STAKED'`;

    let unstakedWithoutRewardsRes = await client.query(
      unstakedWithoutRewardsQuery
    );
    allStakingInfo = allStakingInfo.concat(unstakedWithoutRewardsRes.rows);

    let unstakedAndProcessingQuery = `select a.staking_id ,
    a.created_at as start_date ,
    b.created_at::date+10 as redeeming_date,
    a.days as staking_period, 
    a.reward_multiplier as reward_perc,
    a.tokens_moved  as tokens_staked,
    0 as rewards ,
    'UNSTAKED_MANUALLY_PROCESSING' as status
    from core.stake_history a
    --check if it is processing in history but not completed
    left join (
    select * from core.stake_history sh where description = 'UNSTAKE_PROCESSING'
    and staking_id NOT IN (select staking_id from core.stake_history sh2 where description = 'UNSTAKE_COMPLETED')
    ) b
    on a.staking_id = b.staking_id
    where a.user_id ='${user_id}'
    and a.description = 'STAKED'
    and b.staking_id is not null`;

    let unstakedAndProcessingRes = await client.query(
      unstakedAndProcessingQuery
    );
    allStakingInfo = allStakingInfo.concat(unstakedAndProcessingRes.rows);

    if (allStakingInfo.length === 0) {
      res.status(200).send({
        stakings: [],
        totalTokensStaked: 0,
      });
    } else {
      let totalTokensStaked = 0;

      for (let i = 0; i < allStakingInfo.length; i++) {
        totalTokensStaked += allStakingInfo[i].tokens_staked;

        allStakingInfo[i].start_date = moment(allStakingInfo[i].start_date)
          .locale("en")
          .format("MMMM Do YYYY, hh:mm a");

        allStakingInfo[i].redeeming_date = moment(
          allStakingInfo[i].redeeming_date
        )
          .locale("en")
          .format("MMMM Do YYYY, hh:mm a");
      }
      res.status(200).send({
        stakings: allStakingInfo,
        totalTokensStaked: totalTokensStaked,
      });
    }
  } catch (e) {
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});

router.route("/holders").get(async (req, res) => {
  const client = await pgPool.connect();
  try {
    const holdersQuery = "select last_three from core.token_holders";
    const holdersQueryRes = await client.query(holdersQuery);

    let currentHolders = 0;
    let changeFromYesterday = 0;
    if (holdersQueryRes.rows.length > 0) {
      const holders_array = holdersQueryRes.rows[0].last_three;
      currentHolders =
        parseFloat(holders_array[holders_array.length - 1] / 1000).toFixed(2) +
        "K";

      //const tokenPriceUpdateQuery = `update core.prices set last_token_price ='${Number(tokenPriceBody.data.HLTH.quote.USD.price)}'`;
      //await client.query(tokenPriceUpdateQuery);
      if (holders_array.length >= 2) {
        changeFromYesterday =
          ((holders_array[holders_array.length - 1] -
            holders_array[holders_array.length - 2]) *
            100) /
          holders_array[holders_array.length - 2];
      }
    }

    res.status(200).send({
      currentHolders,
      changeFromYesterday,
    });
  } catch (e) {
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});

router.route("/addPhone").post(async (req, res) => {
  console.log("hadjbajbdf")
  //logic to save address against user

  const { phone,name,email } = req.body;
  const client = await pgPool.connect();

  try {
    const options = {
      subject: "New Phone number signup",
      text: "New Phone number signup",
      html: `<h2>New Phone number :</h2><br/><h3>${phone}</h3><br/>
      <h2>Email Id :</h2><br/><h3>${email}</h3><br/>
      <h2>Name :</h2><br/><h3>${name}</h3><br/>
      `,
    };
    if (phone.trim()) {
      const addCampaignPhoneQuery = `insert into core.campaignphones (phone, email, name)  values('${phone.trim()}','${email}','${name}')`;
      await client.query(addCampaignPhoneQuery);
      sendSimpleEmail("gourishsingla@gmail.com,sandeep@hlth.run,ritwik@hlth.run", options).then(
        res.status(200).send({ phone })
      );
    } else {
      sendSimpleEmail("gourishsingla@gmail.com,sandeep@hlth.run,ritwik@hlth.run", options).then(
        res.status(200).send({ phone })
      );
    }
  } catch (e) {
    res.status(200).send({ phone });
  } finally {
    if (client) client.release();
  }
});

router.route("/cryptoprices").get(async (req, res) => {
  try {
    const CG_endpoint =
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,tether&vs_currencies=inr";
    let priceRes = await fetch(`${CG_endpoint}`);
    
    let {
      ethereum: { inr: ethereum },
      solana: { inr: solana },
      tether: { inr: tether },
      bitcoin: { inr: bitcoin },
      binancecoin: { inr: binancecoin }

    } = await priceRes.json();

    let hlth = 0.0030
    res.status(200).send({
      bitcoin,
      ethereum,
      binancecoin,
      solana,
      tether,
      hlth:hlth*tether,
     
    });
  } catch (e) {
    console.log(e);
    res.status(500).send("Server Error");
  }
});

router.route("/cryptopricesUsd").get(async (req, res) => {
  try {
    const CG_endpoint =
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,tether&vs_currencies=usd";
    let priceRes = await fetch(`${CG_endpoint}`);
    const CG_endpoint_hlth =
    "https://api.vindax.com/api/v1/ticker/24hr?symbol=HLTHETH";
  let priceResHlth = await fetch(`${CG_endpoint_hlth}`);
  console.log(priceResHlth)

 let json =await priceResHlth.json()


    
    let {
      ethereum: { usd: ethereum },
      solana: { usd: solana },
      tether: { usd: tether },
      bitcoin: { usd: bitcoin },
      binancecoin: { usd: binancecoin }

    } = await priceRes.json();

let hlth = (json.lastPrice).toFixed(10)* ethereum
    res.status(200).send({
      bitcoin,
      ethereum,
      binancecoin,
      solana,
      tether,
     
      hlth:hlth
     
    });
  } catch (e) {
    console.log(e);
    res.status(500).send("Server Error");
  }
});



router.route("/buyToken").post(async (req, res) => {
  //logic to save address against user

  const { hlth_tokens, payment_mode, payment_amount,base_amount, email, wallet_address ,tansaction_id} = req.body;

  const client = await pgPool.connect();

  try {
    const options = {
      subject: "New Purchase order",
      text: "New Purchase order",
      html: `<h2>Purchase Order from </h2>:<h3>${email}</h3><br/>
      <h2>Number of Hlth tokens </h2>:<h3>${hlth_tokens}</h3><br/>
      <h2>Payment Mode  </h2>:<h3>${payment_mode}</h3><br/>
      <h2>Payment Amount </h2>:<h3>${payment_amount}</h3><br/>
      <h2> Wallet address</h2>:<h3>${wallet_address}</h3>`,
    };

      const addCampaignPhoneQuery = `INSERT INTO core.transaction_tokensale
      (hlth_tokens, payment_mode, base_amount, email, wallet_address,payment_amount,tansaction_id )
      VALUES(${hlth_tokens}, '${payment_mode}', ${base_amount}, '${email}', '${wallet_address}',${payment_amount},'${tansaction_id}')`;
      console.log(addCampaignPhoneQuery)
      await client.query(addCampaignPhoneQuery);
      sendSimpleEmail("gourishsingla@gmail.com,sandeep@hlth.run,ritwik@hlth.run", options).then(
        res.status(200).send("okay")
      );
   
  } catch (e) {
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});

router.route("/getDate").get(async (req, res) => {
  //logic to save address against user

  const client = await pgPool.connect();

  try {


      const addCampaignPhoneQuery = `select "end-date" as date from core.prices`;
console.log(addCampaignPhoneQuery)
      
    let result=  await client.query(addCampaignPhoneQuery);
      
    
        res.status(200).send(result.rows[0])
    
   
  } catch (e) {
    console.log(e)
    res.status(500).send("Server Error");
  } finally {
    if (client) client.release();
  }
});

module.exports = router;




