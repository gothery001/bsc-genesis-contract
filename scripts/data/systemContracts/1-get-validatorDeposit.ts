import { ethers } from 'hardhat';
import { startStatistic } from '../../utils/statistic';
import { SYSTEM_CONTRACT_ADDRESS } from '../../utils/constants'
import { Log } from '@ethersproject/abstract-provider';
import {toHuman} from "../../utils/helper";
import {applyWorkaround} from "hardhat/internal/util/antlr-prototype-pollution-workaround";
import {BigNumber} from "ethers";
import {formatEther} from "ethers/lib/utils";


const addressToBytes32 = (address: string) => {
    return ethers.utils.hexZeroPad(address, 32);
};

// 0. config toAddress and event abi
const interval = process.env.INTERVAL ? parseInt(process.env.INTERVAL) : 5000;
// TODO
const name = `get-validatorDeposit-from-local-${interval}`;

// TODO
const ContractAddress = SYSTEM_CONTRACT_ADDRESS.ValidatorContract

// TODO
const abi = ['event validatorDeposit(address indexed validator, uint256 amount)'];
const iface = new ethers.utils.Interface(abi);

// TODO
const eventName = 'validatorDeposit(address,uint256)'
const eventSigHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(eventName)
);

// TODO
const startBlockNumber = 1;
const endBlockNumber = 2000;
const topics: (string | null)[] = [
    eventSigHash,
];


// TODO
const parseLog = async (result: any, eventlog: Log) => {
    try {
        // 1. parse
        const res = iface.parseLog(eventlog);

        // TODO
        // 2. get args from eventLog
        const validator = res.args.validator;
        const amount = res.args.amount as BigNumber;

        const block = await ethers.provider.getBlock(eventlog.blockNumber);
        const timeStr = new Date(block.timestamp * 1000).toLocaleTimeString();

        // 3. record to storage
        result = result ? result : [];

        // TODO
        result.push(
            {
                eventName,
                validator,
                amount: formatEther(amount),
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
        true,
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
