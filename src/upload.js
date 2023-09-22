const router = require('express').Router();
const pg = require('pg');
const Pool = pg.Pool;
const aws = require('aws-sdk');
const DATABASE_OPTIONS = require('../config');
const dotenv = require('dotenv');
dotenv.config();
const { v4: uuidv4 } = require('uuid');

const pgPool = new Pool(DATABASE_OPTIONS);
const multer = require('multer');

const storage = multer.memoryStorage({
    destination: (req, file, callBack) => {
        callBack(null, '')
    },
    filename: (req, file, callBack) => {
        callBack(null, `${file.originalname}`)
    }
})
let upload = multer({  storage: storage})




router.route('/avatar').post(upload.array('files'),async (req, res) => {
    const {region ,bucket, expire, id} = req.body;
    console.log(req.body)
    const s3 = new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
        signatureVersion: "v4",
        region: region || 'us-east-1'
    });

    const client = await pgPool.connect();


    try{


        const files = req.files;
        let filesLocationArray = [];
        const uploadPromise = new Promise((resolve, reject) => {

            files.forEach(async (file) => {

                const buffer = file.buffer;
                const fileName = file.originalname;
                const url = await s3.upload({
                    Bucket: bucket || process.env.AWS_S3_BUCKET,
                    Key: fileName,
                    Body: buffer
                },async (err, data) => {
                    if(err){
                        console.log("here is the erro,", err)
                        reject("Upload Error");
                    }
                    else {
                        console.log(fileName, data.Location);
                        filesLocationArray.push(data.Location);
                        // const insertQuery = `insert into core.avatar(id,filename, url) values ('${uuidv4()}','${fileName}','${data.Location}')`;
                        // await client.query(insertQuery);
                        resolve();
                    }
                })
            })
        });
        uploadPromise.then(() => res.send({avatars:"Success", filesLocationArray})).catch(e =>{
            console.log(e)
            res.status(500).send("Upload error")
        })
    }
    catch (e) {
        console.log(e);
        res.status(500).send("Server Error")
    }
    finally {
        client.release();
    }





});

router.route('/images').post(upload.array('images'),async (req, res) => {
    const {region ,bucket, expire, id, categoryUpload, productUpload} = req.query;

    const s3 = new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
        signatureVersion: "v4",
        region: region || 'ap-south-1'
    });

    const client = await pgPool.connect();


    try{


        const files = req.files;

        let filesLocationArray = [];


        for (let i = 0; i< files.length ;i++){
            const buffer = files[i].buffer;
            const fileName = files[i].originalname;
            const params = {
                Bucket: bucket || 'hlth-run-shop',
                Key: categoryUpload === 'true' ? `categories/${id}/${fileName}`:`products/${id}/${fileName}`,
                Body: buffer
            }

            filesLocationArray.push(uploadFiles(params))



            

        }
        Promise.all(filesLocationArray).then(data => {
            res.send({data: data.map(x => x.Location)})
        })


    }
    catch (e) {
        console.log(e);
        res.status(500).send("Server Error")
    }
    finally {
        client.release();
    }





});

function uploadFiles( params, region= 'ap-south-1') {
    const s3 = new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
        signatureVersion: "v4",
        region: region
    });
    return s3.upload(params).promise();
}



router.route('/delete_images').post(async (req, res) => {
    const {region ,bucket, dataArr} = req.body;
console.log("dsfsd",dataArr[0])
    const s3 = new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
        signatureVersion: "v4",
        region: region || 'ap-south-1'
    });

    const client = await pgPool.connect();


    try{


        const params = {
            Bucket: bucket,
            Delete: {
              Objects: dataArr.map(x => ({ Key: x })),
              Quiet: false
            }
          };
      
          
        const s3resp = await s3.deleteObjects(params).promise();

        console.log(s3resp)


    }
    catch (e) {
        console.log(e);
        res.status(500).send("Server Error")
    }
    finally {
        client.release();
    }





});


module.exports = router;
