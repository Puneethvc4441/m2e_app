const passportJWT = require('passport-jwt');
const ExtractJWT = passportJWT.ExtractJwt;
const Strategy = passportJWT.Strategy;


const opts = {
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,

};

const strategy = new Strategy(opts, async(payload, done)=>{


    try {
        done(null, payload)
    }
    catch (e){
        done(e, false)
    }

} );


module.exports = (passport) => {
    passport.use(strategy);
}