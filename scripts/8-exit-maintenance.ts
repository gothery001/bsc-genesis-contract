import { BSCValidatorSet } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { waitTx } from './utils/helper';
import { SYSTEM_CONTRACT_ADDRESS } from './utils/constants';
const { sleep } = require('./utils/util');
const { ethers } = require('hardhat');
const log = console.log;
let bscValidatorSet: BSCValidatorSet, operator: SignerWithAddress;

// // should approve before swap
// const enterMaintenance = async (signer: SignerWithAddress) => {
//     await waitTx(bscValidatorSet.connect(signer).enterMaintenance());
//     log('signer enterMaintenance SUCCESS !', signer.address);
// };

const init = async () => {
    let signers = await ethers.getSigners();

    bscValidatorSet = (await ethers.getContractAt(
        'BSCValidatorSet',
        SYSTEM_CONTRACT_ADDRESS.ValidatorContract
    )) as BSCValidatorSet;
    const validators = await bscValidatorSet.getValidators();
    log('validators:', validators);


    const i = 0;

    const validator = signers[i].address;
    log('before-------------', validator)

    let index = await bscValidatorSet.getCurrentValidatorIndex(validator)
    // let info = await bscValidatorSet.currentValidatorSet(index)
    let extraInfo = await bscValidatorSet.validatorExtraSet(index)
    let isWorking = await bscValidatorSet.isWorkingValidator(index)
    log(index.toNumber(), `extraInfo ${validator}:`, extraInfo, isWorking)
    const blockNumber =  await ethers.provider.getBlockNumber()
    log('blockNumber', blockNumber)

    let workingValidatorCount = await bscValidatorSet.getWorkingValidatorCount()
    log('workingValidatorCount', workingValidatorCount)
    await waitTx(bscValidatorSet.connect(signers[i]).exitMaintenance({
        // nonce: 670
    }));

    workingValidatorCount = await bscValidatorSet.getWorkingValidatorCount()
    log('workingValidatorCount', workingValidatorCount)

    while (true) {
        const blockNumber =  await ethers.provider.getBlockNumber()
        log('check validator', validator, 'blockNumber', blockNumber)
        index = await bscValidatorSet.getCurrentValidatorIndex(validator)
        extraInfo = await bscValidatorSet.validatorExtraSet(index)
        log(
            index.toNumber(),
            `${validator} extraInfo.isMaintaining:`, extraInfo.isMaintaining,
            `extraInfo.enterMaintenanceHeight:`, extraInfo.enterMaintenanceHeight
        )
        log('----------------------------------------------------------------------------------------------------------')
        await sleep(1)
    }

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
