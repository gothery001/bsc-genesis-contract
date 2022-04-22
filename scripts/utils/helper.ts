import { BigNumber, ContractReceipt, ContractTransaction } from 'ethers';
import { formatEther } from 'ethers/lib/utils';

export const toHuman = (x: BigNumber, fractionDigits = 2) => {
    return formatEther(x);
};

export async function waitTx(txRequest: Promise<ContractTransaction>): Promise<ContractReceipt> {
    const txResponse = await txRequest;
    console.log(`Waiting for tx ${txResponse.hash} to be mined...`);
    return await txResponse.wait(1);
}

export function getDeadline(durationSeconds?: number): number {
    if (!durationSeconds) {
        durationSeconds = 30 * 60; // 30 minutes
    }
    return Math.floor(new Date().getTime() / 1000) + durationSeconds;
}
