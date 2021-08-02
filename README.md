# PayA-API

API made with graphql-mysql-nodejs with endpoints like register and make a transaction.

# Try it out

1. Download mysql installer from dev.mysql.com/downloads/installer/
2. Install the product and check your connection with localhost through MySQL Workbench
3. When connected to localhost create a database named paya and two tables, users and transactions.
   Users has the following columns:
   a) idusers - datatype INT, PK, NN, AI
   b) email - datatype VARCHAR(254), NN, UQ
   c) name - datatype VARCHAR(254), NN
   d) surname - datatype VARCHAR(254), NN
   e) stellarAccount - datatype VARCHAR(254), NN, UQ
   f) stellarSeed - datatype VARCHAR(254), NN, UQ

   Transactions has the following columns:
   a) idtransactions - datatype INT, PK, NN, UQ, AI
   b) currency_receiving - VARCHAR(254), NN
   c) currency_sending - VARCHAR(254), NN
   d) quantity - datatype INT, NN
   e) send_date - datatype DATETIME, NN
   f) recipient - datatype VARCHAR(254), NN
   g) sender - datatype VARCHAR(254), NN

4. Go to `https://laboratory.stellar.org/#?network=test` and create two account, take the public key and secret key from there and add them to mysql table users, public key is stellarAccount and secret key is stellarSeed, one account should be maib with email maib@maib.com and another account should be paya with email paya@paya.com. Don't forget to fund these accounts with friendbot so they will become valid.
5. Go to `createIssuer.js` and where you see commented `// paya public account` change the value with the public key that you generated for paya@paya.com account from the database.
6. Go to `utils.js` and where you see comments like `// maib public key`, `// paya public key`, `// paya secret key` change the values with the new ones generated in the stellar laboratory and added to the database.
7. Go to `resolvers.js` and where you see commented `// maib public key` change the value with the new one generated in the stellar laboratory and added to the database.
8. Within the terminal go to the api folder and type `yarn` to install all the packages
9. After installation is done type `node createIssuer.js`, here we are sending to paya account 1000 MDLT from issuer, you should see console log with `All set` if everything worked as supposed, also you can check payments for the account in stellar laboratory.
10. Type `yarn run dev`
11. From the browser go to `localhost:9000/graphiql` and create two users:
    `mutation { createUser(email: "example@example.com", name: "example", surname: "example", password: "example"){ email } }`
    `mutation { createUser(email: "example1@example.com", name: "example", surname: "example", password: "example"){ email } }`
    To check it they were created successfully go to the MySQL Workbench in tab Query 1 and type there `use paya; select * from users;` and you should see two new rows that we created.

When we created two new users, they're accounts were funded with 10000 XLM and 50 MDLT from the paya account. You can check it in the stellar laboratory at explore endpoints and payments by adding there the public key of one of the accounts.

12. Now that we have two account, we can try to send a payment from one user to another, in the `localhost:9000/graphiql` type:
    `mutation { createPayment (currency_receiving: "MDLT", currency_sending:"MDLT", quantity: 5, recipient: "example@example.com", sender: "example1@example.com", memo:"test transaction") }`

    A deposit will look like this:

    ```
        mutation {
            createPayment (currency_receiving: "MDLT", currency_sending:"MDLT", quantity: 5, recipient: "example@example.com", sender: "paya@paya.com", memo:"test transaction")
        }
    ```

    A withdraw will look like this:

    ```
        mutation {
            createPayment (currency_receiving: "MDLT", currency_sending:"MDLT", quantity: 5, recipient: "paya@paya.com", sender: "example@example.com", memo:"test transaction")
        }
    ```
