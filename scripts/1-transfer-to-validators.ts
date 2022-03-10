import { unit, validators } from './utils/constants';
import { toHuman, waitTx } from './utils/helper';
const { ethers } = require('hardhat');
const log = console.log.bind(console);

const main = async () => {
    const signers = await ethers.getSigners();
    const bnbHolder = signers[signers.length - 1];
    const amount = unit.mul(10);

    log('bnbHolder', bnbHolder.address, 'balance', toHuman(await bnbHolder.getBalance()));

    for (let i = 0; i < validators.length; i++) {
        const validator = validators[i];
        const promise = bnbHolder.sendTransaction({
            from: bnbHolder.address,
            to: validator,
            value: amount,
            gasLimit: 250000,
        });
        await waitTx(promise);

        log(toHuman(await ethers.provider.getBalance(validator)));
    }
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
