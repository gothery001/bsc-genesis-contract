import { unit, validators } from './utils/constants';
import { toHuman, waitTx } from './utils/helper';
const { ethers } = require('hardhat');
const log = console.log.bind(console);

const main = async () => {
    const signers = await ethers.getSigners();


    const tx = await ethers.provider.getTransaction('0x597fb879ac898dbc4e8700d0e5bde4ff2050ecc209eb9400a92ff31e2483f626')
    log(`Transaction: `, tx);

    const receipt = await ethers.provider.getTransactionReceipt('0x597fb879ac898dbc4e8700d0e5bde4ff2050ecc209eb9400a92ff31e2483f626')
    log(receipt)

    const receipt2 = await ethers.provider.getTransactionReceipt('0x408dcc77f9a758cb11fe7582bfaa8203baa8de5e1f77e4db8a91017983421fd0')
    log(receipt2)


    const bnbHolder = signers[signers.length - 1];
    log(`bnbHolder: `, bnbHolder.address, 'balance: ', toHuman(await bnbHolder.getBalance()));
    const amount = unit.mul(1)
    const promise = bnbHolder.sendTransaction({
        from: bnbHolder.address,
        to: bnbHolder.address,
        value: amount,
        gasLimit: 250000,
    });
    const receiptTest = await waitTx(promise);
    log(receiptTest)
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
