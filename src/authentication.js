const router = require('express').Router();
const jwt = require('jsonwebtoken');
const dotEnv = require('dotenv');
dotEnv.config();
const DATABASE_OPTIONS = require('../config');
const lo = require("moment/locale/lo");
const Pool = require('pg').Pool;
const pgPool = new Pool(DATABASE_OPTIONS);



router.route("/test").get((req, res) => {
    res.send("working")
});

router.route("/refresh-token").post(async (req, res) => {
    const {JWT_REFRESH_SECRET, JWT_SECRET} = process.env;
    const {user_id, token} = req.body;
    const client = await pgPool.connect();

    try {

        const refreshTokenQ = `select refresh_tokens
                                           from core.ref_token
                                           where user_id = '${user_id}'`;
        const refreshTokenQRes = await client.query(refreshTokenQ);
        if (refreshTokenQRes.rows.length > 0) {

            let refreshTokenArray = refreshTokenQRes.rows[0].refresh_tokens.map(e => JSON.parse(e));

            refreshTokenArray =refreshTokenArray.filter(x => x.accessToken === token) ;
            if (refreshTokenArray.length > 0){

                const refreshTokenObject = refreshTokenArray[0];

                const refreshToken = refreshTokenObject.refreshToken;
                jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decodedRefresh) => {
                    if (err) {



                        res.status(401).send({message: "Unauthorised request", code: 401, success: false});
                    }
                    else {
                        const {
                            id,
                            email,
                            audience,
                            issuer
                        } = decodedRefresh;
                        const userInfo = {
                            id, email, audience, issuer
                        }
                        const accessToken = jwt.sign(userInfo, JWT_SECRET, {
                            expiresIn: '1h'
                        })


                        const newTokenPair = {
                            accessToken, refreshToken
                        }
                        const deleteExpiredTokenQ = `update core.ref_token
                                                             set refresh_tokens = array_remove(refresh_tokens, '${JSON.stringify(refreshTokenObject)}')`;
                        await client.query(deleteExpiredTokenQ);
                        const updateExpiredTokenQ = `update core.ref_token
                                                             set refresh_tokens = array_append(refresh_tokens, '${JSON.stringify(newTokenPair)}')`;
                        await client.query(updateExpiredTokenQ);
                        res.send({
                            code: 200,
                            message: "Ok",
                            accessToken
                        })
                    }
                })
            }
            else {
                res.status(401).send({message: "Unauthorised request", code: 401, success: false})
            }


        } else {
            res.status(401).send({message: "Unauthorised request", code: 401, success: false})
        }

    } catch (e) {
        console.log("try catch")
        console.log(e)
        res.status(500).send({
            code: 500,
            message: "Server Error",
            status: "failed"
        })
    } finally {
        client.release();
    }
});

router.route("/admin/checkAuth").post(async (req, res) => {
    const client = await pgPool.connect();
    const {refreshToken, accessToken} = req.body;
    console.log(req.body)
    const {JWT_REFRESH_SECRET, JWT_SECRET} = process.env;
    try {
        const decoded = jwt.verify(accessToken, JWT_SECRET,{ignoreExpiration: true});
        console.log(decoded)
        const refreshTokenQ = `select tokens from core.admin_token where admin_id='${decoded.id}'`
        const refreshTokenQRes = await client.query(refreshTokenQ);

        const {tokens} = refreshTokenQRes.rows[0]
        console.log(tokens.includes(refreshToken))
        if (tokens.includes(refreshToken)){
            const decodedRefresh = jwt.verify(refreshToken, JWT_REFRESH_SECRET, {ignoreExpiration: true});
            if (Date.now() > decodedRefresh * 1000){
                res.status(401).send({
                    code : 401,
                    message: "Unauthorised access",
                    isAuth: false
                })
            }
            else {

                res.send({
                    code : 200,
                    message: "OK",
                    isAuth: true
                })
            }

        }
        else {
            res.status(401).send({
                code : 401,
                message: "Unauthorised access",
                isAuth: false
            })
        }
    }
    catch (e) {
        console.log(e)
        res.status().send({
            code: 500,
            status:'server error',
            message: "An error occurred while processing the request"
        })
    }
});

router.route("/admin/refresh").post(async (req, res) => {
    const client = await pgPool.connect();
    const {refreshToken, accessToken} = req.body;
    console.log(req.body)
    const {JWT_REFRESH_SECRET, JWT_SECRET} = process.env;
    try {
        if (!refreshToken){
            res.status(401).send({
                code : 401,
                message: "Unauthorised access"
            })
        }
        else {
            const decoded = jwt.verify(accessToken, JWT_SECRET,{ignoreExpiration: true});
            console.log(decoded)
            const refreshTokenQ = `select tokens from core.admin_token where admin_id='${decoded.id}'`
            const refreshTokenQRes = await client.query(refreshTokenQ);

            const {tokens} = refreshTokenQRes.rows[0]
            console.log(tokens.includes(refreshToken))
            if (tokens.includes(refreshToken)){
                const decodedRefresh = jwt.verify(refreshToken, JWT_REFRESH_SECRET, {ignoreExpiration: true});
                if (Date.now() > decodedRefresh * 1000){
                    res.status(401).send({
                        code : 401,
                        message: "Unauthorised access"
                    })
                }
                else {

                    const userPayload = {
                        id: decoded.id,
                        email: decoded.email,
                        iss: decoded.iss,
                        aud: decoded.aud

                    }
                    const newToken = jwt.sign(userPayload, JWT_SECRET, {expiresIn: '1h'});
                    res.send({
                        token: newToken,
                        refresh: refreshToken,
                        isAuth: true
                    })
                }

            }
            else {
                res.status(401).send({
                    code : 401,
                    message: "Unauthorised access"
                })
            }
        }
    }
    catch (e) {
        console.log(e)
        res.status().send({
            code: 500,
            status:'server error',
            message: "An error occurred while processing the request"
        })
    }
});



module.exports = router
