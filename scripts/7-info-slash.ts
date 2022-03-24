import {BSCValidatorSet, SlashIndicator} from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { waitTx } from './utils/helper';
import { SYSTEM_CONTRACT_ADDRESS } from './utils/constants';
const { ethers } = require('hardhat');
const log = console.log;
let slashIndicator: SlashIndicator, operator: SignerWithAddress;

// should approve before swap
const work = async (signer: SignerWithAddress) => {
    const res: any = await slashIndicator.getSlashThresholds()
    log(res)
    log(res.misdemeanorThreshold)
    log(res.felonyThreshold)
};

const init = async () => {
    let signers = await ethers.getSigners();

    slashIndicator = (await ethers.getContractAt(
        'SlashIndicator',
        SYSTEM_CONTRACT_ADDRESS.SlashContract
    )) as SlashIndicator;
};

const main = async () => {
    await init();
    await work(operator);
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
