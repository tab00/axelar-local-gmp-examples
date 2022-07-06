'use strict';

const {
    getDefaultProvider,
    Contract,
    constants: { AddressZero },
    utils: { formatBytes32String, arrayify, defaultAbiCoder },
} = require('ethers');
const {
    utils: { deployContract },
} = require('@axelar-network/axelar-local-dev');

const DepositService = require('../../artifacts/@axelar-network/axelar-cgp-solidity/contracts/deposit-service/AxelarDepositService.sol/AxelarDepositService.json');
const DepositServiceProxy = require('../../artifacts/@axelar-network/axelar-cgp-solidity/contracts/deposit-service/AxelarDepositServiceProxy.sol/AxelarDepositServiceProxy.json');
const Gateway = require('../../artifacts/@axelar-network/axelar-cgp-solidity/contracts/interfaces/IAxelarGateway.sol/IAxelarGateway.json');
const IERC20 = require('../../artifacts/@axelar-network/axelar-cgp-solidity/contracts/interfaces/IERC20.sol/IERC20.json');

async function deploy(chain, wallet) {
    console.log(`Deploying DepositService for ${chain.name}.`);
    const depositImplementation = await deployContract(wallet, DepositService);
    chain.depositService = depositImplementation.address;
    const depositProxy = await deployContract(wallet, DepositServiceProxy, [
        depositImplementation.address,
        arrayify(defaultAbiCoder.encode(['address', 'string'], [chain.gateway, 'aUSDC'])),
    ]);
    chain.depositProxy = depositProxy.address;
    console.log(`Deployed DepositService for ${chain.name} at ${chain.depositService}.`);
}

async function test(chains, wallet, options) {
    const args = options.args || [];
    const getGasPrice = options.getGasPrice;
    const symbol = 'aUSDC';
    const destinationAddress = '0xA57ADCE1d2fE72949E4308867D894CD7E7DE0ef2';
    const amount = 5000000;

    for (const chain of chains) {
        const provider = getDefaultProvider(chain.rpc);
        chain.wallet = wallet.connect(provider);
        chain.gatewayContract = new Contract(chain.gateway, Gateway.abi, chain.wallet);
        chain.depositServiceContract = new Contract(chain.depositProxy, DepositService.abi, chain.wallet);
        const tokenAddress = await chain.gatewayContract.tokenAddresses(symbol);
        chain.token = new Contract(tokenAddress, IERC20.abi, chain.wallet);
    }
    const source = chains.find((chain) => chain.name == (args[0] || 'Avalanche'));
    const destination = chains.find((chain) => chain.name == (args[1] || 'Fantom'));

    async function print() {
        console.log(`Balance of ${wallet.address} at ${source.name} is ${await source.token.balanceOf(wallet.address)}`);
        console.log(`Balance of ${destinationAddress} at ${destination.name} is ${await destination.token.balanceOf(destinationAddress)}`);
    }
    function sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    }

    console.log('--- Initially ---');
    await print();

    const salt = formatBytes32String('Hello');
    const depositAddress = await source.depositServiceContract.depositAddressForSendToken(salt, 'Moonbeam', destinationAddress, 'aUSDC');

    console.log('deposit Address', depositAddress);

    const balance = await destination.token.balanceOf(destinationAddress);
    console.log('--- Initially ---');
    await print();

    // console.log("deposit proxy source",source.depositProxy)

    await (await source.token.approve(source.depositProxy, amount)).wait();
    await (await source.token.approve(source.gateway, amount)).wait();
    // return;
    console.log('deposit service contract', source.depositServiceContract);

    await (await source.depositServiceContract.sendToken(salt, 'Moonbeam', destinationAddress, 'aUSDC')).wait();
    while (true) {
        const newBalance = await destination.token.balanceOf(destinationAddress);
        if (BigInt(balance) != BigInt(newBalance)) break;
        await sleep(2000);
    }

    console.log('--- After ---');
    await print();
}

module.exports = {
    deploy,
    test,
};
