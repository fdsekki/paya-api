const Stellar = require("stellar-sdk");
// const db = require("./db");
const fetch = require("node-fetch");
const { createTrustline, allowTrustline, payment } = require("./utils");
// const CryptoJS = require("crypto-js");
const stellarServer = new Stellar.Server("https://horizon-testnet.stellar.org");
require("dotenv").config();
const mysql = require("mysql2");
// const { v4: uuidv4 } = require("uuid");
const { TimeoutInfinite } = require("stellar-base");

const con = mysql.createConnection(process.env.DATABASE_URL);

con.connect(function (err) {
  if (err) throw err;
  console.log("Connected!");
});

const Query = {
  userById: (root, args, context, info) => {
    return "Hello World";
  },
};

const Mutation = {
  createUser: async (root, args, context, info) => {
    /**
     * ! things to do for security:
     * ? encrypt the seeds when adding to db
     * ? make sure to be protected from sql injection with mysql.escape()
     * ? never use plain text keys in code
     * ? all functions that can be in utils.js file must be rearranged from resolvers.js
     */

    const keypair = Stellar.Keypair.random();
    let sql = `INSERT INTO users(email, name, surname, stellarAccount, stellarSeed) VALUES(?, ?, ?, ?, ?)`;
    let new_user = [
      mysql.escape(args.email),
      mysql.escape(args.name),
      mysql.escape(args.surname),
      mysql.escape(keypair.publicKey()),
      mysql.escape(keypair.secret()),
      // mysql.escape(await encryptedSecret.toString("utf-8")),
    ];

    const fundAccounts = async () => {
      try {
        await fetch(
          `https://friendbot.stellar.org?addr=${encodeURIComponent(
            keypair.publicKey()
          )}`
        );
      } catch (e) {
        console.log("Error: ", e);
      }
    };

    /* 

      to decrypt:
      
      utils
        .encrypt(Buffer.from("abc", "utf-8"))
        .then(utils.decrypt)
        .then((plaintext) => {
          console.log(plaintext.toString("utf-8"));
        });

    */

    // let encryptedSecret = await utils.encrypt(
    //   Buffer.from(keypair.secret(), "utf-8")
    // );

    fundAccounts()
      .then(() => {
        console.log("OK");
        createTrustline(keypair.publicKey(), keypair.secret()).then(
          con.connect(async function (err) {
            if (err) throw err;

            con.query(sql, new_user, (err, results, fields) => {
              if (err) {
                return console.error("DATABASE_ERROR: ", err.message);
              }
              console.log("new user added to the database");
            });

            await allowTrustline(con, keypair.publicKey());
            await payment(keypair.publicKey());
          })
        );
      })
      .catch((e) => {
        console.log("Error", e);
        throw e;
      });
  },

  createPayment: async (root, args, context, info) => {
    /**
     * ! things to do for security
     * ? decrypt the seeds when querying data from db
     * ? make sure to be protected from sql injection with mysql.escape()
     * ? never use plain text keys in code
     * ? all functions that can be in utils.js file must be rearranged from resolvers.js
     */

    let senderSql =
      `SELECT * FROM users WHERE email LIKE ` + "'%" + args.sender + "%' ";
    let recipientSql =
      `SELECT * FROM users WHERE email LIKE ` + "'%" + args.recipient + "%' ";

    con.query(senderSql, [true], async (error, results, fields) => {
      if (error) {
        return console.log(error.message);
      }

      const senderAccount = results.map((usr) => {
        const replacedEmail = usr.email.replace("'", "");
        const replacedStellarAccount = usr.stellarAccount.replace("'", "");

        if (replacedEmail.replace("'", "") === args.sender) {
          return replacedStellarAccount.replace("'", "");
        }
      });

      const responseSender = await Promise.all(senderAccount).then(
        (response) => {
          for (let i = 0; i <= response.length; i++) {
            if (typeof response[i] !== "undefined") {
              return response[i];
            }
          }
        }
      );

      const senderSeed = results.map((usr) => {
        const replacedEmail = usr.email.replace("'", "");
        const replacedStellarSeed = usr.stellarSeed.replace("'", "");
        if (replacedEmail.replace("'", "") === args.sender) {
          return replacedStellarSeed.replace("'", "");
        }
      });

      const responseSenderSeed = await Promise.all(senderSeed).then(
        (response) => {
          for (let i = 0; i <= response.length; i++) {
            return response[i];
          }
        }
      );

      con.query(recipientSql, [true], async (error, results, fields) => {
        if (error) {
          return console.log(error.message);
        }

        const recipientAccount = results.map((usr) => {
          const replacedEmail = usr.email.replace("'", "");
          const replacedStellarAccount = usr.stellarAccount.replace("'", "");

          if (replacedEmail.replace("'", "") === args.recipient) {
            return replacedStellarAccount.replace("'", "");
          }
        });

        const responseRecipient = await Promise.all(recipientAccount).then(
          (response) => {
            for (let i = 0; i <= response.length; i++) {
              if (typeof response[i] !== "undefined") {
                return response[i];
              }
            }
          }
        );

        const account = await stellarServer.loadAccount(responseSender);
        const AnchorMDLT = new Stellar.Asset(
          "MDLT",
          "GCEFEX2OMYPOCPYJZDUWLHHY4ESOST7JYQ5TOGDFVKRRIQCNNGPOMKK7" // maib(issuer) public key
        );
        const asset =
          args.currency_receiving === "XLM"
            ? Stellar.Asset.native()
            : AnchorMDLT;
        const amount = args.quantity;
        const standardFee = await stellarServer.fetchBaseFee();
        const senderSeed = Stellar.Keypair.fromSecret(responseSenderSeed);
        const memo = args.memo;
        const transactionOptions = {
          fee: standardFee,
          networkPassphrase: Stellar.Networks.TESTNET,
        };
        const payment = {
          destination: responseRecipient,
          asset: asset,
          amount: amount.toString(),
        };

        const transaction = new Stellar.TransactionBuilder(
          account,
          transactionOptions
        )
          .addOperation(Stellar.Operation.payment(payment))
          .addMemo(Stellar.Memo.text(memo))
          .setTimeout(TimeoutInfinite)
          .build();

        transaction.sign(senderSeed);

        try {
          await stellarServer.submitTransaction(transaction).then(() => {
            console.log("OK");

            let sql = `INSERT INTO transactions(currency_receiving, currency_sending, quantity, send_date, recipient, sender) VALUES(?, ?, ?, ?, ?, ?)`;
            let new_transaction = [
              mysql.escape(args.currency_receiving),
              mysql.escape(args.currency_sending),
              mysql.escape(args.quantity),
              new Date(),
              mysql.escape(args.recipient),
              mysql.escape(args.sender),
            ];

            con.query(sql, new_transaction, (err, results, fields) => {
              if (err) {
                return console.error(err.message);
              }

              console.log("new transaction made");
            });
          });
        } catch (e) {
          console.log(`failure ${e}`);

          throw e;
        }
      });
    });
  },
};

module.exports = { Query, Mutation };
