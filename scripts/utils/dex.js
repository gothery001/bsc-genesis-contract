const { generateCalls, multiCall, BSCMulticallAddress } = require('./multicall');
const { ethers } = require('hardhat');
const { hexToBigNumber } = require('./string');
const ERC20ABI = require('./abi/IERC20.json');
const MulticallABI = require('./abi/IMultiCall.json');

const getTokenInstance = async (contractAddress) => {
    return await ethers.getContractAt('IERC20', contractAddress);
};

const fetchTokenInfo = async (tokenInfo) => {
    // 1. instance
    if (!tokenInfo.instance) {
        tokenInfo.instance = await getTokenInstance(tokenInfo.address);
    }

    // 2. decimals
    if (!tokenInfo.decimals) {
        tokenInfo.decimals = await tokenInfo.instance.callStatic.decimals();
    }

    // 3. symbol
    // if (!tokenInfo.symbol) {
    //     tokenInfo.symbol = await tokenInfo.instance.callStatic.symbol();
    // }

    // 4. totalSupply
    // if (!tokenInfo.totalSupply) {
    //     tokenInfo.totalSupply = await tokenInfo.instance.callStatic.totalSupply();
    // }

    return tokenInfo;
};

/*
    @param tokenInfo
    const usdTokenInfo = {
        address: '0xa71edc38d189767582c38a3145b5873052c3e47a',
        decimals: 18
    }
* */
const getTokenPrice = async (lpAddress, usdTokenInfo, tokenInfo) => {
    await fetchTokenInfo(usdTokenInfo);
    await fetchTokenInfo(tokenInfo);

    const balanceUsdToken = await usdTokenInfo.instance.callStatic.balanceOf(lpAddress);
    const balanceToken = await tokenInfo.instance.callStatic.balanceOf(lpAddress);

    // should consider decimals
    const price =
        balanceUsdToken / 10 ** usdTokenInfo.decimals / (balanceToken / 10 ** tokenInfo.decimals);

    return {
        price,
        balanceUsdToken,
        balanceToken,
        lpTotalValue: balanceUsdToken.mul(2),
    };
};

const getTokenValueFromLp = async (lpAddress, basicTokenInfo) => {
    await fetchTokenInfo(basicTokenInfo);
    const balance = await basicTokenInfo.instance.callStatic.balanceOf(lpAddress);
    return balance.mul(2);
};

const getTokenValueFromLpAmount = async (lpTokenInfo, basicTokenInfo, lpAmount) => {
    await fetchTokenInfo(basicTokenInfo);
    await fetchTokenInfo(lpTokenInfo);

    const balance = await basicTokenInfo.instance.callStatic.balanceOf(lpTokenInfo.address);
    const lpTotalValue = balance.mul(2);
    const lpTotalSupply = await lpTokenInfo.instance.totalSupply();

    return (lpAmount / lpTotalSupply) * lpTotalValue;
};

const getETHBalances = async (addresses) => {
    const callObjVec = [];
    const multiCallInstance = await ethers.getContractAt(MulticallABI, BSCMulticallAddress);
    for (let i = 0; i < addresses.length; i++) {
        callObjVec.push({
            target: BSCMulticallAddress,
            instance: multiCallInstance,
            functionName: 'getEthBalance',
            params: [addresses[i]],
        });
    }

    const { returnData } = await multiCall(
        await generateCalls(callObjVec),
        BSCMulticallAddress,
        true
    );
    const returnDataVec = [...returnData];

    const balancesETH = [];
    let sumETH;
    for (let i = 0; i < addresses.length; i++) {
        const balance = hexToBigNumber(returnDataVec.shift());
        balancesETH.push(balance);
        if (!sumETH) {
            sumETH = balance;
        } else {
            sumETH = sumETH.add(balance);
        }
    }

    return {
        balancesETH,
        sumETH,
    };
};

const getTokenBalances = async (token, addresses) => {
    if (!token) {
        return getETHBalances(addresses);
    }

    const callObjVec = [];
    const erc20Instance = await ethers.getContractAt(ERC20ABI, token);

    for (let i = 0; i < addresses.length; i++) {
        callObjVec.push({
            target: token,
            instance: erc20Instance,
            functionName: 'balanceOf',
            params: [addresses[i]],
        });
    }

    const { returnData } = await multiCall(
        await generateCalls(callObjVec),
        BSCMulticallAddress,
        true
    );
    const returnDataVec = [...returnData];

    const balances = [];
    let sum;
    for (let i = 0; i < addresses.length; i++) {
        const balance = hexToBigNumber(returnDataVec.shift());
        balances.push(balance);
        if (!sum) {
            sum = balance;
        } else {
            sum = sum.add(balance);
        }
    }

    return {
        sum,
        balances,
    };
};

module.exports = {
    getTokenInstance,
    fetchTokenInfo,
    getTokenPrice,
    getTokenValueFromLp,
    getTokenValueFromLpAmount,
    getETHBalances,
    getTokenBalances,
};
