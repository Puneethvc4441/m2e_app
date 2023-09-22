const router = require('express').Router();
const pg = require('pg');
const Pool = pg.Pool;
const DATABASE_OPTIONS = require('../config.js');
const pgPool = new Pool(DATABASE_OPTIONS);
const otpGenerator = require("otp-generator");
const util = require('util');
const { verifyJWT} = require('../helpers/googleHelper')
const {sender} = require('../helpers/emailSender');
const {verifyOTPAttachment} = require('../attachments/emailAttachments')

const sendEmail = util.promisify(sender);

router.route("/verifyOtp").post(async (req, res) => {
    const { user_id, otp } = req.body;
    const client = await pgPool.connect();

    try {

        
        const verifyOtpQuery = `select * from core.email_verification where user_id ='${user_id}'`;
        const verifyOtpQueryRes = await client.query(verifyOtpQuery);

        if (otp === verifyOtpQueryRes.rows[0].otp) {
            const updateEmailStatusQuery = `update core.user set email_verification = true where id = '${user_id}'`;
            await client.query(updateEmailStatusQuery);
            const deleteEntryQuery = `delete from core.email_verification where user_id ='${user_id}'`
            await client.query(deleteEntryQuery);
        }

        res.status(200).send({ emailVerified: otp === verifyOtpQueryRes.rows[0].otp });
    }
    catch (e) {
        console.log(e);
        res.status(500).send('Server Error');
    }
    finally {
        client.release();
    }

})

router.route("/resendOtp").post(async (req, res) => {
    const { user_id } = req.body;
   const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false, digits: true })
    const client = await pgPool.connect();

    try {
        const resendOtpQuery = `update core.email_verification set otp = '${otp}' , updated_at = '${new Date().toISOString()}' where user_id ='${user_id}'`;
        const resendOtpQueryRes = await client.query(resendOtpQuery);
        // const getEmailQuery = `select email from core.email_verification where user_id='${user_id}'`;
        // const getEmailQueryRes = await client.query(getEmailQuery);
        const getNameQuery = `select name,email_id from core.user where id='${user_id}'`;
        const getNameQueryRes = await client.query(getNameQuery);
        const userEmail = getNameQueryRes.rows[0].email_id;
        const userName = getNameQueryRes.rows[0].name;
        const options =[ {
          name: userName,
            email:userEmail,
            otp: otp
        }];
        sendEmail('verifyOTP', options, verifyOTPAttachment).then(
            res.status(200).send({message:"Otp Sent"})
        )

    }
    catch (e) {
        console.log(e);
        res.status(500).send('Server Error');
    }
    finally {
        client.release();
    }

})

module.exports = router;
