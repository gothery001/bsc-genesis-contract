import { BSCValidatorSet } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { waitTx } from './utils/helper';
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

    bscValidatorSet = (await ethers.getContractAt(
        'BSCValidatorSet',
        SYSTEM_CONTRACT_ADDRESS.ValidatorContract
    )) as BSCValidatorSet;
    const validators = await bscValidatorSet.getValidators();
    log('validators:', validators);
    log('chainId:', await bscValidatorSet.bscChainID());



    let index = await bscValidatorSet.getCurrentValidatorIndex('0x3f58fb8ec2f78b65a9077cd3c33b90f3e2332d95')
    let info = await bscValidatorSet.currentValidatorSet(index)
    let extraInfo = await bscValidatorSet.validatorExtraSet(index)
    let isWorking = await bscValidatorSet.isWorkingValidator(index)
    log(index.toNumber(), 'extraInfo 0x3f58fb8ec2f78b65a9077cd3c33b90f3e2332d95:', extraInfo, 'info:', info, isWorking)


/*    index = await bscValidatorSet.getCurrentValidatorIndex('0xf8CB6E47a96aCDAe9157276e906E28B5a20c8421')
    info = await bscValidatorSet.currentValidatorSet(index)
    extraInfo = await bscValidatorSet.validatorExtraSet(index)
    isWorking = await bscValidatorSet.isWorkingValidator(index)
    log(index.toNumber(), 'extraInfo 0xf8CB6E47a96aCDAe9157276e906E28B5a20c8421:', extraInfo, 'info:', info, isWorking)*/
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
