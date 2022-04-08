const { ethers } = require('ethers');
const keythereum = require('keythereum');
const log = console.log.bind(console);
const fs = require('fs');


const main = async () => {
    let nodeKeys = []
    //  encrypt(password: Bytes | string, options?: any, progressCallback?: ProgressCallback): Promise<string>;
    for (let i = 0; i < 10; i++) {
        const skBytes = ethers.utils.randomBytes(32);
        const sk = ethers.utils.hexlify(skBytes);
        nodeKeys.push(sk.slice(2));
    }
    fs.writeFileSync(__dirname +  `/bas-keys/nodekeys.json`, JSON.stringify(nodeKeys, null, 2))

};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
