const ethers = require('ethers');

const fixedLength = (str: string, targetLen = 8) => {
    const len = str.length;
    return '0'.repeat(targetLen - len) + str;
};

const fixedLengthLe = (str: string, targetLen = 8) => {
    const len = str.length;
    return str + '0'.repeat(targetLen - len);
};

const clear0x = (hexStr: string) => {
    return hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
};

const hexToBigNumber = (hexStr: string) => {
    if (hexStr === '0x' || !hexStr) {
        hexStr = '0x0';
    }
    return ethers.BigNumber.from(hexStr);
};

module.exports = {
    hexToBigNumber,
    fixedLength,
    fixedLengthLe,
    clear0x,
};
