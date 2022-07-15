const { createAndExport, utils: { setJSON, deployContract } } = require('@axelar-network/axelar-local-dev');
const { Wallet, utils: {keccak256, defaultAbiCoder} } = require('ethers');

async function createLocal (toFund = []) {
    async function callback(chain, info) {
        await chain.deployToken('Axelar Wrapped aUSDC', 'aUSDC', 6, BigInt(1e70));
        for(const address of toFund) {
            await chain.giveToken(address, 'aUSDC', BigInt(1e18));
        }
    }

    await createAndExport({
        chainOutputPath: "./info/local.json",
        accountsToFund: toFund,
        callback: callback,
    });
}

module.exports = {
    createLocal,
}

if (require.main === module) {    
    require('dotenv').config()
    const deployer_key = process.env.PRIVATE_KEY
    const deployer_address = new Wallet(deployer_key).address;
    console.log(`In scripts/createLocal. deployer_address: ${deployer_address}`);
    const toFund = [deployer_address]

    for(let j=2; j<process.argv.length; j++) {
        toFund.push(process.argv[j]);
    }
    createLocal(toFund);
}