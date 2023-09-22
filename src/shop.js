const router = require("express").Router();
const dotenv = require("dotenv");
//import fetch from 'node-fetch'
const pg = require("pg");
const Pool = pg.Pool;
const DATABASE_OPTIONS = require("../config.js");
const { verifyJWT } = require("../helpers/googleHelper");
const pgPool = new Pool(DATABASE_OPTIONS);
const { v4: uuidv4 } = require("uuid");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const lo = require("moment/locale/lo");

dotenv.config();

router.route("/buy").post(verifyJWT, async (req, res) => {
  const {
    user_id,
    product_id,
    shipping_address,
    quantity,
    primary_number,
    secondary_number
  } = req.body;
  const client = await pgPool.connect();

  try {
    const userTokenQuery = `select total_tokens from core.user_token where user_id ='${user_id}'`;
    const userTokenQueryRes = await client.query(userTokenQuery);

    const productPriceQuery = `select price , quantity from core.product where id ='${product_id}'`;
    const productPriceQueryRes = await client.query(productPriceQuery);

    if (
      productPriceQueryRes.rows.length > 0 &&
      userTokenQueryRes.rows.length > 0
    ) {
      const totalTokensBefore = Number(userTokenQueryRes.rows[0].total_tokens);
      const price = Number(productPriceQueryRes.rows[0].price);
      const product_quantity = Number(productPriceQueryRes.rows[0].quantity);
      const order_quantity = Number(quantity);

      console.log("totalTokensBefore",totalTokensBefore);
      console.log("price",price);
      console.log("order_quantity",order_quantity);
      console.log("product_quantity",product_quantity);
      if (
        totalTokensBefore >= price * order_quantity &&
        product_quantity >= order_quantity
      ) {
        //const orderInsertQuery = `insert into core.order(user_id, p_id, created_at) values ('${user_id}','${product_id}','${new Date().toISOString()}')`;
        const orderInsertQuery = `insert into core.order(user_id, p_id, shipping_address, quantity, primary_number, secondary_number, buying_price,status)
        values ('${user_id}','${product_id}','${shipping_address}' ,${Number(
          order_quantity
        )}, '${primary_number}','${secondary_number}',${price},'Pending')`;
        await client.query(orderInsertQuery);

        const tokenUpdateQuery = `update core.user_token set total_tokens =${
          totalTokensBefore - price * order_quantity
        } where user_id ='${user_id}'`;
        await client.query(tokenUpdateQuery);

        const historyUpdateQuery = `insert into core.token_history(user_id,created_at,tokens_moved, description) values ('${user_id}','${new Date().toISOString()}',${
          price * order_quantity
        },'Shopping')`;
        await client.query(historyUpdateQuery);

        const productQuantityUpdateQuery = `update core.product set quantity =${
          product_quantity - order_quantity
        } where id ='${product_id}'`;
        await client.query(productQuantityUpdateQuery);

        res.status(200).send({
          totalTokens: totalTokensBefore - price * order_quantity,
          status: "Pending",
        });
      } else if (product_quantity < order_quantity) {
        res.status(200).send({
          totalTokens: totalTokensBefore,
          status: "Not enough stock",
        });
      } else
        res.status(200).send({
          totalTokens: totalTokensBefore,
          status: "Not enough token balance",
        });
    } else {
      res
        .status(200)
        .send({ totalTokens: 0, status: "Product/User not found" });
    }
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/category").post(verifyJWT, async (req, res) => {
  const { c_name, c_subcategory, c_description, cimage } = req.body;
  const client = await pgPool.connect();

  try {
    let images = cimage.replace(/"/gi, "'");
    let id = uuidv4();

    const categoryInsertQuery = `insert into core.category(id, c_name, c_subcategory, c_description, cimage)
        values ('${id}','${c_name}','${c_subcategory}','${c_description}',cast(array ${images} as text[]))`;
    await client.query(categoryInsertQuery);

    res.status(200).send({
      id,
    });
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/category").get(verifyJWT, async (req, res) => {
  const { id, offset: dataStartingIndex } = req.query;
  const client = await pgPool.connect();

  try {
    let totalRecords = 0;

    let productCountQuery = `select  count(id) as total_products from core.category`;
    const offset = dataStartingIndex ? Number(dataStartingIndex) : 0;

  const  productCountQueryRes = await client.query(productCountQuery);

    totalRecords = Number(productCountQueryRes.rows[0].total_products);


  if (offset >= totalRecords) {
      res.status(200).send({
        categories: null,
        totalRecords,
        status: "offset greater than no of records",
      });

    }


    let categoryQuery = `select id, c_name, c_subcategory, c_description, cimage from core.category limit 10 offset ${offset}`;
    if (id) {
      categoryQuery = `select id, c_name, c_subcategory, c_description, cimage from core.category where id = '${id}'`;
    }
    const categoryQueryRes = await client.query(categoryQuery);
   // console.log(categoryQueryRes.rowCount)

    if (categoryQueryRes.rows.length > 0) {
      let categories = [];
      for (let i = 0; i < categoryQueryRes.rows.length; i++) {
        const { id, c_name, c_subcategory, c_description, cimage } =
          categoryQueryRes.rows[i];
        categories.push({ id, c_name, c_subcategory, c_description, cimage });
      }

      res.status(200).send({
        categories,
        totalRecords
      });
    } else {
      res.status(404).send({
        categories: null,
        totalRecords,
        status: "category not found",
      });
    }
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/product").post(verifyJWT, async (req, res) => {
  const { p_name, c_id, p_description, pimage, price, quantity, status } = req.body;
  const client = await pgPool.connect();
  console.log(req.body)

  try {
    const categoryCheckQuery = `select id from core.category where id ='${c_id}'`;
    const categoryCheckQueryRes = await client.query(categoryCheckQuery);

    if (categoryCheckQueryRes.rows.length > 0) {
      let images = pimage.replace(/"/gi, "'");
      let id = uuidv4();

      const productInsertQuery = `insert into core.product(id, p_name, c_id, p_description, pimage, status, price, quantity)
        values ('${id}','${p_name}','${c_id}','${p_description}' ,cast(array ${images} as text[]),'${status}',${Number(
        price
      )},${Number(quantity)})`;
      await client.query(productInsertQuery);

      res.status(200).send({
        id,
        status: "Pending",
      });
    } else {
      res.status(404).send({
        id: null,
        status: "Cateogry doesn't exist",
      });
    }
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/product").get(verifyJWT, async (req, res) => {
  const { id, offset: dataStartingIndex } = req.query;
  const client = await pgPool.connect();
  const offset = dataStartingIndex ? Number(dataStartingIndex) : 0;

  try {
    let totalRecords = 0;

    let productCountQuery = `select  count(id) as total_products from core.product`;
    if (id)
      productCountQuery = `select  count(id) as total_products from core.product where id = '${id}'`;

    productCountQueryRes = await client.query(productCountQuery);

    totalRecords = Number(productCountQueryRes.rows[0].total_products);

    if (!!id && totalRecords === 0) {
      res.status(200).send({
        products: null,
        status: "invalid product id",
      });
    } else if (offset >= totalRecords) {
      res.status(200).send({
        products: null,
        status: "offset greater than no of records",
      });
    } else {
      let productQuery = `select p.id, p.p_name, p.c_id, p.p_description, p.pimage, p.status,p.price, p.quantity, c.c_name from core.product p join core.category c on p.c_id = c.id  limit 10 offset ${offset}`;
      if (id) {
        productQuery = `select p.id, p.p_name, p.c_id, p.p_description, p.pimage, p.status,p.price, p.quantity, c.c_name from core.product p join core.category c on p.c_id = c.id where p.id = '${id}'`;
      }

      const productQueryRes = await client.query(productQuery);

      if (productQueryRes.rows.length > 0) {
        let products = [];
        for (let i = 0; i < productQueryRes.rows.length; i++) {
          const {
            id,
            p_name,
            c_id,
            p_description,
            pimage,
            status,
            price,
            quantity,
            c_name,
          } = productQueryRes.rows[i];
          products.push({
            id,
            p_name,
            c_id,
            p_description,
            pimage,
            status,
            price,
            quantity,
            c_name,
          });
        }

        //console.log(products.length)

        res.status(200).send({
          products,
          totalRecords
        });
      } else {
        res.status(200).send({
          products: null,
          status: "product not found",
        });
      }
    }
  } catch (e) {
    console.log(e);
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/category/products").get(verifyJWT, async (req, res) => {
  const { offset: dataStartingIndex, id } = req.query;
  const client = await pgPool.connect();
  const offset = dataStartingIndex ? Number(dataStartingIndex) : 0;

  try {
    let categoryFound = true;
    if (id) {
      const categoryCheckQuery = `select id from core.category where id ='${id}'`;
      const categoryCheckQueryRes = await client.query(categoryCheckQuery);
      categoryFound = categoryCheckQueryRes.rows.length > 0;
    }
    let totalRecords = 0;

    if (!id || categoryFound) {
      let productInCategoryQuery = `select  p.p_name, p.p_description, p.pimage, p.status,p.price, p.quantity, c.c_name from core.product p join core.category c on p.c_id = c.id  limit 10 offset ${offset} `;

      if (id)
        productInCategoryQuery =   `select  p.p_name, p.p_description, p.pimage, p.status,p.price, p.quantity, c.c_name from core.product p join core.category c on p.c_id = c.id where p.c_id = '${id}' limit 10 offset ${offset}`;

      let productCountQuery =
        "select  count(id) as total_products from core.product p ";

      if (id)
        productCountQuery = `select  count(id) as total_products from core.product p where c_id = '${id}' `;
      const productCountQueryRes = await client.query(productCountQuery);

      totalRecords = Number(productCountQueryRes.rows[0].total_products);

      const productInCategoryQueryRes = await client.query(
        productInCategoryQuery
      );

      if (productCountQueryRes.rows[0].total_products === 0) {
        res.status(200).send({
          products: null,
          status: !!id
            ? "no product found for this category"
            : "no products found",
        });
      } else if (offset >= totalRecords) {
        res.status(200).send({
          products: null,
          status: "offset greater than no of records",
        });
      } //else if (offset < totalRecords) {
      else {
        if (productInCategoryQueryRes.rows.length > 0) {
          let products = [];

          for (let i = 0; i < productInCategoryQueryRes.rows.length; i++) {
            const {
              p_name,
              c_id,
              p_description,
              pimage,
              status,
              price,
              quantity,
              c_name,
            } = productInCategoryQueryRes.rows[i];
            products.push({
              p_name,
              c_id,
              p_description,
              pimage,
              status,
              price,
              quantity,
              c_name
            });
          }

          res.status(200).send({ products });
        } else {
          res.status(200).send({
            products: null,
            status: "no products found for this category",
          });
        }
      }
    } else {
      res.status(404).send({
        products: null,
        status: "category doesn't exist",
      });
    }
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/order/:id").patch(verifyJWT, async (req, res) => {
  const { id } = req.params;
  const { status, reject_reason, tracking_id, courier_provider } = req.body;
  const client = await pgPool.connect();
  try {
    const orderCheckQuery = `select id,user_id,quantity,buying_price from core.order where id ='${id}'`;
    const orderCheckQueryRes = await client.query(orderCheckQuery);
    if (orderCheckQueryRes.rows.length > 0) {
      let orderUpdateQuery = `update core.order set `;
      if (status) {
        orderUpdateQuery = orderUpdateQuery + `status = '${status}' ,`;
        if (status === "rejected") {
          const tokenUpdateQuery = `update core.user_token set total_tokens = total_tokens+${
            orderCheckQueryRes.rows[0].buying_price *
            orderCheckQueryRes.rows[0].quantity
          } where user_id ='${orderCheckQueryRes.rows[0].user_id}'`;
          await client.query(tokenUpdateQuery);
          const historyUpdateQuery = `insert into core.token_history(user_id,created_at,tokens_moved, description) values ('${
            orderCheckQueryRes.rows[0].user_id
          }','${new Date().toISOString()}',${
            orderCheckQueryRes.rows[0].buying_price *
            orderCheckQueryRes.rows[0].quantity
          },'Refund')`;
          await client.query(historyUpdateQuery);
          if (reject_reason)
            orderUpdateQuery =
              orderUpdateQuery + `reject_reason = '${reject_reason}' ,`;
        } else if (status === "shipped") {
          if (tracking_id)
            orderUpdateQuery =
              orderUpdateQuery + `tracking_id = '${tracking_id}' ,`;

          if (courier_provider)
            orderUpdateQuery =
              orderUpdateQuery + `courier_provider = '${courier_provider}' ,`;
        }
      }

      //removing the last comma
      orderUpdateQuery = orderUpdateQuery.substring(
        0,
        orderUpdateQuery.length - 1
      );
      orderUpdateQuery = orderUpdateQuery + `where id = '${id}'`;

      console.log(orderUpdateQuery);
      await client.query(orderUpdateQuery);
      res.status(200).send({
        id,
      });
    } else {
      res.status(404).send({
        id: null,
        status: "order doesn't exist",
      });
    }
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

// get all orders
//TODO: Add jwt verification
router.route("/order").get( verifyJWT,async (req, res) => {

  const {  offset: dataStartingIndex } = req.query;
  const client = await pgPool.connect();
  const offset = dataStartingIndex ? Number(dataStartingIndex) : 0;

  try {
    let totalRecords = 0;

    let productCountQuery = `select  count(id) as total_orders from core.order`;


    productCountQueryRes = await client.query(productCountQuery);

    totalRecords = Number(productCountQueryRes.rows[0].total_orders);

   if (offset >= totalRecords) {
      res.status(200).send({
        data: null,
        totalRecords,
        status: "offset greater than no of records",
      });
    }
    let productQuery = `select  p.p_name as p_name, u.name as user_name, o.* from core."order" o , core.product p, core."user" u where u.id = o.user_id and o.p_id = p.id limit 10 offset ${offset};`;

    const productQueryRes = await client.query(productQuery);
    console.log(productQueryRes.rowCount)

    if (productQueryRes.rows.length > 0) {
      res.status(200).send({
        data: productQueryRes.rows,
        totalRecords
      });
    } else {
      res.status(200).send({
        data: null,
        totalRecords,
        status: "orders not found",
      });
    }
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/product/:id").patch(verifyJWT, async (req, res) => {
  const { id } = req.params;

  const { p_name, c_id, p_description, pimage, price, quantity, status } =
    req.body;

  const client = await pgPool.connect();

  try {
    const productCheckQuery = `select id from core.product where id ='${id}'`;
    const productCheckQueryRes = await client.query(productCheckQuery);

    if (productCheckQueryRes.rows.length > 0) {
      let images;

      if (pimage) images = pimage.replace(/"/gi, "'");

      let productUpdateQuery = `update core.product set `;

      if (p_name)
        productUpdateQuery = productUpdateQuery + `p_name = '${p_name}' ,`;

      if (c_id) productUpdateQuery = productUpdateQuery + `c_id = '${c_id}' ,`;

      if (p_description)
        productUpdateQuery =
          productUpdateQuery + `p_description = '${p_description}' ,`;

      if (pimage)
        productUpdateQuery =
          productUpdateQuery + `pimage = cast(array ${images} as text[]) ,`;

      if (price)
        productUpdateQuery = productUpdateQuery + `price = ${Number(price)} ,`;

      if (quantity)
        productUpdateQuery =
          productUpdateQuery + `quantity =${Number(quantity)} ,`;

      if (status)
        productUpdateQuery = productUpdateQuery + `status = '${status}' ,`;

      //removing the last comma
      productUpdateQuery = productUpdateQuery.substring(
        0,
        productUpdateQuery.length - 1
      );

      productUpdateQuery = productUpdateQuery + `where id = '${id}'`;
      console.log(productUpdateQuery)

      await client.query(productUpdateQuery);

      res.status(200).send({
        id,
      });
    } else {
      res.status(404).send({
        id,
        status: "Product doesn't exist",
      });
    }
  } catch (e) {
    console.log(e)
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/category/:id").patch( verifyJWT,async (req, res) => {
  const { id } = req.params;
  console.log(req.body);
  const { c_name, c_subcategory, c_description, cimage } = req.body;

  const client = await pgPool.connect();

  try {
    const categoryCheckQuery = `select id from core.category where id ='${id}'`;
    const categoryCheckQueryRes = await client.query(categoryCheckQuery);

    if (categoryCheckQueryRes.rows.length > 0) {
      let images;

      if (cimage) images = cimage.replace(/"/gi, "'");

      let categoryUpdateQuery = `update core.category set `;

      if (c_name)
        categoryUpdateQuery = categoryUpdateQuery + `c_name = '${c_name}' ,`;

      if (c_subcategory)
        categoryUpdateQuery =
          categoryUpdateQuery + `c_subcategory = '${c_subcategory}' ,`;

      if (c_description)
        categoryUpdateQuery =
          categoryUpdateQuery + `c_description = '${c_description}' ,`;

      if (cimage)
        categoryUpdateQuery =
          categoryUpdateQuery + `cimage = cast(array ${images} as text[]) ,`;

      //removing the last comma
      categoryUpdateQuery = categoryUpdateQuery.substring(
        0,
        categoryUpdateQuery.length - 1
      );

      categoryUpdateQuery = categoryUpdateQuery + `where id = '${id}'`;

      console.log(categoryUpdateQuery);
      await client.query(categoryUpdateQuery);

      res.status(200).send({
        id,
      });
    } else {
      res.status(404).send({
        id,
        status: "Cateogry doesn't exist",
      });
    }
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/product/:id").delete(verifyJWT, async (req, res) => {
  const { id } = req.params;

  const client = await pgPool.connect();

  try {
    const productCheckQuery = `select id from core.product where id ='${id}'`;
    const productCheckQueryRes = await client.query(productCheckQuery);

    if (productCheckQueryRes.rows.length > 0) {
      let productDeleteQuery = `delete from core.product where id = '${id}'`;

      await client.query(productDeleteQuery);

      res.status(200).send({
        id,
      });
    } else {
      res.status(404).send({
        id,
        status: "Product doesn't exist",
      });
    }
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/category/:id").delete(verifyJWT, async (req, res) => {
  const { id } = req.params;

  const client = await pgPool.connect();

  try {
    const categoryCheckQuery = `select id from core.category where id ='${id}'`;
    const categoryCheckQueryRes = await client.query(categoryCheckQuery);

    if (categoryCheckQueryRes.rows.length > 0) {
      //delete products first
      let productDeleteQuery = `delete from core.product where c_id = '${id}'`;

      await client.query(productDeleteQuery);

      let categoryDeleteQuery = `delete from core.category where id = '${id}'`;

      await client.query(categoryDeleteQuery);

      res.status(200).send({
        id,
      });
    } else {
      res.status(404).send({
        id,
        status: "Cateogry doesn't exist",
      });
    }
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});

router.route("/admin/signin").post(async (req, res) => {
  const client = await pgPool.connect();
  const {email , password} = req.body;
  console.log(req.body)
  try {
    const userQ = `select * from core.admin where username = '${email}';`
    const userQRes = await  client.query(userQ);
    if (userQRes.rowCount > 0){
      const isPasswordCorrect = bcrypt.compareSync(password, userQRes.rows[0].password);
      if (isPasswordCorrect){
        const userPayload = {
          id: userQRes.rows[0].id,
          email: userQRes.rows[0].username,
          iss: 'hlth.run',
          aud: userQRes.rows[0].username
        }
        const token = jwt.sign(userPayload, process.env.JWT_SECRET, {expiresIn: '1h'});
        const refreshToken = jwt.sign(userPayload, process.env.JWT_REFRESH_SECRET, {expiresIn: '30d'});

        const tokenQ = `select * from core.admin_token where admin_id='${userQRes.rows[0].id}'`;
        const tokenQRes = await client.query(tokenQ);
        if (tokenQRes.rowCount > 0){
          const updateQ = `update core.admin_token set tokens=array_append(tokens, '${refreshToken}') where admin_id = '${userQRes.rows[0].id}';`;
          await client.query(updateQ);
        }
        else {
          const insertQ = `insert into core.admin_token(admin_id) values ('${userQRes.rows[0].id}') ;`;
          await client.query(insertQ);
          const updateQ = `update core.admin_token set tokens=array_append(tokens, '${refreshToken}') where admin_id = '${userQRes.rows[0].id}';`;
          await client.query(updateQ);
        }
        console.log("here reacher boi")

        res.send({
          token, refreshToken
        })
      }
    }
    else {
      res.status(404).send({
        code: 404,
        message: "user not found"
      });
    }
  }
  catch (e){
    console.log(e);
    res.status(500).send({
      code: 500,
      status:'server error',
      message: "An error occurred while processing the request"
    });
  }
})



router.route("/getUserOrders").get(  async (req, res) => {
  const { user_id } = req.query;

  const client = await pgPool.connect();
  try {

    const orderCheckQuery = `select p.p_name as p_name,o.* from core.order o,core.product p where user_id ='${user_id}' and o.p_id = p.id`;
    const orderCheckQueryRes = await client.query(orderCheckQuery);
    if (orderCheckQueryRes.rows.length > 0) {

      res.status(200).send({
        data:orderCheckQueryRes.rows
      });
    } else {
      res.status(200).send({
        data:[]
      });
    }
  } catch (e) {
    res.status(500).send({
      code: 500,
      error: e.message,
      status: "Server Error",
    });
  } finally {
    if (client) client.release();
  }
});


module.exports = router;
