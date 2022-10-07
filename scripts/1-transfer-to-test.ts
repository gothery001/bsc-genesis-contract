import { unit, validators } from './utils/constants';
import { toHuman, waitTx } from './utils/helper';
const { ethers } = require('hardhat');
const log = console.log.bind(console);

const main = async () => {
    const signers = await ethers.getSigners();
    const bnbHolder = signers[signers.length - 1];
    const amount = unit.mul(1).div(100);

    log('bnbHolder', bnbHolder.address, 'balance', toHuman(await bnbHolder.getBalance()));

        const tx = await bnbHolder.sendTransaction({
            from: bnbHolder.address,
            to: '0x446Fd2845C5E6521B7820F980bAdEaA2e8d6CAF8',
            value: amount,
            gasLimit: 250000,
        });

        await tx.wait(1)
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
