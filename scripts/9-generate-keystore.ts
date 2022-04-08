const { ethers } = require('ethers');
const log = console.log.bind(console);
const fs = require('fs');
/*
*
* validators: [
  '0xFe377A5788c1eA81E92C98FDC406AaAAD0c09000',
  '0x287031df3e8d2cE4BaBcCE375244dd9600155b01',
  '0xC3B29737619A86c3C363BDF0B37ee5b8C9843216',
  '0xdC99E33F426354fb1025b680E0C50291863cc796',
  '0xf8CB6E47a96aCDAe9157276e906E28B5a20c8421',
  '0x7AcC84C55145A613e8a96C2277D28f1BD2F652Ba',
  '0x3f58fb8Ec2f78B65a9077cd3C33B90f3e2332d95',
  '0x78c818b60E9e57829EB8e5cb8f32c303258DBf8D',
  '0xF38f0dFF58a213f53d08E54c0fbF3e76b76213B1',
  '0x3361823a4294bE0ec6b01e7CC99dbBE3B26a3069'
]

*
* */


const main = async () => {
    const password = '12345678'
    let keyMap: any
    keyMap = {}

    let privateKeys = []
    //  encrypt(password: Bytes | string, options?: any, progressCallback?: ProgressCallback): Promise<string>;
    for (let i = 0; i < 10; i++) {
        const skBytes = ethers.utils.randomBytes(32);
        const sk = ethers.utils.hexlify(skBytes);
        privateKeys.push(sk);
        log(privateKeys[i])
        const wallet = new ethers.Wallet(skBytes);
        log(wallet.address);

        const keyObject = await wallet.encrypt(password)
        keyMap[i+1] = wallet.address
        fs.writeFileSync(__dirname +  `/bas-keys/${i}.json`, keyObject)
        fs.writeFileSync(__dirname +  `/bas-keys/addresses.json`, JSON.stringify(keyMap, null, 2))
        fs.writeFileSync(__dirname +  `/bas-keys/private_keys.json`, JSON.stringify(privateKeys, null, 2))
    }

};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
