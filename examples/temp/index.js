'use strict';

const { getDefaultProvider, Contract, constants: { AddressZero }, utils: { RLP }, Wallet } = require('ethers');
const { utils: { deployContract }} = require('@axelar-network/axelar-local-dev');

const ConstAddressDeployer = require('../../build/ConstAddressDeployer.json');
const { keccak256, defaultAbiCoder } = require('ethers/lib/utils');

const time = new Date().getTime();

const private_key = keccak256(defaultAbiCoder.encode(['string'], ['const']));

async function deploy(chain, wallet) {
    console.log(`Deploying ConstAddressDeployer for ${chain.name}.`);
    const deployerWallet = new Wallet(private_key, wallet.provider);

    
    const contract = await deployContract(deployerWallet, ConstAddressDeployer);
    chain.constAddressDeployer = contract.address;
    console.log(`Deployed ConstAddressDeployer for ${chain.name} at ${chain.constAddressDeployer}.`);
}


module.exports = {
    deploy,
}
