let multicallInstance;
const HecoMulticallAddress = '0x5F6C56Ae1546A7371d529D5620D5Ff6c07394AfE';
const BSCMulticallAddress = '0x1Ee38d535d541c55C9dae27B12edf090C608E6Fb';
const ETHMulticallAddress = '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696';

const multicallAbi = require('./abi/IMultiCall.json');
const { ethers } = require('hardhat');

/*
 * @param callObjVev
 * const callObjVec = [
 *   {
 *       target: '0x7565a0a69156549c8e1eb2c219458018c3aaf196',
 *       instance: await ethers.getContractAt('ERC20', '0xa71edc38d189767582c38a3145b5873052c3e47a'),
 *       functionName: 'balanceOf',
 *       params: ['0x0000000000000000000000000000000000000000']
 *   }
 * ]
 * */
const generateCalls = async (callObjVec) => {
    const calls = [];
    for (const { target, instance, functionName, params } of callObjVec) {
        const tx = await instance.populateTransaction[functionName](...params);
        calls.push({
            target,
            callData: tx.data,
        });
    }
    return calls;
};
/*
* @dev
* const tx = await poolInstance.populateTransaction.totalSupply();
* const calls = [
*   {
*       target: '0x7565a0a69156549c8e1eb2c219458018c3aaf196',  // contract address to call
        callData: tx.data
*   }
* ]
* */
const multiCall = async (calls, multicallAddress, isRequestBlockTime = true) => {
    if (!multicallInstance) {
        multicallInstance = await ethers.getContractAt(multicallAbi, multicallAddress);
    }

    if (isRequestBlockTime) {
        calls.push({
            target: multicallAddress,
            callData: (await multicallInstance.populateTransaction.getCurrentBlockTimestamp()).data,
        });
    }

    return await multicallInstance.callStatic.aggregate(calls);
};

const getBlockTimestamp = async () => {
    if (!multicallInstance) {
        multicallInstance = await ethers.getContractAt('Multicall', HecoMulticallAddress);
    }
    return await multicallInstance.callStatic.getCurrentBlockTimestamp();
};

module.exports = {
    HecoMulticallAddress,
    BSCMulticallAddress,
    ETHMulticallAddress,
    generateCalls,
    multiCall,
};
