import {BSCValidatorSet, SlashIndicator} from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { waitTx } from './utils/helper';
import { SYSTEM_CONTRACT_ADDRESS } from './utils/constants';
import {BigNumber} from "ethers";
const { ethers } = require('hardhat');
const log = console.log;
let bscValidatorSet: BSCValidatorSet, operator: SignerWithAddress;

let slashIndicator: SlashIndicator

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

    slashIndicator = (await ethers.getContractAt(
        'SlashIndicator',
        SYSTEM_CONTRACT_ADDRESS.SlashContract
    )) as SlashIndicator;

    const validators = await bscValidatorSet.getValidators();
    log('validators:', validators);
    log('chainId:', await bscValidatorSet.bscChainID());

    const blockNumber = 241209

    let index = await bscValidatorSet.getCurrentValidatorIndex('0x47E61bb6DcDA273271285Ab4794eA308b7e2D7C3', { blockTag: blockNumber })
    let info = await bscValidatorSet.currentValidatorSet(index, { blockTag: blockNumber })
    let extraInfo = await bscValidatorSet.validatorExtraSet(index, { blockTag: blockNumber })
    let isWorking = await bscValidatorSet.isWorkingValidator(index, { blockTag: blockNumber })

    log(blockNumber, index.toNumber(), 'extraInfo 0x47E61bb6DcDA273271285Ab4794eA308b7e2D7C3:', extraInfo, 'info:', info, isWorking)
    let workingValidators211 = await bscValidatorSet.getValidators({ blockTag: blockNumber + 1})
    log(workingValidators211)

    let numOfMaintaining209 = await bscValidatorSet.numOfMaintaining({ blockTag: blockNumber})
    log('numOfMaintaining209', numOfMaintaining209)

    let slashCountScale = await bscValidatorSet.maintainSlashScale({ blockTag: blockNumber + 1})
    log(slashCountScale)


    let extraInfo211 = await bscValidatorSet.validatorExtraSet(index, { blockTag: blockNumber + 1 })
    log('extraInfo211', extraInfo211)



    let [misdemeanorThreshold, felonyThreshold] = await slashIndicator.getSlashThresholds({ blockTag: blockNumber})
    log('misdemeanorThreshold', misdemeanorThreshold, 'felonyThreshold', felonyThreshold)

    let [misdemeanorThreshold2, felonyThreshold2] = await slashIndicator.getSlashThresholds({ blockTag: blockNumber + 1})
    log('misdemeanorThreshold', misdemeanorThreshold2, 'felonyThreshold', felonyThreshold2)







    for (let number = 241209; number <= 241211; number++ ) {
        log('blockNumber', number)
        let extraInfo209 = await bscValidatorSet.validatorExtraSet(index, { blockTag: number })
        log('extraInfo.enterMaintenanceHeight', extraInfo209.enterMaintenanceHeight.toNumber())
        let workingValidators209 = (await bscValidatorSet.getValidators({ blockTag: number })).length
        log('workingValidators', workingValidators209)

        let INIT_NUM_OF_CABINETS = await bscValidatorSet.INIT_NUM_OF_CABINETS({ blockTag: number })
        log('INIT_NUM_OF_CABINETS', INIT_NUM_OF_CABINETS.toNumber())

        let numOfCabinets = await bscValidatorSet.numOfCabinets({ blockTag: number })
        log('numOfCabinets', numOfCabinets.toNumber())

        let slashCountScale209 = (await bscValidatorSet.maintainSlashScale({ blockTag: number }))
        log('slashCountScale', slashCountScale209.toNumber())

        let [misdemeanorThreshold, felonyThreshold] = await slashIndicator.getSlashThresholds({ blockTag: blockNumber})

        log('slashCount', (BigNumber.from(number).sub(extraInfo209.enterMaintenanceHeight.toNumber()).div(BigNumber.from(workingValidators209)).div(slashCountScale209)).toNumber())
        log('felonyThreshold', felonyThreshold.toNumber())
        log('----------------------')
        log('----------------------')
        log('----------------------')
    }


    for (let i = 0; i < 8; i++) {
        const validatorInfo = await bscValidatorSet.currentValidatorSet(i, { blockTag: blockNumber })
        log(`${i} of currentValidatorSet`, validatorInfo.consensusAddress)

        const extraInfo = await bscValidatorSet.validatorExtraSet(i, { blockTag: blockNumber })
        log(`${i} of validatorExtraSet`, extraInfo)
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
