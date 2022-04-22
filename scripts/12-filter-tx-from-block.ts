import { unit, validators } from './utils/constants';
import { toHuman, waitTx } from './utils/helper';
const { ethers } = require('hardhat');
const log = console.log.bind(console);

const main = async () => {
    const signers = await ethers.getSigners();
    const provider = await ethers.provider;
    
    for (let i = 178_184; i <= 178_187; i++) {
        const block = await provider.getBlock(i);
        console.log(block.number, block.hash);

        const txs = block.transactions;
        for (const txId of txs) {
            const tx = await provider.getTransaction(txId);
            if (tx.from === '0x072fD8971a9ddBE43fE9bE933CF03070827937D0') {
                console.log(tx);
                const txReceipt = await provider.getTransactionReceipt(tx.hash);
                console.log(txReceipt);
            }
        }
    }
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
