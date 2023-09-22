const router = require('express').Router();
const pg = require('pg');
const Pool = pg.Pool;
const DATABASE_OPTIONS = require('../config.js');
const lodash = require('lodash');
const {firebaseAdmin} = require('./config/firebaseConfig');
const { verifyJWT} = require('../helpers/googleHelper')
const pgPool = new Pool(DATABASE_OPTIONS);
const util = require('util');
const {sender} = require('../helpers/emailSender.js');
const {invitationAttachments} = require('../attachments/emailAttachments.js');

const sendEmail = util.promisify(sender)

router.route("/UserInfo").post(verifyJWT, async (req, res) => {
    const {email, user_id} = req.body;


    const client = await pgPool.connect();
    try {
        const getInfoQuery = `select id, name, avatar
                              from core.user
                              where email_id = '${email}'`;
        const getInfoQueryRes = await client.query(getInfoQuery);

        if (getInfoQueryRes.rows[0]) {

            var params = [];
            params.push(getInfoQueryRes.rows[0].id);
            console.log(JSON.stringify(params))
            const arr = JSON.stringify(params).replace(/"/gi, "'");

            var getInfoQuery1 = `select id
                                 from core.run_with_friends
                                 where user_id = '${user_id}'
                                   and (cast(ARRAY${arr} as uuid[])) && group_ids `;
            console.log(getInfoQuery1)
            const getInfoQueryRes1 = await client.query(getInfoQuery1);
            var getInfoQuery2 = `select id
                                 from core.friends_request_info
                                 where user_id = '${user_id}'
                                   and request_id = '${getInfoQueryRes.rows[0].id}'`;
            console.log(getInfoQuery2)
            const getInfoQueryRes2 = await client.query(getInfoQuery2);
            if (getInfoQueryRes1.rows[0]) {
                getInfoQueryRes.rows[0].status = 2
                res.send({"data": getInfoQueryRes.rows[0]});
            } else if (getInfoQueryRes2.rows[0]) {
                getInfoQueryRes.rows[0].status = 1
                res.send({"data": getInfoQueryRes.rows[0]});
            } else {
                getInfoQueryRes.rows[0].status = 0
                res.send({"data": getInfoQueryRes.rows[0]});
            }


        } else {

            res.send({"data": {status:4}})
        }

    } catch (e) {
        console.log(e);
        res.status(500).send({
            code: 500,
            status: e.message,
            message: "Server Error",

        });
    } finally {
        client.release();
    }
});

router.route("/test").get(verifyJWT, ((req, res) => {

    res.send(req.accessToken)
}))

router.route("/addFriends").post( verifyJWT,async (req, res) => {
    const {user_id, request_id} = req.body;
    const client = await pgPool.connect();


    try {

        const userInfoQ = `select *
                           from core."user"
                           where id = '${user_id}'`;
        const userInfoRes = await client.query(userInfoQ);
        const senderInfo = userInfoRes.rows[0];
        const receiverInfoQ = `select devicetoken
                               from core."user"
                               where id = '${request_id}'`;
        const receiverInfoRes = await client.query(receiverInfoQ);
        const token = receiverInfoRes.rows[0].devicetoken;
        if(token){
        const messageOptions = {
            priority: "high",
            timeToLive: 60,
        };

        const message = {
            notification: {
                title: "You have a new Connect Request",
                body: `${senderInfo.name} has invited you to run with ${senderInfo.gender === "Male" ? 'him' : 'her'} on HLTH Run app.`,
            },
            data: {
                path: "request",
            }

        }

        firebaseAdmin.messaging().
        sendToDevice(token, message, messageOptions).then(async (d) => {

            const updateGroupInfo = `insert into core.friends_request_info (user_id, request_id)
                                     values ('${user_id}', '${request_id}')`
            const updateGroupInfoRes = await client.query(updateGroupInfo);
            res.status(201).send({
                code: 201,
                message: 'Request sent succesffully',
                status: 'created',

            });
        }).catch(e => {
            console.log(e);
            res.status(500).send({
                code: 500,
                message: "Unable to send message",
                status: "firebase messaging error",

            })
        });
        }else{
            const updateGroupInfo = `insert into core.friends_request_info (user_id, request_id)
            values ('${user_id}', '${request_id}')`
const updateGroupInfoRes = await client.query(updateGroupInfo);
res.status(201).send({
code: 201,
message: 'Request sent succesffully',
status: 'created',

});
        }
       



    } catch (e) {
        console.log(e);
        res.status(500).send({
            code: 500,
            status: e.message,
            message: "Server Error",

        });
    } finally {
        client.release();
    }
});

router.route("/getRequests").post(verifyJWT, async (req, res) => {
    console.log("hello")
    const {user_id} = req.body;

    const client = await pgPool.connect();
    try {
        const getRequests = `select core.user."name",
                                    core.user.avatar,
                                    core.friends_request_info.id,
                                    core.friends_request_info.user_id as request_id
                             from core.user
                                      join core.friends_request_info
                                           on (core.user.id = core.friends_request_info.user_id)
                             where core.friends_request_info.request_id = '${user_id}'`
        const getRequestsRes = await client.query(getRequests);
        res.status(201).send({"data": getRequestsRes.rows,});

    } catch (e) {
        console.log(e);
        res.status(500).send({
            code: 500,
            status: e.message,
            message: "Server Error",

        });
    } finally {
        client.release();
    }
});

router.route("/inviteFriends").post(verifyJWT, async (req, res) => {
    const {email, sender_id} = req.body;

    const client = await pgPool.connect();
    try {
        // const getRequests = `select core.user."name" ,core.user.avatar , core.friends_request_info.id from core.user join core.friends_request_info on (core.user.id = core.friends_request_info.user_id) where core.friends_request_info.request_id='${user_id}' )`
        // const getRequestsRes = await client.query(getRequests);
        const senderInfoQ = `select *
                             from core."user"
                             where id = '${sender_id}'`;
        const senderInfoRes = await client.query(senderInfoQ);
        // const recieverInfoQ = `select * from core."user" where email_id='${email}'`;
        // const recioeverInfoRes = await client.query(recieverInfoQ);
        const options = [{
            name: email.match(/^([^@]*)@/)[1],
            sender_name: senderInfoRes.rows[0].name,
            email: email
        }];
        console.log(options)
        sendEmail("invitation", options, invitationAttachments).then(
            res.status(201).send({data: "Invitation sent Successfully",})
        ).catch(e => {
            console.log(e)
            res.status(500).send({
                code: 500,
                status: e.message,
                message: "Email Error",

            })
        });
        //res.status(201).send({"data":"Invitation sent Successfully"});

    } catch (e) {
        console.log(e);
        res.status(500).send({
            code: 500,
            status: e.message,
            message: "Server Error",

        });
    } finally {
        client.release();
    }
});

router.route("/approveRequests").post(verifyJWT, async (req, res) => {

    const {id, user_id, request_id, method} = req.body;
    const client = await pgPool.connect();

    let group_ids = []
    let group_ids1 = []
    try {
        if (method === "approve") {
            const getInfoQuery = `select group_ids
                                  from core.run_with_friends
                                  where user_id = '${user_id}'`;
            const getInfoQueryRes = await client.query(getInfoQuery);


            if (getInfoQueryRes.rows[0]) {

                group_ids = getInfoQueryRes.rows[0].group_ids;
                if (group_ids.includes(request_id)) {
                    return res.send({message: "user already present"});
                } else {
                    group_ids.push(request_id)


                    group_ids = JSON.stringify(group_ids).replace(/"/gi, "'");
                    const updateGroupInfo = `update core.run_with_friends
                                             set group_ids =
                                                     cast(array ${group_ids} as uuid[])
                                             where user_id = '${user_id}'`
                    const updateGroupInfoRes = await client.query(updateGroupInfo);
                    // res.status(201).send("added successfully");
                }
            } else {
                group_ids.push(user_id);
                group_ids.push(request_id);
                group_ids = JSON.stringify(group_ids).replace(/"/gi, "'");

                const updateGroupInfo = `insert into core.run_with_friends (user_id, group_ids)
                                         values ('${user_id}', cast(array ${group_ids} as uuid[]))`

                console.log(updateGroupInfo)
                const updateGroupInfoRes = await client.query(updateGroupInfo);

            }
            const getInfoQuery1 = `select group_ids
                                   from core.run_with_friends
                                   where user_id = '${request_id}'`;
            const getInfoQueryRes1 = await client.query(getInfoQuery1);

            if (getInfoQueryRes1.rows[0]) {

                group_ids1 = getInfoQueryRes1.rows[0].group_ids;
                if (group_ids1.includes(user_id)) {
                    return res.send({message: "user already present"});
                } else {
                    group_ids1.push(user_id)


                    group_ids1 = JSON.stringify(group_ids1).replace(/"/gi, "'");
                    const updateGroupInfo1 = `update core.run_with_friends
                                              set group_ids =
                                                      cast(array ${group_ids1} as uuid[])
                                              where user_id = '${request_id}'`
                    const updateGroupInfoRes1 = await client.query(updateGroupInfo1);

                }

            } else {
                group_ids1.push(user_id);
                group_ids1.push(request_id);
                group_ids1 = JSON.stringify(group_ids).replace(/"/gi, "'");

                const updateGroupInfo1 = `insert into core.run_with_friends (user_id, group_ids)
                                          values ('${request_id}', cast(array ${group_ids} as uuid[]))`

                console.log(updateGroupInfo1)
                const updateGroupInfoRes = await client.query(updateGroupInfo1);
                // res.status(201).send("added successfully");
            }
            const removeRequest = `delete
                                   from core.friends_request_info
                                   where id = '${id}'`;
            const removeRequestRes = await client.query(removeRequest);
            res.status(201).send({
                code: 201,
                message: 'Added Successfully'
                ,

            });


        } else {
            const removeRequest = `delete
                                   from core.friends_request_info
                                   where id = '${id}'`;
            const removeRequestRes = await client.query(removeRequest);

            res.status(201).send({
                code: 201,
                message: 'Deleted Successfully',


            });


        }
        // const Requests = `select core.user."name" ,core.user.avatar , core.friends_request_info.id from core.user join core.friends_request_info on (core.user.id = core.friends_request_info.user_id) where core.friends_request_info.request_id='${user_id}' )`
        // const getRequestsRes = await client.query(getRequests);
        // res.status(201).send({"data":getRequestsRes.rows});

    } catch (e) {
        console.log(e);
        res.status(500).send({
            code: 500,
            status: e.message,
            message: "Server Error",

        });
    } finally {
        client.release();
    }
});

router.route("/requestSentInfo").post(verifyJWT, async (req, res) => {
    const {user_id} = req.body;

    const client = await pgPool.connect();
    try {
        const requestSentInfo = `select core.user."name", core.user.avatar, core.friends_request_info.id
                                 from core.user
                                          join core.friends_request_info
                                               on (core.user.id = core.friends_request_info.request_id)
                                 where core.friends_request_info.user_id = '${user_id}' `
        const requestSentInfoRes = await client.query(requestSentInfo);
        res.status(201).send({"data": requestSentInfoRes.rows,});

    } catch (e) {
        console.log(e);
        res.status(500).send({
            code: 500,
            status: e.message,
            message: "Server Error",

        });
    } finally {
        client.release();
    }
});

router.route("/leaderboardInfo").post(verifyJWT,async (req, res) => {
    const {user_id} = req.body;

    const client = await pgPool.connect();
    let group_ids;
    try {
        const getInfoQuery = `select group_ids
                              from core.run_with_friends
                              where user_id = '${user_id}'`;
        const getInfoQueryRes = await client.query(getInfoQuery);
if(getInfoQueryRes.rows[0]){
    if (getInfoQueryRes.rows[0].group_ids.length !== 0 ) {

        group_ids = getInfoQueryRes.rows[0].group_ids;

        //console.log(group_ids)


        let modifiedUserList = lodash.cloneDeep(group_ids);




        const runHistoryQ = `select sum(steps) as steps, user_id
                             from core.run_history
                             where updated_at BETWEEN date_trunc('week', now())::date - 1
                                 AND date_trunc('week', now())::date + 6
                               and user_id in ('${modifiedUserList.join(
                                     "','")}')
                             group by user_id`;
        const runHistoryQRes = await client.query(runHistoryQ);


        const userInfoQ = `select name, avatar as avatar, id as user_id
                           from core."user"
                           where id in ('${modifiedUserList.join(
                                   "','")}');`;

        const userInfoQRes = await client.query(userInfoQ);
        const userInfo = userInfoQRes.rows;
        const runHistory = runHistoryQRes.rows;


        let data = lodash.map(userInfo, item =>
            lodash.find(runHistory, {user_id: item.user_id}) ? lodash.extend(item, lodash.find(runHistory, {user_id: item.user_id})) :
                lodash.extend(item, {steps: 0}));
        data = lodash.orderBy(data, x => x.steps,'desc')


        res.status(201).send({
            "data": data,

        })


        // const leaderboardInfo = `select sum(rh.steps)         as steps,
        //                                 max(core.user.name)   as name,
        //                                 max(core.user.avatar) as avatar,
        //                                 rh.user_id
        //                          from core.run_history rh
        //                                   join
        //                               core."user" on (core.user.id = rh.user_id)
        //
        //                          where rh.updated_at BETWEEN date_trunc('week', now())::date - 1
        //                              AND date_trunc('week', now())::date + 6
        //
        //                            and core.user.id in ('${modifiedUserList.join(
        //                                  "','")}')
        //
        //
        //                          group by rh.user_id`
        // const leaderboardInfoRes = await client.query(leaderboardInfo);
        // res.status(201).send({"data": leaderboardInfoRes.rows});

    } else {
        res.status(201).send({"data": [],});
    }
}
else {
    res.status(201).send({"data": [], });
}

    } catch (e) {
        console.log(e);
        res.status(500).send({
            code: 500,
            status: e.message,
            message: "Server Error",

        });
    } finally {
        client.release();
    }
});


router.route("/removeFriend").post(verifyJWT, async (req, res) => {
    const {user_id, request_id} = req.body;


    const client = await pgPool.connect();
    try {
        if(request_id===user_id){
            res.status(202).send({
                code: 202,
                message: 'User Cannot Removed',


            });
        }
else{
        const getInfoQuery = `select group_ids
        from core.run_with_friends
        where user_id = '${user_id}'`;
const getInfoQueryRes = await client.query(getInfoQuery);

let group_ids = getInfoQueryRes.rows[0].group_ids;


group_ids.splice(group_ids.indexOf(request_id), 1)

group_ids = JSON.stringify(group_ids).replace(/"/gi, "'");
const updateGroupInfo = `update core.run_with_friends
           set group_ids =
                   cast(array ${group_ids} as uuid[])
           where user_id = '${user_id}'`
const updateGroupInfoRes = await client.query(updateGroupInfo);

const getInfoQuery1 = `select group_ids
from core.run_with_friends
where user_id = '${request_id}'`;
const getInfoQueryRes1 = await client.query(getInfoQuery1);

let group_ids1 = getInfoQueryRes1.rows[0].group_ids;


group_ids1.splice(group_ids1.indexOf(user_id), 1)

group_ids1 = JSON.stringify(group_ids1).replace(/"/gi, "'");
const updateGroupInfo1 = `update core.run_with_friends
   set group_ids =
           cast(array ${group_ids1} as uuid[])
   where user_id = '${request_id}'`
const updateGroupInfoRes1 = await client.query(updateGroupInfo1);


        res.status(200).send({
            code: 200,
            message: 'Removed User Successfully',


        });

    }
    } catch (e) {
        console.log(e);
        res.status(500).send({
            code: 500,
            status: e.message,
            message: "Server Error",

        });
    } finally {
        client.release();
    }
});

// router.route("/test-rwf").post(async (req, res) => {
//     const client = await pgPool.connect();
//     const calculator = (array, element) => {
//         let sum = 0;
//         for (const e of array) {
//             sum += e[element]
//         }
//         return sum;
//     }
//     const {user_id} = req.body;
//     try {
//         const q = `select group_ids
//                    from core.run_with_friends
//                    where user_id = '${user_id}';`;
//         const r = await client.query(q);
//         const ids = r.rows[0].group_ids;
//
//
//         let finalData = [];
//         for (const e of ids) {
//             const qs = `
//                 with rh as (
//                     select user_id,
//                            now()::DATE - EXTRACT(DOW from now())::integer - 6 as left_val,
//                            now()::DATE - EXTRACT(DOW from now())::integer     as right_val
//                     from core.run_history t
//                     group by user_id
//                 )
//                 select rh.user_id,
//                        rh.updated_at,
//                        coalesce(core.run_history.steps, 0)      as steps,
//                        coalesce(core.run_history.distance, 0)   as distance,
//                        coalesce(core.run_history.calories, 0)   as calories,
//                        coalesce(core.run_history.heart_rate, 0) as heart_minutes
//                 from (select rh.*, generate_series(left_val, right_val, interval '1 day') as updated_at
//                       from rh
//                       where user_id = '${e}'
//                      ) rh
//                          left join
//                      core.run_history
//                      on date(rh.updated_at) = date(core.run_history.updated_at) and
//                         rh.user_id = core.run_history.user_id;
//             `;
//             const rs = await client.query(qs);
//             const d = rs.rows;
//
//             if (d.length === 0) {
//                 finalData.push(({
//                     user_id: e,
//                     steps: 0,
//                     distance: 0,
//                     calories: 0,
//                     heart_points: 0
//                 }));
//
//             } else {
//                 finalData.push(({
//                     user_id: e,
//                     steps: calculator(d, 'steps'),
//                     distance: calculator(d, 'distance'),
//                     calories: calculator(d, 'calories'),
//                     heart_points: calculator(d, 'heart_minutes'),
//                 }));
//             }
//             console.log(rs.rows.length)
//
//         }
//
//
//         res.send(finalData)
//
//     } catch (e) {
//         console.log(e);
//         res.status(500).send("error")
//     } finally {
//         client.release();
//     }
// })


module.exports = router;
