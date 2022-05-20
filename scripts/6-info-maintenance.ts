import { BSCValidatorSet } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {toHuman, waitTx} from './utils/helper';
import { SYSTEM_CONTRACT_ADDRESS } from './utils/constants';
const { ethers } = require('hardhat');
const log = console.log;
let bscValidatorSet: BSCValidatorSet, operator: SignerWithAddress;

// should approve before swap
const enterMaintenance = async (signer: SignerWithAddress) => {
    await waitTx(bscValidatorSet.connect(signer).enterMaintenance());
    log('signer enterMaintenance SUCCESS !', signer.address);
};

const init = async () => {
    let signers = await ethers.getSigners();
    operator = signers[0];
    log('operator', operator.address, toHuman(await ethers.provider.getBalance(operator.address)));

    bscValidatorSet = (await ethers.getContractAt(
        'BSCValidatorSet',
        SYSTEM_CONTRACT_ADDRESS.ValidatorContract
    )) as BSCValidatorSet;


    const blockNumber = await ethers.provider.getBlockNumber()
    log('blockNumber:', blockNumber);

    const workingValidatorCount = await bscValidatorSet.getWorkingValidatorCount();
    log('workingValidatorCount:', workingValidatorCount);

    const index = await bscValidatorSet.getCurrentValidatorIndex('0xA2959D3F95eAe5dC7D70144Ce1b73b403b7EB6E0')
    const extra = await bscValidatorSet.validatorExtraSet(index)
    log('index:', index.toNumber());
    log('extra:', extra);
};

const main = async () => {
    await init();
    // await enterMaintenance(operator);
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
