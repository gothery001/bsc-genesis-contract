const fs = require('fs');
const keythereum = require('keythereum');
const { ethers } = require('hardhat');
const log = console.log.bind(console);

const keys = require('./keystore/keys.json');
const passwords = require('./keystore/passwords.json');

const main = async () => {
  for (let i = 0; i < keys.length; i++) {
    const keystoreObj = keys[i];
    const password = passwords[i];
    const privateKey = keythereum.recover(password, keystoreObj).toString('hex');
    log(`${privateKey}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
