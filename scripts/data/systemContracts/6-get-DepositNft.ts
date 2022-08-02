// @ts-ignore
import { ethers } from 'hardhat';
import { startStatistic } from '../../utils/statistic';
import { SYSTEM_CONTRACT_ADDRESS } from '../../utils/constants'
import { Log } from '@ethersproject/abstract-provider';
import {toHuman} from "../../utils/helper";
import {applyWorkaround} from "hardhat/internal/util/antlr-prototype-pollution-workaround";


const addressToBytes32 = (address: string) => {
    return ethers.utils.hexZeroPad(address, 32);
};


//  DepositNft(accountNameHash, nftContentHash, _nftL1Address, _nftL1TokenId, collectionId);
// 0. config toAddress and event abi

const isWatchLatestBlock = false
const interval = process.env.INTERVAL ? parseInt(process.env.INTERVAL) : 5000;
const name = `get-DepositNft-from-preview-${interval}`;

const ContractAddress = '0x554F05f3c7A17F61Ab218aA32c3e2b78D315a5fA'
const abi = ['event DepositNft(bytes32 accountNameHash, bytes32 nftContentHash, address tokenAddress,uint256 nftTokenId, uint16 creatorTreasuryRate)'];
const iface = new ethers.utils.Interface(abi);

const eventName = 'DepositNft(bytes32,bytes32,address,uint256,uint16)'
const eventSigHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(eventName)
);

const startBlockNumber = 20909229;
const endBlockNumber = 	21070829;
const topics: (string | null)[] = [
    eventSigHash,
];

const parseLog = async (result: any, eventlog: Log) => {
    try {
        // 1. parse
        const res = iface.parseLog(eventlog);

        // 2. get args from eventLog
        const accountNameHash = res.args.accountNameHash;
        const nftContentHash = res.args.nftContentHash;
        const tokenAddress = res.args.tokenAddress;
        const nftTokenId = res.args.nftTokenId;
        const creatorTreasuryRate = res.args.creatorTreasuryRate;

        const block = await ethers.provider.getBlock(eventlog.blockNumber);
        const timeStr = new Date(block.timestamp * 1000).toLocaleTimeString();

        // 3. record to storage
        result = result ? result : [];

        result.push(
            {
                eventName,
                accountNameHash,
                nftContentHash,
                tokenAddress,
                nftTokenId,
                creatorTreasuryRate,
                time: timeStr,
                res,
                eventlog,
            }
        )

      console.log(result.length)
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
        isWatchLatestBlock,
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
