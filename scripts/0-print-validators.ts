const { ethers } = require('hardhat');
const log = console.log.bind(console);

const main = async () => {
    const signers = await ethers.getSigners();
    for (let i = 0; i < signers.length; i++) {
        const signer = signers[i];
        log(`validator-${i}: ${signer.address}`);
    }
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
