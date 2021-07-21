const aws = require("aws-sdk");
const { response } = require("express");
const { Keypair } = require("stellar-sdk");
const Stellar = require("stellar-sdk");

module.exports = {
  encrypt: function encrypt(buffer) {
    const kms = new aws.KMS({
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
      region: "us-east-2",
    });
    return new Promise((resolve, reject) => {
      const params = {
        KeyId: process.env.KEY_ID,
        Plaintext: buffer,
      };
      kms.encrypt(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data.CiphertextBlob);
        }
      });
    });
  },

  decrypt: function decrypt(buffer) {
    const kms = new aws.KMS({
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
      region: "us-east-2",
    });
    return new Promise((resolve, reject) => {
      const params = {
        CiphertextBlob: buffer,
      };
      kms.decrypt(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data.Plaintext);
        }
      });
    });
  },

  // On register create a trustline from the user account to the maib(issuer) account
  createTrustline: async function createTrustline(
    accountPublicKey,
    accountSecretKey
  ) {
    const stellarServer = new Stellar.Server(
      "https://horizon-testnet.stellar.org"
    );

    try {
      const account = await stellarServer.loadAccount(accountPublicKey);

      const standardFee = await stellarServer.fetchBaseFee();
      const transactionOptions = {
        fee: standardFee,
        networkPassphrase: Stellar.Networks.TESTNET,
      };

      const AnchorMDLT = new Stellar.Asset(
        "MDLT",
        "GCEFEX2OMYPOCPYJZDUWLHHY4ESOST7JYQ5TOGDFVKRRIQCNNGPOMKK7" // maib(issuer) public key
      );

      const operation = {
        asset: AnchorMDLT,
      };

      const transaction = new Stellar.TransactionBuilder(
        account,
        transactionOptions
      )
        .addOperation(Stellar.Operation.changeTrust(operation))
        .setTimeout(0)
        .build();

      const accountSeed = Stellar.Keypair.fromSecret(accountSecretKey);
      transaction.sign(accountSeed);

      await stellarServer.submitTransaction(transaction).then(() => {
        console.log("\n***CREATE_TRUSTLINE_REPONSE: Trustline created.");
      });
    } catch (e) {
      console.log("\n***CREATE_TRUSTLINE_ERROR: Create trustline failed.", e);
    }
  },

  allowTrustline: async function allowTrustline(con, trustor) {
    const stellarServer = new Stellar.Server(
      "https://horizon-testnet.stellar.org"
    );

    async function payment(destination) {
      const stellarServer = new Stellar.Server(
        "https://horizon-testnet.stellar.org"
      );

      const distributor = await stellarServer.loadAccount(
        "GDGYRWFS3TOJVZI3WCCR57P6MCBK2OJRPK2V3WJB4ZUIZB6JBWNS7RZP" // paya(MDLT distributor) public key
      );

      const AnchorMDLT = new Stellar.Asset(
        "MDLT",
        "GCEFEX2OMYPOCPYJZDUWLHHY4ESOST7JYQ5TOGDFVKRRIQCNNGPOMKK7" // maib(issuer) public key
      );

      txOptions = {
        fee: await stellarServer.fetchBaseFee(),
        networkPassphrase: Stellar.Networks.TESTNET,
      };

      const paymentOptions = {
        asset: AnchorMDLT,
        destination: destination,
        amount: "50",
      };

      const transaction = new Stellar.TransactionBuilder(distributor, txOptions)
        .addOperation(Stellar.Operation.payment(paymentOptions))
        .setTimeout(0)
        .build();

      transaction.sign(
        Stellar.Keypair.fromSecret(
          "SBH5BNTDP4UU5DPVGC5VB537SE3PM2QKU2OABM4MXOB3A75WIR5RFEVB" // paya(MDLT distributor) secret key
        )
      );

      await stellarServer
        .submitTransaction(transaction)
        .then(() => {
          console.log("\n***PAYMENT_RESPONSE: Transaction made.");
        })
        .catch((e) => {
          console.log("\n***PAYMENT_ERROR: Transaction failed.");
          throw e;
        });
    }

    try {
      let issuerSql = `SELECT * FROM users WHERE email LIKE '%maib@maib.com%'`;

      con.query(issuerSql, [true], async (error, results, fields) => {
        if (error) {
          return console.log(error.message);
        }

        const issuerSeed = results.map((usr) => {
          const replacedEmail = usr.email.replace("'", "");
          const replacedStellarSeed = usr.stellarSeed.replace("'", "");

          if (replacedEmail.replace("'", "") === "maib@maib.com") {
            return replacedStellarSeed.replace("'", "");
          }
        });

        const responseIssuerSeed = await Promise.all(issuerSeed).then(
          (response) => {
            for (let i = 0; i <= response.length; i++) {
              if (typeof response[i] !== "undefined") {
                return response[i];
              }
            }
          }
        );

        const issuingKeys = Stellar.Keypair.fromSecret(responseIssuerSeed);
        const issuingAccount = await stellarServer.loadAccount(
          issuingKeys.publicKey()
        );
        const standardFee = await stellarServer.fetchBaseFee();
        const transactionOptions = {
          fee: standardFee,
          networkPassphrase: Stellar.Networks.TESTNET,
        };
        const AnchorMDLT = new Stellar.Asset(
          "MDLT",
          "GCEFEX2OMYPOCPYJZDUWLHHY4ESOST7JYQ5TOGDFVKRRIQCNNGPOMKK7" // maib(issuer) public key
        );
        const operation = {
          trustor,
          assetCode: AnchorMDLT.code,
          authorize: true,
        };

        const transaction = new Stellar.TransactionBuilder(
          issuingAccount,
          transactionOptions
        )
          .addOperation(Stellar.Operation.allowTrust(operation))
          .setTimeout(0)
          .build();

        transaction.sign(issuingKeys);

        try {
          await stellarServer.submitTransaction(transaction).then(() => {
            console.log("\n***ALLOW_TRUST_REPONSE: Trust allowed");
            payment(trustor);
          });
        } catch (e) {
          throw e;
        }
      });
    } catch (e) {
      console.log("\n***ALLOW_TRUST_ERROR: Allow trust failed", e);
    }
  },
};
