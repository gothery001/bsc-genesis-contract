import { ethers } from 'hardhat';
import { startStatistic } from '../../utils/statistic';
import { SYSTEM_CONTRACT_ADDRESS } from '../../utils/constants'
import { Log } from '@ethersproject/abstract-provider';
import {toHuman} from "../../utils/helper";
import {applyWorkaround} from "hardhat/internal/util/antlr-prototype-pollution-workaround";


const addressToBytes32 = (address: string) => {
    return ethers.utils.hexZeroPad(address, 32);
};

// 0. config toAddress and event abi
const interval = process.env.INTERVAL ? parseInt(process.env.INTERVAL) : 5000;
const name = `get-maintaining-from-bsc-${interval}`;

const ContractAddress = SYSTEM_CONTRACT_ADDRESS.ValidatorContract
const abi = ['event validatorEnterMaintenance(address indexed validator)'];
const iface = new ethers.utils.Interface(abi);

const eventName = 'validatorEnterMaintenance(address)'
const eventSigHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(eventName)
);

console.log('event sig hash: ', eventSigHash)

const startBlockNumber = 18907621;
const endBlockNumber = 20458215;
const isWatching = false
const topics: (string | null)[] = [
    eventSigHash,
];

const parseLog = async (result: any, eventlog: Log) => {
    try {
        // 1. parse
        const res = iface.parseLog(eventlog);

        // 2. get args from eventLog
        const slashedValidator = res.args.validator;

        const block = await ethers.provider.getBlock(eventlog.blockNumber);
        const timeStr = new Date(block.timestamp * 1000).toLocaleTimeString();

        // 3. record to storage
        result = result ? result : [];

        result.push(
            {
                eventName,
                validator: slashedValidator,
                time: timeStr,
                res,
                eventlog,
            }
        )

        return {
            result,
        };
    } catch (e) {
        throw new Error(`Failed to parse log: ${e}`);
    }
};

const main = async () => {
    console.log(`interval: ${interval}`);
    // 4. config getLogs params
    await startStatistic(
        name,
        parseLog,
        startBlockNumber,
        endBlockNumber,
        ContractAddress,
        // mint nft Transfer log: ZERO_ADDRESS => minter tokenId
        topics,
        interval,
        isWatching,
    );
};

const bytes32ToAddress = (bytes32Str: string) => {
    return bytes32Str.replace('0x000000000000000000000000', '0x');
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });