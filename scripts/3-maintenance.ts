import { BSCValidatorSet } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { waitTx } from './utils/helper';
import { log } from './utils/util';
import { SYSTEM_CONTRACT_ADDRESS } from './utils/constants';
import { BigNumber, ContractReceipt, ContractTransaction } from 'ethers';
const { ethers } = require('hardhat');

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
    const validators = await bscValidatorSet.getMiningValidators();
    log('validators:', validators);

    return;
};

const main = async () => {
    await init();
    await enterMaintenance(operator);
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
