import { unit, validators } from './utils/constants';
import { toHuman, waitTx } from './utils/helper';
const { ethers } = require('hardhat');
const log = console.log.bind(console);

const main = async () => {
    const signers = await ethers.getSigners();
    const provider = await ethers.provider;
    
    const tx = await provider.getTransaction('0x447f4be663cfbcb8251a957f38ea9eb1dec0123030e1f7a13802c37afc71ea71')

};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
