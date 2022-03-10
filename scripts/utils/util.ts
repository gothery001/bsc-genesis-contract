import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { formatEther } from 'ethers/lib/utils';
import { expect } from 'chai';
const { ecsign, toRpcSig } = require('ethereumjs-util');
const { ethers } = require('hardhat');
const fs = require('fs');

const getAddressFromBytes32 = (bytes32Str: string) => {
    return bytes32Str.replace('0x000000000000000000000000', '0x');
};

const sleep = async (seconds: number) => {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

const deployContract = async (factoryPath: string, ...args: any[]) => {
    const factory = await ethers.getContractFactory(factoryPath);
    const contract = await factory.deploy(...args);
    await contract.deployTransaction.wait(1);
    return contract;
};

const deployContractBySigner = async (
    wallet: SignerWithAddress,
    factoryPath: string,
    ...args: any[]
) => {
    const factory = await ethers.getContractFactory(factoryPath, wallet);
    const contract = await factory.deploy(...args);
    await contract.deployTransaction.wait(1);
    return contract;
};

const deployAll = async (contractPaths: string[]) => {
    const contracts = [];
    const promises = [];
    for (const path of contractPaths) {
        const factory = await ethers.getContractFactory(path);
        const contract = await factory.deploy();
        contracts.push(contract);
        promises.push(contract.deployTransaction.wait(1));
        // because nonce should increase in sequence
        await sleep(1);
    }

    await Promise.all(promises);
    return contracts;
};

const generateWallets = (size: number) => {
    const wallets = [];
    for (let i = 0; i < size; i++) {
        const wallet = ethers.Wallet.createRandom();
        wallets.push(wallet);
    }
    return wallets;
};

const generateSignatures = (msgHash: string, wallets: any[]) => {
    let signatures = '0x';
    for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        const { v, r, s } = ecsign(
            Buffer.from(msgHash.slice(2), 'hex'),
            Buffer.from(wallet.privateKey.slice(2), 'hex')
        );
        const sigHex = toRpcSig(v, r, s);
        signatures += sigHex.slice(2);
    }
    return signatures;
};

const runErrorCase = async (txPromise: any, expectErrorMsg: string) => {
    try {
        await txPromise;
    } catch (e: any) {
        const error = e.error ? e.error.toString() : e.toString();
        //expect(error.indexOf(expectErrorMsg) > -1).to.eq(true);
        expect(error).to.have.string(expectErrorMsg);
    }
};

const retryPromise = async (txPromise: any, times: number) => {
    let res = null;
    for (let i = 0; i < times; i++) {
        try {
            res = await txPromise;
            return res;
        } catch (e) {
            log(`send tx failed, retry ${i}`, e);
            await sleep(2);
        }
    }
    return res;
};

/*
 * @param
 * dateFormat("YYYY-mm-dd HH:MM:SS", date)
 * */
function dateFormat(fmt: string, date: Date) {
    let ret;
    const opt: any = {
        'Y+': date.getFullYear().toString(), // year
        'm+': (date.getMonth() + 1).toString(), // month
        'd+': date.getDate().toString(), // day
        'H+': date.getHours().toString(), // hour
        'M+': date.getMinutes().toString(), // minute
        'S+': date.getSeconds().toString(), // second
    };
    for (let k in opt) {
        ret = new RegExp('(' + k + ')').exec(fmt);
        if (ret) {
            fmt = fmt.replace(
                ret[1],
                ret[1].length == 1 ? opt[k] : opt[k].padStart(ret[1].length, '0')
            );
        }
    }
    return fmt;
}

const getRandomInt = (max: number) => {
    return Math.floor(Math.random() * max);
};

const getDeadline = () => {
    return Math.floor(new Date().getTime() / 1000) + 1800;
};

const { log } = console;

const addOperations = (deployments: any, operation: string, ...args: any[]) => {
    let timeStr = new Date().toLocaleString();

    if (!deployments.operations) {
        deployments.operations = [];
    }
    deployments.operations.push({
        time: timeStr,
        operation: operation,
        args: [...args],
    });

    return deployments;
};

const recordOperation = async (
    deployments: any,
    contractName: string,
    operation: string,
    rootPath: string
) => {
    const { chainId } = await ethers.provider.getNetwork();
    const timeStrFmt = dateFormat('mm-dd_HH-MM-SS', new Date());

    const backupDir = rootPath + '/backup';
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const recordFileName = `bsc-${chainId}-${timeStrFmt}-${operation}-${contractName}.json`;

    fs.writeFileSync(backupDir + `/` + recordFileName, JSON.stringify(deployments, null, 2));

    const mainnetDir = rootPath + '/mainnet';
    if (!fs.existsSync(mainnetDir)) {
        fs.mkdirSync(mainnetDir, { recursive: true });
    }

    fs.writeFileSync(mainnetDir + `/` + recordFileName, JSON.stringify(deployments, null, 2));
};

const waitTx = async (txRequest: any) => {
    const txResponse = await txRequest;
    return await txResponse.wait(1);
};

module.exports = {
    dateFormat,
    sleep,
    log,
    deployContract,
    deployAll,
    deployContractByWallet: deployContractBySigner,
    generateWallets,
    generateSignatures,
    runErrorCase,
    retryPromise,
    getRandomInt,
    getAddressFromBytes32,
    getDeadline,
    addOperations,
    recordOperation,
    waitTx,
};
