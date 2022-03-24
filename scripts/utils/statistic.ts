import { ethers } from 'hardhat';
import fs from 'fs';
import { Log } from '@ethersproject/abstract-provider';
import * as assert from "assert";
const log = console.log.bind(console);

export interface Statistic {
    name: string;
    fromBlock: number;
    endBlock: number;
    currentBlock: number;
    result: any;
}

export const startStatistic = async (
    name: string,
    parseLog: (results: any, log: Log) => any,
    fromBlock?: number,
    endBlock?: number,
    contractAddress?: string,
    topics?: (string | null)[],
    intervalBlocks = 200,
    isWatching = false,
) => {
    const dataDir = __dirname + '/../data/' + name;
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const file = dataDir + '/' + name + '.json';

    let data: Statistic;
    if (!fs.existsSync(file)) {
        asserts(fromBlock, 'fromBlock is required');
        asserts(endBlock, 'endBlock is required');
        data = {
            name: name,
            fromBlock,
            endBlock,
            currentBlock: fromBlock,
        } as Statistic;
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } else {
        data = require(file) as Statistic;
        endBlock = data.endBlock;
    }
    let { currentBlock } = data;

    log(`${name} getLogs start at currentBlock`, currentBlock);
    asserts(currentBlock, 'currentBlock is required');
    asserts(endBlock, 'endBlock is required');

    if (isWatching) {
        endBlock = await ethers.provider.getBlockNumber();
        data.endBlock = endBlock;
        log(`currentBlock ${currentBlock}, endBlock ${endBlock}`);
    }

    let logs: Log[];
    // for (let i = currentBlock; i <= endBlock; i += intervalBlocks) {
    let i = currentBlock;
    while (true) {
        if (i > endBlock) {
            if (isWatching) {
                i = endBlock;
                endBlock = await ethers.provider.getBlockNumber();
                data.endBlock = endBlock;
                log(`currentBlock ${currentBlock}, endBlock ${endBlock}`);
            } else {
                break;
            }
        }

        const fromBlock = i;
        const toBlock = Math.min(i + intervalBlocks - 1, endBlock);
        while (true) {
            try {
                // getLogs
                logs = await ethers.provider.getLogs({
                    fromBlock,
                    toBlock,
                    address: contractAddress,
                    topics,
                });

                // logs
                for (const eventLog of logs) {
                    const { result } = await parseLog(data.result, eventLog);
                    data.result = result;
                }

                // set current block
                data.currentBlock = toBlock + 1;

                // write to file
                log(
                    `${logs.length} logs from ${fromBlock} to ${toBlock}`,
                );

                if (logs.length > 0) {
                    fs.writeFileSync(file, JSON.stringify(data, null, 2));
                }
                break;
            } catch (e) {
                const seconds = 5;
                log(`error: ${e}, retry after ${seconds}s`);
                await sleep(seconds);
            }
        }

        i += intervalBlocks
    }
};

export function asserts(x: unknown, message = 'not valid'): asserts x {
    if (!x) throw new Error(message);
}

const sleep = async (seconds: number) => {
    // console.log(`waiting for block confirmations, about ${seconds}s`)
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};
