const { ethers } = require('hardhat');
const log = console.log.bind(console);

const unit = ethers.constants.WeiPerEther;

const main = async () => {
  const signers = await ethers.getSigners();
  // const receiver = signers[0].address;
  const receiver = '0x14d7a74F6834c5E7c94BE537669b0048fA528d4C';
  const signer = signers[0];

  log('operator:', signer.address);
  log('balance:', (await ethers.provider.getBalance(signer.address)) / 1e18);

  // for (let i = 0; i < signers.length; i++) {
  for (let i = 0; i < 100000; i++) {
    const promises = [];
    const amount = unit.mul(1).div(100);
    const promise = signer.sendTransaction({
      from: signer.address,
      to: receiver,
      value: amount,
      gasPrice: 6 * 1e9,
      gasLimit: 250000,
    });

    promises.push(promise);
    log(`${i} ${signer.address} transferred ${(amount / 1e18).toString()}`);
    await Promise.all(promises);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
