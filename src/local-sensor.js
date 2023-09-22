const {verifyJWT} = require("../helpers/googleHelper");
const router = require('express').Router();
const dotenv = require('dotenv');
const pg = require('pg');
const Pool = pg.Pool;
const moment = require('moment');
const DATABASE_OPTIONS = require('../config.js');
dotenv.config();


const pgPool = new Pool(DATABASE_OPTIONS);


router.route("/test").get(((req, res) => {
    res.send("Working")
}));

router.route("/daily-data").post( (async (req, res) => {
    const {user_id, steps} = req.body;
    const client = await pgPool.connect();

    try {
        const userTokensQ = `select current_distance, total_distance,local_steps from core.user_token where user_id='${user_id}'`;
        const userTokensRes = await client.query(userTokensQ);
        let updated_steps = 0

        if(userTokensRes.rows[0].local_steps <= steps){
            updated_steps = steps-userTokensRes.rows[0].local_steps;

        }else{
            updated_steps=steps
        }


         // utils functions

        const updateTokens = async (value) => {
            const updateTotalDistQ = `update core.user_token set current_distance = current_distance + ${value/1000} ,total_distance=  total_distance + ${value/1000} , local_steps=${steps} where user_id='${user_id}'`
            await client.query(updateTotalDistQ)
        }
        // Case when there is at least one record of that user in run history table
        const updateTokensDifference = async (value) => {
            //console.log(value)


            // Could be sum of distance
            const userRunHistoryQ = `select distance as total_distance from core.run_history where user_id='${user_id}' order by updated_at desc limit 1;`
            const userRunHistoryRes = await client.query(userRunHistoryQ);

            const distanceDifference = value === 0 ?0 : (Math.abs((value - userRunHistoryRes.rows[0].total_distance))/1000);
            console.log(distanceDifference, value,userRunHistoryRes.rows[0].total_distance,"distance difference");

            const updateTotalDistQ = `update core.user_token set current_distance = ${distanceDifference+ userTokensRes.rows[0].current_distance},total_distance = ${distanceDifference+ userTokensRes.rows[0].total_distance}  , local_steps=${steps} where user_id='${user_id}'`;
            await client.query(updateTotalDistQ)
        }

        const update = async (steps, dist, cal, heart,currDate, dateString, startTime, endTime) => {
            //console.log(steps, dist, cal, heart, startTime, endTime, currDate);
            const updateDataQuery = `update core.run_history rh set started_at='${new Date(
                parseInt(startTime)).toUTCString()}',
                                 ended_at='${new Date(parseInt(endTime)).toUTCString()}',
                                 steps=steps+${parseFloat(steps)},
                                 distance=distance+${parseFloat(dist)},
                                 calories=calories+${parseFloat(cal)},
                                 heart_rate=heart_rate+${parseFloat(heart)},
                                 updated_at='${currDate}',
                                data_type='google-fit-data'
                                 where user_id='${user_id}' and  date(rh.updated_at)='${dateString}'`;

            const a=  await client.query(updateDataQuery);
            //console.log(a)
        }

        const insert = async (steps, dist, cal, heart, startTime, endTime,currDate) =>{
            //console.log(steps, dist, cal, heart, startTime, endTime, currDate);
            const dataInsertQuery = `insert into core.run_history(user_id, started_at, ended_at, steps, distance, calories, heart_rate, updated_at, data_type)
      values(
             '${user_id}',
             '${new Date(parseInt(startTime)).toUTCString()}',
             '${new Date(parseInt(endTime)).toUTCString()}',
             ${parseFloat(steps)},
             ${parseFloat(dist)},
             ${parseFloat(cal)},
             ${parseFloat(heart)},
             '${currDate}',
             'google-fit-data'
             )`;

            await client.query(dataInsertQuery);

        }
// utils functions end

        const dataQuery = `select updated_at from core.run_history where user_id ='${user_id}' order by updated_at desc limit 1;`;
        const dataQueryRes = await client.query(dataQuery);
        const endTimeStamp = new Date().setUTCHours(24, 0, 0, 0)-1000;
        const startTimeStamp = new Date().setUTCHours(0, 0, 0, 0)+1000;
        const userInfoQ = `select height, weight from core."user"  where id='${user_id}';`;
        const userInfoRes = await client.query(userInfoQ);
        const {height, weight} = userInfoRes.rows[0];
        console.log(height, weight)

        // TODO: logic for distance and calories

        // Constants
        const DISTANCE_CONSTANT = 0.414;
        const AVG_TIME_FOR_WALKING = 13;
        const MET_WALKING = 4.3;
        const AVG_DEFAULT_WEIGHT = 70;
        const AVG_DEFAULT_HEIGHT = 175;


        const distanceInMeters  = (updated_steps * (height||175) * DISTANCE_CONSTANT)/100;

// TODO: implement heart point logic. For now heart points = 0;
        // heart points are just ine min of any activity of METs of value between 3.0 to 5.9
        //Since our MET comes out to be 4.3, we can reward one heart point every minute for the duration of that activity
        // speed =  distance / time

        // Average speed of walking is (from google search) is 4.6 kmph. But we should really get the duration of activity from the front end, otherwise the calcua
        /*
        * Average speed of walking is (from google search) is 4.6 kmph.
        * But we should really get the duration of activity from the front end.
        * Otherwise the calculations will be far less accurate
        *
        * */
        //This time will be hours

        const distanceInKM = distanceInMeters/1000;
        const timeInMinutes = distanceInKM * AVG_TIME_FOR_WALKING;
        const calories = ((weight||70) * 3.5 * AVG_TIME_FOR_WALKING * distanceInKM* MET_WALKING )/200;

        /*
        * Since, according to Google fit, one minute of exercise walk (brisk walk) is one heart point so
        * */

        const heartPoint = Math.ceil(timeInMinutes);

        // if today's data is not present int the database
        if (dataQueryRes.rowCount === 0){
            // TODO: insert data into the DB
            //console.log("no data present for the user")
            await updateTokens(distanceInMeters);
            await insert(updated_steps, distanceInMeters, calories, heartPoint, startTimeStamp, endTimeStamp, new Date().toUTCString());
        }
        else {
            const today = new Date();
               let updatedAtDate = new Date(dataQueryRes.rows[0].updated_at);
            let sameDay =  `${today.getUTCDate()}-${today.getUTCMonth() + 1}-${today.getUTCFullYear()}` ===
                `${updatedAtDate.getUTCDate()}-${
                    updatedAtDate.getUTCMonth() + 1
                }-${updatedAtDate.getUTCFullYear()}`;
            console.log( `${updatedAtDate.getUTCDate()}-${
                updatedAtDate.getUTCMonth() + 1
            }-${updatedAtDate.getUTCFullYear()}`)
            console.log(`${today.getUTCDate()}-${today.getUTCMonth() + 1}-${today.getUTCFullYear()}`)
            const  dayDifference = Math.floor((new Date() - updatedAtDate)/86400000);


            if (sameDay){
                console.log("same day")
                const todaysDate = new Date();
                const todaysDateString = `${todaysDate.getUTCFullYear()}-${String(todaysDate.getUTCMonth()+1).padStart(2,0)}-${String(todaysDate.getUTCDate()).padStart(2,0)}`;
                await updateTokensDifference(distanceInMeters);
                await update(updated_steps, distanceInMeters, calories, heartPoint,new Date().toUTCString(), todaysDateString,startTimeStamp, endTimeStamp );
            }
            else {
                //console.log("todays daata not present")
                await updateTokens(distanceInMeters);
                await insert(updated_steps, distanceInMeters, calories, heartPoint, startTimeStamp, endTimeStamp, new Date().toUTCString());
            }

        }
        res.send({
            code: 200,
            message: "Values recorded",
            status: "OK"
        })

    }
    catch (e) {
        console.log(e)
       res.status(500).send({
           code: 500,
           message: "Something went wrong",
           status: "Server error"
       }) ;
    }
    finally {
        client.release();
    }

}));

router.route("/local-data").post(verifyJWT,async (req, res) => {
    const { user_id,steps} = req.body;
    const client = await pgPool.connect();
    try {

        const dataQuery = `select * from core.run_history where user_id ='${user_id}' order by updated_at desc limit 1;`;
        const dataQueryRes = await client.query(dataQuery);
        const userTokensQ = `select current_distance, total_distance,local_steps ,total_tokens from core.user_token where user_id='${user_id}'`;
        const userTokensRes = await client.query(userTokensQ);
       if(!steps){
          



           if (dataQueryRes.rowCount === 0){
               res.send({
                   wallet_data: userTokensRes.rows.length === 0? 0: userTokensRes.rows[0].total_tokens,
                   data: {
                       steps: 0,
                       calories:  0,
                       heart_minutes:  0,
                       distance: 0
                   }
               })
           }
           else {
            const today = new Date();
            let updatedAtDate = new Date(dataQueryRes.rows[0].updated_at);
            let sameDay =  `${today.getUTCDate()}-${today.getUTCMonth() + 1}-${today.getUTCFullYear()}` ===
                `${updatedAtDate.getUTCDate()}-${
                    updatedAtDate.getUTCMonth() + 1
                }-${updatedAtDate.getUTCFullYear()}`;
           if (sameDay){
               const {steps, distance, calories, heart_rate} = dataQueryRes.rows[0]
               res.send({
                   wallet_data: userTokensRes.rows.length === 0? 0: userTokensRes.rows[0].total_tokens,
                   data:{
                       steps: steps,
                       calories:  calories,
                       heart_minutes:  heart_rate,
                       distance: parseFloat(distance)/1000
                   }
               })
           }
           else {
               res.send({
                   wallet_data: userTokensRes.rows.length === 0? 0: userTokensRes.rows[0].total_tokens,
                   data: {
                       steps: 0,
                       calories:  0,
                       heart_minutes:  0,
                       distance: 0
                   }
               })
           }
           }



       }
       else {

           let updated_steps = 0

           if(userTokensRes.rows[0].local_steps <= steps){
               updated_steps = steps-userTokensRes.rows[0].local_steps;

           }else{
               updated_steps=steps
           }


           // utils functions

           const updateTokens = async (value) => {
               const updateTotalDistQ = `update core.user_token set current_distance = current_distance + ${value/1000} ,total_distance=  total_distance + ${value/1000} , local_steps=${steps} where user_id='${user_id}'`
               await client.query(updateTotalDistQ)
           }
           // Case when there is at least one record of that user in run history table
           const updateTokensDifference = async (value) => {
               //console.log(value)


               // Could be sum of distance
               const userRunHistoryQ = `select distance as total_distance from core.run_history where user_id='${user_id}' order by updated_at desc limit 1;`
               const userRunHistoryRes = await client.query(userRunHistoryQ);

               const distanceDifference = value === 0 ?0 : (Math.abs((value - userRunHistoryRes.rows[0].total_distance))/1000);
               //console.log(distanceDifference, value,userRunHistoryRes.rows[0].total_distance,"distance difference");

               const updateTotalDistQ = `update core.user_token set current_distance = ${distanceDifference+ userTokensRes.rows[0].current_distance},total_distance = ${distanceDifference+ userTokensRes.rows[0].total_distance}  , local_steps=${steps} where user_id='${user_id}'`;
               await client.query(updateTotalDistQ)
           }

           const update = async (steps, dist, cal, heart,currDate, dateString, startTime, endTime) => {
               //console.log(steps, dist, cal, heart, startTime, endTime, currDate);
               const updateDataQuery = `update core.run_history rh set started_at='${new Date(
                   parseInt(startTime)).toUTCString()}',
                                 ended_at='${new Date(parseInt(endTime)).toUTCString()}',
                                 steps=steps+${parseFloat(steps)},
                                 distance=distance+${parseFloat(dist)},
                                 calories=calories+${parseFloat(cal)},
                                 heart_rate= heart_rate+${parseFloat(heart)},
                                 updated_at='${currDate}',
                                data_type='google-fit-data'
                                 where user_id='${user_id}' and  date(rh.updated_at)='${dateString}' returning *`;

               return await client.query(updateDataQuery);
               //console.log(a)
           }

           const insert = async (steps, dist, cal, heart, startTime, endTime,currDate) =>{
               //console.log(steps, dist, cal, heart, startTime, endTime, currDate);
               const dataInsertQuery = `insert into core.run_history(user_id, started_at, ended_at, steps, distance, calories, heart_rate, updated_at, data_type)
      values(
             '${user_id}',
             '${new Date(parseInt(startTime)).toUTCString()}',
             '${new Date(parseInt(endTime)).toUTCString()}',
             ${parseFloat(steps)},
             ${parseFloat(dist)},
             ${parseFloat(cal)},
             ${parseFloat(heart)},
             '${currDate}',
             'google-fit-data'
             ) returning *`;

               return     await client.query(dataInsertQuery);

           }
// utils functions end


           const endTimeStamp = new Date().setUTCHours(24, 0, 0, 0)-1000;
           const startTimeStamp = new Date().setUTCHours(0, 0, 0, 0)+1000;
           const userInfoQ = `select height, weight from core."user"  where id='${user_id}';`;
           const userInfoRes = await client.query(userInfoQ);
           const {height, weight} = userInfoRes.rows[0];
           //  console.log(height, weight)

           // TODO: logic for distance and calories

           const DISTANCE_CONSTANT = 0.414;
           const AVG_TIME_FOR_WALKING = 13;
           const MET_WALKING = 4.3;


           const distanceInMeters  = (updated_steps * (height||175) * DISTANCE_CONSTANT)/100;

// TODO: implement heart point logic. For now heart points = 0;
           // heart points are just ine min of any activity of METs of value between 3.0 to 5.9
           //Since our MET comes out to be 4.3, we can reward one heart point every minute for the duration of that activity
           // speed =  distance / time

           // Average speed of walking is (from google search) is 4.6 kmph. But we should really get the duration of activity from the front end, otherwise the calcua
           /*
           * Average speed of walking is (from google search) is 4.6 kmph.
           * But we should really get the duration of activity from the front end.
           * Otherwise the calculations will be far less accurate
           *
           * */
           //This time will be hours

           const distanceInKM = distanceInMeters/1000;
           const timeInMinutes = distanceInKM * AVG_TIME_FOR_WALKING;
           const calories = ((weight||70) * 3.5 * AVG_TIME_FOR_WALKING * distanceInKM * MET_WALKING )/200;

           /*
           * Since, according to Google fit, one minute of exercise walk (brisk walk) is one heart point so
           * */

           const heartPoint = Math.ceil(timeInMinutes);

           let response={}
           // if today's data is not present int the database
           if (dataQueryRes.rowCount === 0){
               // TODO: insert data into the DB
               // console.log("no data present for the user")
               await updateTokens(distanceInMeters);

               response=  await insert(updated_steps, distanceInMeters, calories, heartPoint, startTimeStamp, endTimeStamp, new Date().toUTCString());

           }
           else {
               const today = new Date();
               let updatedAtDate = new Date(dataQueryRes.rows[0].updated_at);
               let sameDay =  `${today.getUTCDate()}-${today.getUTCMonth() + 1}-${today.getUTCFullYear()}` ===
                   `${updatedAtDate.getUTCDate()}-${
                       updatedAtDate.getUTCMonth() + 1
                   }-${updatedAtDate.getUTCFullYear()}`;
               // console.log( `${updatedAtDate.getUTCDate()}-${
               //     updatedAtDate.getUTCMonth() + 1
               // }-${updatedAtDate.getUTCFullYear()}`)
               // console.log(`${today.getUTCDate()}-${today.getUTCMonth() + 1}-${today.getUTCFullYear()}`)
               const  dayDifference = Math.floor((new Date() - updatedAtDate)/86400000);


               if (sameDay){
                   //console.log("same day")
                   const todaysDate = new Date();
                   const todaysDateString = `${todaysDate.getUTCFullYear()}-${String(todaysDate.getUTCMonth()+1).padStart(2,0)}-${String(todaysDate.getUTCDate()).padStart(2,0)}`;
                   await updateTokensDifference(distanceInMeters);
                   response=   await update(updated_steps, distanceInMeters, calories, heartPoint,new Date().toUTCString(), todaysDateString,startTimeStamp, endTimeStamp );
               }
               else {
                   //console.log("todays daata not present")
                   await updateTokens(distanceInMeters);
                   response= await insert(updated_steps, distanceInMeters, calories, heartPoint, startTimeStamp, endTimeStamp, new Date().toUTCString());

               }

           }


           res.status(200).send({
               wallet_data: userTokensRes.rows.length === 0? 0: userTokensRes.rows[0].total_tokens,
               data: {
                   steps: response.rows[0].steps,
                   calories:  response.rows[0].calories,
                   heart_minutes:  response.rows[0].heart_rate,
                   distance:   parseFloat((response.rows[0].distance/1000).toFixed(2))
               }

           })



       }





    //     const dataQuery = `select updated_at from core.run_history where user_id ='${user_id}' order by updated_at desc limit 1;`;
    //     const dataQueryRes = await client.query(dataQuery);
    //     const walletDataQuery =  `select total_tokens from core.user_token where user_id='${user_id}'`;
    //     const resWallet = await client.query(walletDataQuery);
    //             if (dataQueryRes.rowCount === 0){
    //         res.status(200).send({
    //             wallet_data: resWallet.rows.length === 0? 0: resWallet.rows[0].total_tokens,
    //             data: {
    //                 steps: 0,
    //                 calories: 0,
    //                 heart_minutes: 0,
    //                 distance: 0
    //             }

    //         })
    //     }else{

    //     const today = new Date();
    //     let updatedAtDate = new Date(dataQueryRes.rows[0].updated_at);
    //  let sameDay =  `${today.getUTCDate()}-${today.getUTCMonth() + 1}-${today.getUTCFullYear()}` ===
    //      `${updatedAtDate.getUTCDate()}-${
    //          updatedAtDate.getUTCMonth() + 1
    //      }-${updatedAtDate.getUTCFullYear()}`;

    //  if (sameDay){
    //     const getRunHistory = `select * from core.run_history where user_id ='${user_id}' order by updated_at desc limit 1;`;
    //     const getRunHistoryRes = await client.query(getRunHistory);
    //         res.status(200).send({
    //         wallet_data: resWallet.rows.length === 0? 0: resWallet.rows[0].total_tokens,
    //         data: {
    //             steps: getRunHistoryRes.rows[0].steps,
    //             calories:  getRunHistoryRes.rows[0].calories,
    //             heart_minutes:  getRunHistoryRes.rows[0].heart_rate,
    //             distance:  parseFloat((getRunHistoryRes.rows[0].distance/1000).toFixed(2))
    //         }
    //     })



    //  }
    //  else {
    //     res.status(200).send({
    //         wallet_data: resWallet.rows.length === 0? 0: resWallet.rows[0].total_tokens,
    //         data: {
    //             steps: 0,
    //             calories: 0,
    //             heart_minutes: 0,
    //             distance: 0
    //         }

    //     })
    //  }
    // }
    } catch (e) {
        console.log(e);
        res.status(500).send({ message: "Server Error" });
    } finally {
        client.release();
    }
});


router.route("/apple-data").post(verifyJWT,async (req, res) => {
    const { user_id,steps,distance} = req.body;
    const client = await pgPool.connect();
    try {


       const userTokensQ = `select current_distance, total_distance,total_tokens from core.user_token where user_id='${user_id}'`;
        const userTokensRes = await client.query(userTokensQ);
        let updated_steps = steps

    // utils functions

        const updateTokens = async (value) => {
            const updateTotalDistQ = `update core.user_token set current_distance = current_distance + ${value/1000} ,total_distance=  total_distance + ${value/1000}  where user_id='${user_id}'`
            await client.query(updateTotalDistQ)
        }
        // Case when there is at least one record of that user in run history table
        const updateTokensDifference = async (value) => {
            //console.log(value)


            // Could be sum of distance
            const userRunHistoryQ = `select distance as total_distance from core.run_history where user_id='${user_id}' order by updated_at desc limit 1;`
            const userRunHistoryRes = await client.query(userRunHistoryQ);

            const distanceDifference = value === 0 ?0 : (Math.abs((value - userRunHistoryRes.rows[0].total_distance))/1000);
            //console.log(distanceDifference, value,userRunHistoryRes.rows[0].total_distance,"distance difference");

            const updateTotalDistQ = `update core.user_token set current_distance = ${distanceDifference+ userTokensRes.rows[0].current_distance},total_distance = ${distanceDifference+ userTokensRes.rows[0].total_distance}  where user_id='${user_id}'`;
            await client.query(updateTotalDistQ)
        }

        const update = async (steps, dist, cal, heart,currDate, dateString, startTime, endTime) => {
            //console.log(steps, dist, cal, heart, startTime, endTime, currDate);
            const updateDataQuery = `update core.run_history rh set started_at='${new Date(
                parseInt(startTime)).toUTCString()}',
                                 ended_at='${new Date(parseInt(endTime)).toUTCString()}',
                                 steps=${parseFloat(steps)},
                                 distance=${parseFloat(dist)},
                                 calories=${parseFloat(cal)},
                                 heart_rate= ${parseFloat(heart)},
                                 updated_at='${currDate}',
                                data_type='google-fit-data'
                                 where user_id='${user_id}' and  date(rh.updated_at)='${dateString}' returning steps, distance, heart_rate, calories;`;

            //const dataQ = `select * from core.run_history where user_id='${user_id}' and date(updated_at)='${dateString}'`;

            //console.log(a)
            return await client.query(updateDataQuery);
        }

        const insert = async (steps, dist, cal, heart, startTime, endTime,currDate) =>{
            //console.log(steps, dist, cal, heart, startTime, endTime, currDate);
            const dataInsertQuery = `insert into core.run_history(user_id, started_at, ended_at, steps, distance, calories, heart_rate, updated_at, data_type)
      values(
             '${user_id}',
             '${new Date(parseInt(startTime)).toUTCString()}',
             '${new Date(parseInt(endTime)).toUTCString()}',
             ${parseFloat(steps)},
             ${parseFloat(dist)},
             ${parseFloat(cal)},
             ${parseFloat(heart)},
             '${currDate}',
             'google-fit-data'
             ) returning *`;

       return     await client.query(dataInsertQuery);

        }
// utils functions end

        const dataQuery = `select updated_at from core.run_history where user_id ='${user_id}' order by updated_at desc limit 1;`;
        const dataQueryRes = await client.query(dataQuery);
        console.log(dataQueryRes.rows[0]);
        const endTimeStamp = new Date().setUTCHours(24, 0, 0, 0)-1000;
        const startTimeStamp = new Date().setUTCHours(0, 0, 0, 0)+1000;
        const userInfoQ = `select height, weight from core."user"  where id='${user_id}';`;
        const userInfoRes = await client.query(userInfoQ);
        const {height, weight} = userInfoRes.rows[0];
        console.log(height, weight)

        // TODO: logic for distance and calories

        const DISTANCE_CONSTANT = 0.414;
        const AVG_TIME_FOR_WALKING = 13;
        const MET_WALKING = 4.3;


        const distanceInMeters  = distance;

// TODO: implement heart point logic. For now heart points = 0;
        // heart points are just ine min of any activity of METs of value between 3.0 to 5.9
        //Since our MET comes out to be 4.3, we can reward one heart point every minute for the duration of that activity
        // speed =  distance / time

        // Average speed of walking is (from google search) is 4.6 kmph. But we should really get the duration of activity from the front end, otherwise the calcua
        /*
        * Average speed of walking is (from google search) is 4.6 kmph.
        * But we should really get the duration of activity from the front end.
        * Otherwise the calculations will be far less accurate
        *
        * */
        //This time will be hours

        const distanceInKM = distanceInMeters/1000;
        const timeInMinutes = distanceInKM * AVG_TIME_FOR_WALKING;
        const calories = ((weight||70) * 3.5 * AVG_TIME_FOR_WALKING* distanceInKM * MET_WALKING )/200;

        /*
        * Since, according to Google fit, one minute of exercise walk (brisk walk) is one heart point so
        * */

        const heartPoint = Math.ceil(timeInMinutes);
        //console.log(dayDifference, "day f")
        let response={}
        // if today's data is not present int the database
        if (dataQueryRes.rowCount === 0){
            // TODO: insert data into the DB
            console.log("no data present for the user")
            await updateTokens(distanceInMeters);

           response=  await insert(updated_steps, distanceInMeters, calories, heartPoint, startTimeStamp, endTimeStamp, new Date().toUTCString());

    }
        else {
            console.log("sgdafdfsa here boy")
            const today = new Date();
               let updatedAtDate = new Date(dataQueryRes.rows[0].updated_at);
            let sameDay =  `${today.getUTCDate()}-${today.getUTCMonth() + 1}-${today.getUTCFullYear()}` ===
                `${updatedAtDate.getUTCDate()}-${
                    updatedAtDate.getUTCMonth() + 1
                }-${updatedAtDate.getUTCFullYear()}`;
            console.log( `${updatedAtDate.getUTCDate()}-${
                updatedAtDate.getUTCMonth() + 1
            }-${updatedAtDate.getUTCFullYear()}`)
            console.log(`${today.getUTCDate()}-${today.getUTCMonth() + 1}-${today.getUTCFullYear()}`)
            const  dayDifference = Math.round((new Date() - updatedAtDate)/86400000);
            console.log(dayDifference, "day f",(new Date() - updatedAtDate)/86400000)


            if (sameDay ){
                console.log("same day")
                const todaysDate = new Date();
                const todaysDateString = `${todaysDate.getUTCFullYear()}-${String(todaysDate.getUTCMonth()+1).padStart(2,0)}-${String(todaysDate.getUTCDate()).padStart(2,0)}`;
                await updateTokensDifference(distanceInMeters);
                response =   await update(updated_steps, distanceInMeters, calories, heartPoint,new Date().toUTCString(), todaysDateString,startTimeStamp, endTimeStamp );
                //console.log(response.rows[0])
            }
            else {
                //console.log("todays daata not present")
                await updateTokens(distanceInMeters);
                response= await insert(updated_steps, distanceInMeters, calories, heartPoint, startTimeStamp, endTimeStamp, new Date().toUTCString());

            }

        }

        console.log(response.rows);

            res.status(200).send({
                wallet_data: userTokensRes.rows.length === 0? 0: userTokensRes.rows[0].total_tokens,
                data: {
                    steps: response.rows[0].steps,
                    calories:  response.rows[0].calories,
                    heart_minutes:  response.rows[0].heart_rate,
                    distance:  parseFloat((response.rows[0].distance/1000).toFixed(2))
                }

            })








    //     const dataQuery = `select updated_at from core.run_history where user_id ='${user_id}' order by updated_at desc limit 1;`;
    //     const dataQueryRes = await client.query(dataQuery);
    //     const walletDataQuery =  `select total_tokens from core.user_token where user_id='${user_id}'`;
    //     const resWallet = await client.query(walletDataQuery);
    //             if (dataQueryRes.rowCount === 0){
    //         res.status(200).send({
    //             wallet_data: resWallet.rows.length === 0? 0: resWallet.rows[0].total_tokens,
    //             data: {
    //                 steps: 0,
    //                 calories: 0,
    //                 heart_minutes: 0,
    //                 distance: 0
    //             }

    //         })
    //     }else{

    //     const today = new Date();
    //     let updatedAtDate = new Date(dataQueryRes.rows[0].updated_at);
    //  let sameDay =  `${today.getUTCDate()}-${today.getUTCMonth() + 1}-${today.getUTCFullYear()}` ===
    //      `${updatedAtDate.getUTCDate()}-${
    //          updatedAtDate.getUTCMonth() + 1
    //      }-${updatedAtDate.getUTCFullYear()}`;

    //  if (sameDay){
    //     const getRunHistory = `select * from core.run_history where user_id ='${user_id}' order by updated_at desc limit 1;`;
    //     const getRunHistoryRes = await client.query(getRunHistory);
    //         res.status(200).send({
    //         wallet_data: resWallet.rows.length === 0? 0: resWallet.rows[0].total_tokens,
    //         data: {
    //             steps: getRunHistoryRes.rows[0].steps,
    //             calories:  getRunHistoryRes.rows[0].calories,
    //             heart_minutes:  getRunHistoryRes.rows[0].heart_rate,
    //             distance:  parseFloat((getRunHistoryRes.rows[0].distance/1000).toFixed(2))
    //         }
    //     })



    //  }
    //  else {
    //     res.status(200).send({
    //         wallet_data: resWallet.rows.length === 0? 0: resWallet.rows[0].total_tokens,
    //         data: {
    //             steps: 0,
    //             calories: 0,
    //             heart_minutes: 0,
    //             distance: 0
    //         }

    //     })
    //  }
    // }
    } catch (e) {
        console.log(e);
        res.status(500).send({ message: "Server Error" });
    } finally {
        client.release();
    }
});


module.exports = router;
