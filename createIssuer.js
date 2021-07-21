const Stellar = require("stellar-sdk");
const mysql = require("mysql2");
require("dotenv").config();
const { TimeoutInfinite } = require("stellar-base");

async function setupIssuer() {
  const stellarServer = new Stellar.Server(
    "https://horizon-testnet.stellar.org"
  );

  const con = mysql.createConnection(process.env.DATABASE_URL);

  con.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
  });

  let senderSql = `SELECT * FROM users WHERE email LIKE '%maib@maib.com%'`;

  con.query(senderSql, [true], async (error, results, fields) => {
    if (error) {
      return console.log(error.message);
    }

    const issureSeed = results.map((usr) => {
      const replacedEmail = usr.email.replace("'", "");
      const replacedStellarSeed = usr.stellarSeed.replace("'", "");
      if (replacedEmail.replace("'", "") === "maib@maib.com") {
        return replacedStellarSeed.replace("'", "");
      }
    });

    const responseIssuerSeed = await Promise.all(issureSeed).then(
      (response) => {
        for (let i = 0; i <= response.length; i++) {
          return response[i];
        }
      }
    );

    const standardFee = await stellarServer.fetchBaseFee();
    const transactionOptions = {
      fee: standardFee,
      networkPassphrase: Stellar.Networks.TESTNET,
    };
    const issuerKeyPair = Stellar.Keypair.fromSecret(responseIssuerSeed);
    const issuingAccount = await stellarServer.loadAccount(
      issuerKeyPair.publicKey()
    );
    const AnchorMDLT = new Stellar.Asset("MDLT", issuerKeyPair.publicKey());

    const operation = {
      asset: AnchorMDLT,
      destination: "GDGYRWFS3TOJVZI3WCCR57P6MCBK2OJRPK2V3WJB4ZUIZB6JBWNS7RZP", // paya public account
      amount: "10000",
    };

    const transaction = new Stellar.TransactionBuilder(
      issuingAccount,
      transactionOptions
    )
      .addOperation(Stellar.Operation.payment(operation))
      .setTimeout(0)
      .build();

    transaction.sign(issuerKeyPair);
    await stellarServer.submitTransaction(transaction).then(() => {
      console.log("All set");
    });
  });
}

setupIssuer();
