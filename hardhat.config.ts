import '@typechain/hardhat';
import 'hardhat-watcher'
import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@tenderly/hardhat-tenderly';
import {existsSync} from "fs";
import 'dotenv/config';

const getQaValidatorsPrivateKeys = () => {
    if (existsSync('./private-keys-qa.json')) {
        const keyObj: any = require('./private-keys-qa.json');
        const keyArray: string[] = []
        Object.keys(keyObj).map((key: string) => {
            keyArray.push(keyObj[key])
        })
        return keyArray
    }
    return [];
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
    solidity: {
        compilers: [
            {
                version: "0.6.4",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            },
        ]
    },
    networks: {
        hardhat: {
            accounts: {
                mnemonic: "clock radar mass judge dismiss just intact mind resemble fringe diary casino",
                count: 100
            },
            allowUnlimitedContractSize: true,
        },
        development: {
            url: "http://127.0.0.1:8545",     // Localhost (default: none)
            accounts: {
                mnemonic: "clock radar mass judge dismiss just intact mind resemble fringe diary casino",
                count: 100
            }
        },
        'bsc': {
            // url: "https://bsc-dataseed1.ninicoin.io",
            url: process.env.AP,
            accounts: {
                mnemonic: "clock radar mass judge dismiss just intact mind resemble fringe diary casino",
            }
        },
        'qa-197': {
            url: "http://172.22.41.197:8545",
            accounts: getQaValidatorsPrivateKeys()
        },
        'qa-144': {
            url: "http://172.22.41.144:8545",
            accounts: getQaValidatorsPrivateKeys()
        },
        'testnet': {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
            // url: "https://data-seed-prebsc-2-s1.binance.org:8545/",
            // url: "https://data-seed-prebsc-1-s2.binance.org:8545/",
            // url: "https://data-seed-prebsc-2-s2.binance.org:8545/",
            accounts: [
                process.env.BSC_TESTNET_SK
            ]
        }
    },
    watcher: {
        compilation: {
            tasks: ["compile"],
            files: ["./contracts"],
            verbose: true,
        }
    },
    mocha: {
        timeout: 2000000
    },
    paths: {
        sources: "./contracts",
        tests: "./test/test-maintenance",
        cache: "./cache",
        artifacts: "./artifacts"
    },
    gasReporter: {
        enabled: (process.env.REPORT_GAS) ? true : false
    }
};

