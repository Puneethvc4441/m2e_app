const firebaseAdmin = require('firebase-admin');
const serviceAccount = require('../../hlth-config.json');

firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    databaseURL: "https://hlth-fitness-app-default-rtdb.europe-west1.firebasedatabase.app/"
})


module.exports = {
    firebaseAdmin
}