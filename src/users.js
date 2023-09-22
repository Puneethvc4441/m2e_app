const router = require('express').Router();
const pg = require('pg');
const Pool = pg.Pool;
const DATABASE_OPTIONS = require('../config.js');
const otpGenerator = require("otp-generator");
const jwt = require('jsonwebtoken');
const pgPool = new Pool(DATABASE_OPTIONS);
const { verifyOTPAttachment, mailAttachment } = require("../attachments/emailAttachments");
const {firebaseAdmin} = require('./config/firebaseConfig');
const { sender, marketingEmail,senderOtpSimple } = require('../helpers/emailSender');
const util = require('util');
const sendEmail = util.promisify(sender);
const senderOtpSimpleEmail = util.promisify(senderOtpSimple);
const sendMarketingEmail = util.promisify(marketingEmail);
const { verifyJWT } = require("../helpers/googleHelper");


router.route("/marketing").get((req, res) => {
  const emails = [
    { email: "sunny@hlth.network" },
    { email: "suyash@shivom.io" },
    { email: "sunny@shivom.io" },
    { email: "midem75187@carsik.com" },
    { email: "nishant@shivom.io" },
    { email: "ankithjain@ankithjain.com" },
    { email: "christopher@hlth.network" },
    { email: "asim@hlth.network" },
    { email: "cnrphd@gmail.com" },
    { email: "akrijsi@seznam.cz" },
    { email: "tejaygogi@gmail.com" },
    { email: "gokoraw215@richdn.com" },
    { email: "japjeet@bione.in" },
    { email: "davinder@bione.in" },
    { email: "surgelionmedia@gmail.com" },
    { email: "kaushalnahata1996@gmail.com" },
    { email: "kuehnelnoack@gmail.com" },
    { email: "rajusinh51535@gmail.com" },
    { email: "jadhwanikesar3@gmail.com" },
    { email: "azeemmcgm@gmail.com" },
    { email: "osokinsan@gmail.com" },
    { email: "pranavthorat2202@gmail.com" },
    { email: "harish@hlth.run" },
    { email: "jhangeer2@gmail.com" },
    { email: "parmar.dilip723@gmail.com" },
    { email: "DEOTALEAMIT@GMAIL.COM" },
    { email: "faizrajput1519@gmail.com" },
    { email: "road2earn@gmail.com" },
    { email: "SALMANSINDHI.1998@GMAIL.COM" },
    { email: "emailravi.yrk12@gmail.com" },
    { email: "Priyanko.ghosh@yahoo.com" },
    { email: "lilharesanjaykuma63@gimel.cam" },
    { email: "sudipbag740@gmail.com" },
    { email: "shakir7.ali@gmail.com" },
    { email: "vivo9833946019@gmail.com" },
    { email: "Sandeep@shivom.io" },
    { email: "dvsandeep123@gmail.com" },
    { email: "modek97800@iconzap.com" },
    { email: "disone3590@musezoo.com" },
    { email: "venkatabhanuprakash.n@gmail.com" },
    { email: "gautamgupta427@icloud.com" },
    { email: "nanawa8786@musezoo.com" },
    { email: "sandeep.rvsc@gmail.com" },
    { email: "ht534347@gmail.com" },
    { email: "dvsande5ep123@gmail.com" },
    { email: "dvsandeep1231@gmail.com" },
    { email: "lopojaj354@iconzap.com" },
    { email: "sokifa3654@musezoo.com" },
    { email: "rvschowdary55576@gmail.com" },
    { email: "feedpenny@gmail.com" },
    { email: "harav21335@game4hr.com" },
    { email: "daseh80089@falkyz.com" },
    { email: "noyoxek714@iconzap.com" },
    { email: "semojes924@iconzap.com" },
    { email: "wawaror988@dilanfa.com" },
    { email: "kacofar564@dilanfa.com" },
    { email: "robalas487@iconzap.com" },
    { email: "jesona4129@falkyz.com" },
    { email: "leyicej854@iconzap.com" },
    { email: "xadecow739@game4hr.com" },
    { email: "sogeli4032@krunsea.com" },
    { email: "sicote1836@nzaif.com" },
    { email: "xzczc@efds.dsf" },
  ];

    // const options = [
    //   {
    //     email: "suyashamb@gmail.com",
    //   },
    //   {
    //     email: "sunny@hlth.run",
    //   },
    // ];
    sendMarketingEmail('marketing', emails, mailAttachment).then(res.send("emailsent"))
})

router.route("/signup").post(async (req, res) => {
  await signUp(req.body.email, req.body.firebase_id, "true", req.body.device_type,"social",res);
})

const signUp =async(email, firebase_id, opt_promotion, device_type,method,res)=>{
   
    const client = await pgPool.connect();
   
    let userEmail;
    try {
        if(!email){
            const firebaseUserInfo = await firebaseAdmin.auth().getUser(firebase_id);
            userEmail = firebaseUserInfo.providerData[0].email;
        }
        else {
            userEmail = email;
        }
        let email_verification = true

        const checkUserQ = `select * from core."user" where email_id='${userEmail}';`;
        /*
        * This gives us user info based on email
        * */

        const checkUserQRes = await client.query(checkUserQ);

        let newUserQuery, newUserQueryRes,wallet_spendingRes;
        if (checkUserQRes.rowCount === 0){

        const newUserInsertQuery = `insert into core.user ( email_id, opt_promotions, device_type, updated_at,
                                                     email_verification)
                              values ( '${userEmail}', ${opt_promotion}, '${device_type}',
                                      '${new Date().toISOString()}', ${email_verification})
                              returning *`;
        const newUserInsertQueryRes = await client.query(newUserInsertQuery);
            newUserQuery = `update core."user" set firebase_id=array_append(firebase_id, '${firebase_id}') where email_id = '${userEmail}' returning *;`;
            newUserQueryRes = await client.query(newUserQuery);
            const wallet_spending = `
            insert into core.wallet_spending (user_id,hlth,runn,matic)
            VALUES ('${newUserQueryRes.rows[0].id}', 0, 0, 0) returning *;
        `;
         wallet_spendingRes = await client.query(wallet_spending);
        }
        else {
            if (checkUserQRes.rows[0].firebase_id.find(e => e === firebase_id)){
                newUserQueryRes = checkUserQRes;
            }
            else {
                newUserQuery = `update core."user" set firebase_id=array_append(firebase_id, '${firebase_id}') where email_id = '${userEmail}' returning *;`;
                newUserQueryRes = await client.query(newUserQuery);
            }
            const getWalletInfo = `select hlth,runn,matic from core.wallet_spending where user_id='${newUserQueryRes.rows[0].id}';`;
            wallet_spendingRes = await client.query(getWalletInfo);
        }

        const newUserInfo = newUserQueryRes.rows[0];
        const userTokenInfo = {
            id: newUserInfo.id,
            email: newUserInfo.email_id,
            audience: 'hlth.run',
            issuer: 'hlth.run'
        }

        const accessToken = jwt.sign(userTokenInfo, process.env.JWT_SECRET, {
            expiresIn: '1h'
        });
        const refreshToken = jwt.sign(userTokenInfo, process.env.JWT_REFRESH_SECRET, {
            expiresIn: '7d'
        });

        const accessRefreshPair = {
            accessToken, refreshToken
        }


        if (checkUserQRes.rowCount === 0){

        const insertIdQ = `insert into core.ref_token(user_id) values ('${newUserInfo.id}');`;
        await client.query(insertIdQ);
        const insertRefreshTokenQ = `update core.ref_token set refresh_tokens = array_append(refresh_tokens,'${JSON.stringify(accessRefreshPair)}') where user_id='${newUserInfo.id}'`
        await client.query(insertRefreshTokenQ);

        // if (signup_method === "N") {
        //     otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false, digits: true })
        //     const insertEmailVerification = `
        //         insert into core.email_verification(user_id, email, otp, updated_at)
        //         values ('${newUserQueryRes.rows[0].id}', '${userEmail}', '${otp}', '${new Date().toISOString()}')
        //         returning *`;


        //     const insertEmailVerificationRes = await client.query(insertEmailVerification);
        //     const options = [{
        //         name: '',
        //         email: userEmail,
        //         otp: otp
        //     }];
        //     sendEmail('verifyOTP', options, verifyOTPAttachment).then(console.log("sent"));
        // }
        const insertUserTokens = `
            INSERT INTO core.user_token
                (user_id, current_tokens, total_tokens, current_distance,local_steps,total_distance)
            VALUES ('${newUserQueryRes.rows[0].id}', 0, 0, 0,0,0);
        `;
        const insertUserTokensRes = await client.query(insertUserTokens);

      

   

        }else{
            const insertRefreshTokenQ = `update core.ref_token set refresh_tokens = array_append(refresh_tokens,'${JSON.stringify(accessRefreshPair)}') where user_id='${newUserInfo.id}'`
            await client.query(insertRefreshTokenQ);

            // if (signup_method === "N") {
            //     otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false, digits: true })
            //     const insertEmailVerification = `
            //         insert into core.email_verification(user_id, email, otp, updated_at)
            //         values ('${newUserQueryRes.rows[0].id}', '${userEmail}', '${otp}', '${new Date().toISOString()}')
            //         returning *`;


            //     const insertEmailVerificationRes = await client.query(insertEmailVerification);
            //     const options = [{
            //         name: '',
            //         email: userEmail,
            //         otp: otp
            //     }];
            //     sendEmail('verifyOTP', options, verifyOTPAttachment).then(console.log("sent"));
            // }
        }
      

    const getnft = `
    SELECT array_agg(url) FROM core.nft_owner_info where owner_id = '${newUserQueryRes.rows[0].id}';
`;
const getnftRes = await client.query(getnft);

let data = newUserQueryRes.rows[0];
if(getnftRes.rows[0].array_agg === null){
    data.nft_urls =[]
}else{
    data.nft_urls =getnftRes.rows[0].array_agg 

}

       
        if (method === 'social') {
            res.status(201).send({ "userExists": data,  "wallet":wallet_spendingRes.rows[0],accessToken })
        }

    } catch (e) {
        console.log(e);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
}






router.route("/emailLogin").post(async (req, res) => {

  try {
    const auth = firebaseAdmin.auth();
    const email = req.body.email;
    console.log(email);
    var user = {
      uid: null,
      isPresent: false,
    };
    await auth // checking if user exits
      .getUserByEmail(email)
      .then((userRecord) => {
        console.log(userRecord);
        user.uid = userRecord.toJSON().uid;
        user.isPresent = true;
      })
      .catch((error) => {
        console.log(error);
        user.isPresent = false;
      });
    console.log(user,"details");
    if (user.isPresent) {//if yes create custom token
      //and return the response
      console.log("creating custom Token");
      await auth
        .createCustomToken(user.uid)
        .then((cToken) => {
          res.status(200).send({ customToken: cToken });
        })
        .catch((error) => {
          console.log(error);
          throw new Error("Failed to create custom token");
        });
    } else { // create user
      await auth
        .createUser({
          email: email,
          emailVerified: true,
          displayName: email,
        })
        .then((userRecord) => {
          user.uid = userRecord.toJSON().uid;
          user.isPresent = true;
           signUp(email, user.uid, "true", "unknown","otp",res);
        })
        .catch((error) => {
          throw new Error(error.message);
        });
        //after creating user return response
      await auth.createCustomToken(user.uid).then((cToken) => {
        res.status(200).send({ customToken: cToken });
      });
    }
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

// router.route("/cu").post(async (req, res) => {
//     const {userEmail, deviceToken} = req.body;
//     const client = await pgPool.connect();
//
//     try {
//
//         const newUserQuery = `select *
//                               from core.user
//                               where lower(email_id) = lower('${email}')`;
//         const newUserQueryRes = await client.query(newUserQuery);
//         if (newUserQueryRes.rows[0].devicetoken === deviceToken) {
//             res.status(201).send({userExists: newUserQueryRes.rows[0]});
//         } else {
//
//             const updateUserQuery = `update core.user
//                                      set devicetoken='${deviceToken}'
//                                      where lower(email_id) = lower('${email}')
//                                      returning*`;
//             const updateUserQueryRes = await client.query(updateUserQuery);
//             res.status(201).send({userExists: updateUserQueryRes.rows[0]});
//         }
//
//     } catch (e) {
//         console.log(e);
//         res.status(500).send('Server Error');
//     } finally {
//         client.release();
//     }
//
// });



router.route("/loginOtp").post(async (req, res) => {

    const client = await pgPool.connect();

    otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false, digits: true })
   


    const options = {
        name: '',
        email: req.body.email,
        otp: otp,
        html : `<h2>New otp :</h2><br/><h3>${otp}</h3><br/>`,
        subject: 'User Authentication'
    };
    senderOtpSimpleEmail( options).then(res.status(200).send({ otp: otp }));

    try {

        

    } catch (e) {
        console.log(e);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }

});

router.route("/checkUser").post(async (req, res) => {
    const { firebase_id, deviceToken } = req.body;
    const client = await pgPool.connect();
    try {
        const emailCheckQ = `select * from core."user" where '${firebase_id}' = any(firebase_id)`;

        const emailCheckQRes = await client.query(emailCheckQ);
        if (emailCheckQRes.rowCount > 0) {
            const userTokenInfo = {
                email: emailCheckQRes.rows[0].email_id,
                id: emailCheckQRes.rows[0].id,
                audience: 'hlth.run',
                issuer: 'hlth.run'

            }
            const accessToken = jwt.sign(userTokenInfo, process.env.JWT_SECRET, {
                expiresIn: '1h'
            });
            const refreshToken = jwt.sign(userTokenInfo, process.env.JWT_REFRESH_SECRET, {
                expiresIn: '7d'
            });

            const accessRefreshPair = {
                accessToken, refreshToken
            }
            const tokenCheckQ = `select id
            from core.ref_token
            where user_id = '${emailCheckQRes.rows[0].id}'`;
            const tokenCheckQRes = await client.query(tokenCheckQ);
            if (tokenCheckQRes.rowCount === 0) {
                const insertIdQ = `insert into core.ref_token(user_id) values ('${emailCheckQRes.rows[0].id}');`;
                await client.query(insertIdQ);
            }
            const updateRefreshTokenQ = `update core.ref_token set refresh_tokens = array_append(refresh_tokens, '${JSON.stringify(accessRefreshPair)}') where user_id='${emailCheckQRes.rows[0].id}'`
            await client.query(updateRefreshTokenQ);
            const getWalletInfo = `select hlth,runn,matic from core.wallet_spending where user_id='${emailCheckQRes.rows[0].id}';`;
           const wallet_spendingRes = await client.query(getWalletInfo);
          

            const { devicetoken } = emailCheckQRes.rows[0];

    const getnft = `
    SELECT array_agg(url) FROM core.nft_owner_info where owner_id = '${emailCheckQRes.rows[0].id}';
`;
const getnftRes = await client.query(getnft);



            if (devicetoken !== deviceToken) {
                //TODO: update the device token
                const updateDeviceTokenQ = `update core."user" set devicetoken = '${deviceToken}' where '${firebase_id}' = any(firebase_id) returning *`;
                const updateDeviceTokenQRes = await client.query(updateDeviceTokenQ)

                let data = updateDeviceTokenQRes.rows[0];
if(getnftRes.rows[0].array_agg === null){
    data.nft_urls =[]
}else{
    data.nft_urls =getnftRes.rows[0].array_agg 

}

                res.status(201).send({
                    code: 204,
                    status: "resource updated successfully",
                    userExists: data,
                    "wallet":wallet_spendingRes.rows[0],
                    accessToken
                })
            }
            else {
                let data = emailCheckQRes.rows[0];
if(getnftRes.rows[0].array_agg === null){
    data.nft_urls =[]
}else{
    data.nft_urls =getnftRes.rows[0].array_agg 

}
                res.status(201).send({
                    code: 200,
                    status: "Ok",
                    userExists: data,
                    "wallet":wallet_spendingRes.rows[0],
                    accessToken
                })
            }
        }
        else {
            res.status(201).send({ userExists: emailCheckQRes.rows[0] });
        }
    }
    catch (e) {
        console.log(e)
        res.status(500).send('Server Error');

    }
    finally {
        client.release();
    }
})
router.route("/logout").post(async (req, res) => {
    const {  user_id} = req.body;
    const client = await pgPool.connect();
    try {
        const q = `delete from core.ref_token where user_id='${user_id}'`;
        await  client.query(q);
        res.send({code:200, message:'ok'})
    }
    catch (e) {
        console.log(e);
        res.status(500).send("server error")
    }
    finally {
        client.release();
    }
})

router.route("/updateUserInfo").post(async (req, res) => {
    const { avatar, name, user_id, gender, method , height , weight} = req.body;
    const client = await pgPool.connect();
    try {
        if (method === "signup") {
            const updateInfoQuery = `update core.user
                                     set name   = '${name}',
                                         avatar = '${avatar}',
                                         gender='${gender}',
                                         height='${height}',
                                         weight='${weight}'
                                     where id = '${user_id}'
                                     returning *`;
            const updateInfoQueryRes = await client.query(updateInfoQuery);
            res.status(201).send({ userExists: updateInfoQueryRes.rows[0] });
        } else {
            const updateInfoQuery = `update core.user
                                     set name   = '${name}',
                                         avatar = '${avatar}',
                                         height='${height}',
                                         weight='${weight}'
                                     where id = '${user_id}'
                                     returning *`;
            const updateInfoQueryRes = await client.query(updateInfoQuery);
            res.status(201).send({ userExists: updateInfoQueryRes.rows[0] });
        }

    } catch (e) {
        console.log(e);
        res.status(500).send({ message: "Server Error" });
    } finally {
        client.release();
    }
});


router.route("/updateDataSource").post(async (req, res) => {
    const { data_source, user_id} = req.body;
    const client = await pgPool.connect();
    try {

            const updateInfoQuery = `update core.user
                                     set data_source   = '${data_source}'
                                     where id = '${user_id}'
                                     returning *`;
            const updateInfoQueryRes = await client.query(updateInfoQuery);
            res.status(201).send({ userExists: updateInfoQueryRes.rows[0] });


    } catch (e) {
        console.log(e);
        res.status(500).send({ message: "Server Error" });
    } finally {
        client.release();
    }
});

router.route("/getAvatars").get(async (req, res) => {

    const client = await pgPool.connect();
    try {

        const getAvatarsQuery = `select *
                                 from core.avatar`;
        const getAvatarsQueryRes = await client.query(getAvatarsQuery);

        res.status(201).send({ "avatars": getAvatarsQueryRes.rows });
    } catch (e) {
        console.log(e);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

router.route("/getSpendingBal").post(verifyJWT,async (req, res) => {

    const client = await pgPool.connect();
    try {

        const getWalletInfo = `select hlth,runn,matic from core.wallet_spending where user_id='${req.body.id}';`;
        const wallet_spendingRes = await client.query(getWalletInfo);

        res.status(201).send({  "wallet":wallet_spendingRes.rows[0]});
    } catch (e) {
        console.log(e);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

router.route("/getSpendingBalHistory").post(verifyJWT,async (req, res) => {

    const client = await pgPool.connect();
    try {

        const getWalletInfo = `select * from core.wallet_spending_history where user_id='${req.body.id}' and status ='${req.body.status}';`;
        const wallet_spendingRes = await client.query(getWalletInfo);

        res.status(201).send({  "wallet_history":wallet_spendingRes.rows});
    } catch (e) {
        console.log(e);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

module.exports = router;
