const router = require('express').Router();
const dotenv = require('dotenv');
const pg = require('pg');
const Pool = pg.Pool;
const DATABASE_OPTIONS = require('../config.js');
dotenv.config();


const pgPool = new Pool(DATABASE_OPTIONS);
const { verifyJWT, verifyToken}  = require('../helpers/googleHelper')







router.route("/test").get(async (req, res) => {
  console.log(req.user);



  const client = await pgPool.connect();
  try {

    const q = `select now() from core."user"`;
    const result = await client.query(q);
    res.send({success: true,
      token: 'kasd',
      res: result.rows.splice(0,1)
    })
  }
  catch (e) {
    console.log(e);
    res.status(500).send({
        code: 500,
        status: e.message,
        message: "Server Error",

    })
  }







})




router.route("/weekly-data").get(verifyJWT, async (req, res)=> {
  const client = await pgPool.connect();
  const {user_id, type} = req.query;

  try {
    const weekDataQuery = `
            with rh as (
                select user_id, date(now()-interval '6 day') as left_val, date(now()) as right_val
                from core.run_history t
                group by user_id
            )
            select rh.user_id, rh.updated_at, coalesce(core.run_history.steps, 0) as steps,
                   coalesce(core.run_history.distance, 0) as distance,
                   coalesce(core.run_history.calories, 0) as calories ,
                   coalesce(core.run_history.heart_rate, 0) as heart_minutes
            from (select rh.*, generate_series(left_val, right_val, interval '1 day' ) as updated_at
                  from rh where user_id='${user_id}'
                 ) rh left join
                 core.run_history
                 on date(rh.updated_at) = date(core.run_history.updated_at) ;`;

    const weekDataQueryRes = await  client.query(weekDataQuery);
    if (!type|| type===""){
      res.send({data:weekDataQueryRes.rows});
    }
    else {
      res.send({data:
          weekDataQueryRes.rows.map(x => {
              return {
                  updated_at: Date.parse(x.updated_at),
                  [type]: x[type],
                  user_id: x.user_id
              }
          })
      });
    }

  }
   catch (e) {
    console.log(e);
    res.status(500).send({
        code: 500,
        status: e.message,
        message: "Server Error",

    });
   }
   finally {
    client.release();
  }
});


router.route("/daily-data").get(async (req, res) => {
  const fetch = require('node-fetch');
  const {

    user_id
      ,
      auth_token
  } = req.query;

  //const auth_token = req.headers.authorization.split(" ")[1];
    //const auth_token=  "ya29.A0AVA9y1v32Z6AIYoTPqUvYWAmLD4z0Cnh3ihpbxzTHXYNkcaVQFdsO-QNCLZx-1Y3TOCnN4wG91o3KTquT-uIK_eMslSjYg0xuWaJRDIlHQ2oTwAnQS8Gi6zVcroMJ78hXaECl2tmBn0yRLYpJVKjYgzdqr6xYUNnWUtBVEFTQVRBU0ZRRl91NjFWaGxBYkY4SmJhOU1XQ3JfUEppdzJFUQ0163"


  const client = await pgPool.connect();
  try {
    const dataQuery = `select updated_at from core.run_history where user_id ='${user_id}' order by updated_at desc limit 1;`;
    const dataQueryRes = await client.query(dataQuery);
    console.log(dataQueryRes.rows)
    const endTimeStamp = new Date().setUTCHours(24, 0, 0, 0)-1000;
    console.log(endTimeStamp);
    const today = new Date();
    console.log(today);
    let updatedAtDate;
    if (dataQueryRes.rowCount > 0) {
      updatedAtDate = new Date(dataQueryRes.rows[0].updated_at);
    }
   // console.log(updatedAtDate)
    let sameDay;
    if (dataQueryRes.rowCount > 0) {
    sameDay =  `${today.getUTCDate()}-${today.getUTCMonth() + 1}-${today.getUTCFullYear()}` ===
      `${updatedAtDate.getUTCDate()}-${
            updatedAtDate.getUTCMonth() + 1
          }-${updatedAtDate.getUTCFullYear()}`;
    }
      let dayMillis = 86400000;
      const startTimeStamp = dataQueryRes.rowCount === 0 || sameDay ? new Date().setUTCHours(0, 0, 0, 0)+1000 : new Date().setUTCHours(0, 0, 0, 0) +1000 -dayMillis;
   // console.log(startTimeStamp)
   const walletDataQuery =  `select total_tokens from core.user_token where user_id='${user_id}'`;
   const resWallet = await client.query(walletDataQuery);

    const request = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${auth_token}`,{
      method: 'get',
    });
    const response = await request.json();
    console.log(response)
    const scope = response.scope.split(" ");

    const activityScope = scope.find(x => x.includes("activity"))
    const locationScope = scope.find(x => x.includes("location"))
    let payload;
  //  console.log(Math.round(new Date() - updatedAtDate)/dayMillis,'diff')
    const  dayDifference = Math.round((new Date() - updatedAtDate)/dayMillis);
   // console.log(dayDifference);

   // console.log(dayDifference,"day difference")
    if(!activityScope && !locationScope){
      res.status(400).send({
        code : 400,
        message:'At least one scope is required'
      });
      return;
    }
    else if(!activityScope && locationScope){
      payload  = {
        aggregateBy: [
          {
            dataSourceId: "derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta",
          },


        ],
        endTimeMillis: endTimeStamp,
        startTimeMillis: startTimeStamp,
        bucketByTime: {
          durationMillis: dayMillis,
        },
      };

    }
    else if(activityScope && !locationScope){
      payload = {
        aggregateBy: [{
          dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
        },

          {
            dataSourceId: "derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended",
          },


          {
            dataSourceId: "derived:com.google.heart_minutes:com.google.android.gms:merge_heart_minutes",
          },
        ],
        endTimeMillis: endTimeStamp,
        startTimeMillis: startTimeStamp,
        bucketByTime: {
          durationMillis: dayMillis,
        },
      };

    }
    else {
      //console.log("here")
      payload = {
        aggregateBy: [{
          dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
        },

          {
            dataSourceId: "derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended",
          },

          {
            dataSourceId: "derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta",
          },

          {
            dataSourceId: "derived:com.google.heart_minutes:com.google.android.gms:merge_heart_minutes",
          },
        ],
        endTimeMillis: endTimeStamp,
        startTimeMillis: startTimeStamp,
        bucketByTime: {
          durationMillis: dayMillis,
        },
      };

    }




    const googleFitReq = await fetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
        method: "post",
        body: JSON.stringify(payload),
        headers: {
          Authorization: `Bearer ${auth_token}`,
        },
      }
    );
    const googleFitReqRes = await googleFitReq.json();
    // console.log(googleFitReqRes.bucket[0].dataset[3])
      //console.log(googleFitReqRes.bucket[0].dataset);


      let stepsYes, distYes, heartYes, caloriesYes;
    if (googleFitReqRes.bucket){
        let dataBucket;
        let yesterdayBucket;
        if (googleFitReqRes.bucket.length === 1){
            dataBucket = googleFitReqRes.bucket[0]
        }
        else {
            yesterdayBucket = googleFitReqRes.bucket[0];
            dataBucket = googleFitReqRes.bucket[1]
        }


        //console.log(dataBucket.dataset.forEach(e => console.log(e.point)))

        const dataset = dataBucket.dataset
        const startTime = dataBucket.startTimeMillis;
        const endTime = dataBucket.endTimeMillis;

        let datasetYes;
        let startTimeYes;
        let endTimeYes;

        if(yesterdayBucket){
            datasetYes = yesterdayBucket.dataset
            startTimeYes = yesterdayBucket.startTimeMillis;
            endTimeYes = yesterdayBucket.endTimeMillis;
        }

        // dataset[4].point.length === 0
        //   ? 0
        //   : dataset[4].point[0].value.reduce((pre, curr) =>
        //       console.log(pre, curr)
        //     ),
        const intSum = (arr)=>{
          let sum = 0;
          for (let i = 0; i<arr.length;i++){
            sum += arr[i].intVal;
          }
          return sum;
        }

        const floatSum = (arr) => {
          let sum = 0;
          for (let i = 0; i < arr.length; i++) {
            sum += arr[i].fpVal;
          }
          return parseFloat(sum.toFixed(2));
        };




        let finalResponse = {};
        if (!activityScope && locationScope){
            // Previous day's data
            if (yesterdayBucket){
                stepsYes = 0;
                caloriesYes = 0;
                heartYes = 0;
                distYes =
                  datasetYes[0].point.length === 0
                    ? 0
                    : floatSum(datasetYes[0].point[0].value);

            }



            // Current day's data
            finalResponse = {
                steps: 0,
                calories: 0,
                heart_minutes:0,
                distance: dataset[0].point.length === 0 ?
                    0 :
                    floatSum(dataset[0].point[0].value)
            }




        }
        else if(activityScope && !locationScope){
            if (yesterdayBucket){
                //Previous Day's Data
                stepsYes =
                  datasetYes[0].point.length === 0
                    ? 0
                    : intSum(datasetYes[0].point[0].value);



                caloriesYes =
                  datasetYes[1].point.length === 0
                    ? 0
                    : floatSum(datasetYes[1].point[0].value);

                distYes = 0;
                heartYes =
                  datasetYes[2].point.length === 0
                    ? 0
                    : datasetYes[2].point[0].value[0].fpVal.toFixed(2);

            }

            // Current Day's data


            //Steps
            finalResponse = {
                steps: dataset[0].point.length === 0
                    ? 0
                    : intSum(dataset[0].point[0].value),
                calories: dataset[1].point.length === 0 ?
                    0 :floatSum(dataset[1].point[0].value),
                heart_minutes: dataset[2].point.length === 0 ?
                    0 : dataset[2].point[0].value[0].fpVal.toFixed(2),
                distance: 0
            }

        }
        else {
         // console.log('hkjsdbgfkfdhsbgbjhkfbsdk')
            // Previous Day's data
            if (yesterdayBucket){

                stepsYes =
                  datasetYes[0].point.length === 0
                    ? 0
                    : intSum(datasetYes[0].point[0].value);




                  caloriesYes =
                    datasetYes[1].point.length === 0
                      ? 0
                      : floatSum(datasetYes[1].point[0].value);




                heartYes =
                  datasetYes[3].point.length === 0
                    ? 0
                    : datasetYes[3].point[0].value[0].fpVal.toFixed(2);



                distYes =
                  datasetYes[2].point.length === 0
                    ? 0
                    : floatSum(datasetYes[2].point[0].value);



            }// end if yesterday bucket

            // Current day's data
            finalResponse = {
                steps: dataset[0].point.length === 0 ?
                    0 :
                    intSum(dataset[0].point[0].value),
                calories: dataset[1].point.length === 0 ?
                    0 :
                    floatSum(dataset[1].point[0].value),
                heart_minutes: dataset[3].point.length === 0 ?
                    0 :
                    dataset[3].point[0].value[0].fpVal.toFixed(2),
                distance: dataset[2].point.length === 0 ?
                    0 :
                    floatSum(dataset[2].point[0].value),

            }


        }
       // console.log(finalResponse);






      //console.log(steps, distance, calories,"data");

        //Case when there is no record of the user in run history table
        const updateTokens = async (value) => {
            const updateTotalDistQ = `update core.user_token set current_distance = current_distance + ${value/1000} ,total_distance=  total_distance + ${value/1000} where user_id='${user_id}'`
            await client.query(updateTotalDistQ)
        }
        // Case when there is at least one record of that user in run history table
        const updateTokensDifference = async (value) => {
            //console.log(value)

            const userTokensQ = `select current_distance, total_distance from core.user_token where user_id='${user_id}'`;
            const userTokensRes = await client.query(userTokensQ);
            // Could be sum of distance
            const userRunHistoryQ = `select distance as total_distance from core.run_history where user_id='${user_id}' order by updated_at desc limit 1;`
            const userRunHistoryRes = await client.query(userRunHistoryQ);

            const distanceDifference = value === 0 ?0 : (Math.abs((value - userRunHistoryRes.rows[0].total_distance))/1000);
           // console.log(distanceDifference, value,userRunHistoryRes.rows[0].total_distance,"distance difference");

            const updateTotalDistQ = `update core.user_token set current_distance = ${distanceDifference}+current_distance, total_distance = ${distanceDifference}+ total_distance where user_id='${user_id}'`;
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
                                 heart_rate=${parseFloat(heart)},
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

      if (dataQueryRes.rowCount === 0) {


        await insert(finalResponse.steps, finalResponse.distance, finalResponse.calories, finalResponse.heart_minutes, startTime, endTime, new Date().toUTCString())
        await updateTokens(finalResponse.distance);

      } else {
        if (sameDay || dayDifference === 0) {

          const todaysDate = new Date();
          const todaysDateString = `${todaysDate.getUTCFullYear()}-${String(todaysDate.getUTCMonth()+1).padStart(2,0)}-${String(todaysDate.getUTCDate()).padStart(2,0)}`;



            await updateTokensDifference(finalResponse.distance);
            await update(finalResponse.steps, finalResponse.distance, finalResponse.calories, finalResponse.heart_minutes,new Date().toUTCString(), todaysDateString, startTime, endTime);

        }
        else {
           if (dayDifference === 1){
               const yesterday = new Date() - dayMillis;

               const yesterdayDate = new Date(yesterday)
               const yesterdayDateString = `${yesterdayDate.getUTCFullYear()}-${String(yesterdayDate.getUTCMonth()+1).padStart(2,0)}-${String(yesterdayDate.getUTCDate()).padStart(2,0)}`;
               await updateTokensDifference(distYes);
               await update(stepsYes, distYes, caloriesYes, heartYes,yesterdayDate.toUTCString(), yesterdayDateString,startTimeYes, endTimeYes);
               await updateTokens(finalResponse.distance);
               await insert(finalResponse.steps, finalResponse.distance, finalResponse.calories, finalResponse.heart_minutes, startTime, endTime, new Date().toUTCString());

           }
           else if (dayDifference > 1) {

               const yesterday = new Date() - dayMillis;

               const yesterdayDate = new Date(yesterday)


               await updateTokens(distYes);
               await insert(stepsYes, distYes, caloriesYes, heartYes, startTimeYes, endTimeYes, yesterdayDate.toUTCString())
               await updateTokens(finalResponse.distance);
               await insert(finalResponse.steps, finalResponse.distance, finalResponse.calories, finalResponse.heart_minutes, startTime, endTime, new Date().toUTCString());


           }



        }
      }
      const currentDate = new Date();
      res.send({
        wallet_data: resWallet.rows.length === 0? 0: resWallet.rows[0].total_tokens,

        data: {...finalResponse, distance: parseFloat((finalResponse.distance/1000).toFixed(2))},

      })
    }
    else {
      //res.send('error')
      //res.status(googleFitReqRes.error.code).send(googleFitReqRes.error.status)
      const {code , message,status} = googleFitReqRes.error
      res.status(googleFitReqRes.error.code).send({
        code,message,status
      })
    }




  } catch (e) {
    console.log(e);
    res.status(500).send({
        code: 500,
        error: e.message,
        status: 'Server Error',

    })
  } finally {
    client.release();
  }
});


router.route("/leader-board-data").get(verifyJWT,async (req, res) => {
  const client = await pgPool.connect();

  const {user_id} = req.query;
  try{
    const leaderBoardDataQuery = `
    with rh as (
    select user_id, now()::DATE-EXTRACT(DOW from now())::integer-6 as left_val, now()::DATE-EXTRACT(DOW from now())::integer as right_val
    from core.run_history t
    group by user_id
)
select rh.user_id, rh.updated_at, coalesce(core.run_history.steps, 0) as steps,
       coalesce(core.run_history.distance, 0) as distance,
       coalesce(core.run_history.calories, 0) as calories ,
       coalesce(core.run_history.heart_rate, 0) as heart_minutes
from (select rh.*, generate_series(left_val, right_val, interval '1 day' ) as updated_at
      from rh where user_id='${user_id}'
     ) rh left join
     core.run_history
     on rh.updated_at = date(core.run_history.updated_at) ;
    `;
    const leaderBoardQueryRes = await client.query(leaderBoardDataQuery);
    res.send({data:leaderBoardQueryRes.rows});
  }
  catch (e){
    console.log(e);
    res.status(500).send({
        code: 500,
        error: e.message,
        status: "Server Error",

    });
  }
  finally {
    client.release();
  }
});







module.exports = router;
