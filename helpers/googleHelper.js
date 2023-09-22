const axios  = require('axios');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();


const verifyToken = (req, res, next) => {
    const token = req.headers.authorization.split(" ")[1]
    axios.get(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`).then(() => next()).catch(e => res.status(401).send({message:"Unauthorised request", code: 401, success: false}))
};

const verifyJWT = async (req, res, next) => {
    const token = req.headers.authorization.split(" ")[1];
    if (!token){
        res.status(401).send({message: "Unauthorised request", code: 401, success: false})
    }
    else {
        const { JWT_SECRET, NODE_ENV, PROD_ENDPOINT, DEV_ENDPOINT} = process.env;
        jwt.verify(token, JWT_SECRET,async (error, decoded) => {
            if (error){

                if(error.name ==='TokenExpiredError') {

                    const payload = jwt.verify(token, JWT_SECRET,{ignoreExpiration: true});
                    axios.post(NODE_ENV === 'dev'? DEV_ENDPOINT:PROD_ENDPOINT,{
                        user_id: payload.id,
                        token
                    }).then(d => {
                        req.accessToken = d.data.accessToken;
                        next();
                    }).catch(e => res.status(401).send({
                        message: "Unauthorised request", code: 401, success: false
                    }))
                }
                else {
                    res.status(401).send({message: "Unauthorised request", code: 401, success: false})
                }
            }
            else {
                req.accessToken = token
                next();
            }
        })
    }
    // try {
    //     const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    //     next();
    // }
    // catch (e) {
    //     res.status(401).send({
    //         message:"Unauthorised request", code: 401, success: false
    //     })
    // }

};

module.exports = {
    verifyToken, verifyJWT
}
