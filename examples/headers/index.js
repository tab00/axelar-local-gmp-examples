'use strict';

const { getDefaultProvider, Contract, constants: { AddressZero }, utils: { RLP } } = require('ethers');
const { utils: { deployContract }} = require('@axelar-network/axelar-local-dev');

const Headers = require('../../build/Headers.json');
const Gateway = require('../../build/IAxelarGateway.json');
const IERC20 = require('../../build/IERC20.json');
const Storage = require('../../build/StorageLogger.json');
const ConstAddressDeployer = require('../../build/ConstAddressDeployer.json');

const { deployContractConstant, predictContractConstant } = require('../../scripts/utils.js');
const { keccak256, defaultAbiCoder } = require('ethers/lib/utils');
const testnet = require('../../info/testnet.json');

const time = new Date().getTime();

async function deploy(chain, wallet) {
    if(chain.name != 'Avalanche') return;

    /*console.log(`Deploying ConstAddressDeployer for ${chain.name}.`);
    const contract = await deployContract(wallet, ConstAddressDeployer);
    chain.constAddressDeployer = contract.address;
    console.log(`Deployed ConstAddressDeployer for ${chain.name} at ${chain.constAddressDeployer}.`);*/

    console.log(`Deploying StorageLogger for ${chain.name}.`);
    const headersAddress = await predictContractConstant(
        chain.constAddressDeployer, 
        wallet, 
        Headers, 
        'headers-'+time,
        [],
    )
    const storage = await deployContractConstant(
        chain.constAddressDeployer,
        wallet,
        Storage,
        'storage-'+time,
        [],
        [headersAddress, chain.name],
    )
    chain.storageLogger = storage.address;
    console.log(`Deployed StorageLogger for ${chain.name} at ${chain.storageLogger}.`);

    console.log(`Deploying Headers for ${chain.name}.`);
    const headers = await deployContractConstant(
        chain.constAddressDeployer, 
        wallet, 
        Headers, 
        'headers-'+time,
        [],
        [chain.gateway, storage.address],
    );
    chain.headers = headers.address;
    console.log(`Deployed Headers for ${chain.name} at ${chain.headers}.`);
}

async function test(chains, wallet, options) {
    const args = options.args || [];
    const getGasPrice = options.getGasPrice;
    const chain = chains.find(chain => chain.name == ('Avalanche'));
    //for(const chain of chains) {
    chain.provider = getDefaultProvider(chain.rpc);
    chain.wallet = wallet.connect(chain.provider);
    chain.headersContract = new Contract(chain.headers, Headers.abi, chain.wallet);
    chain.gatewayContract = new Contract(chain.gateway, Gateway.abi, chain.wallet);
    chain.storageContract = new Contract(chain.storageLogger, Storage.abi, chain.wallet);
    //}
    //console.log(chain);
    console.log(await chain.storageContract.headers(), chain.headersContract.address);
    console.log(await chain.headersContract.storageLogger(), chain.storageContract.address);
    
    function sleep(ms) {
        return new Promise((resolve)=> {
            setTimeout(() => {resolve()}, ms);
        })
    }
    const formatHexArray = (array) => {
        return array.map(value => formatHex(value) );
    }
    const formatHex = (value) => {
        if(value == '0x0') return ('0x');
        return value.length % 2 == 0 ? value : value.slice(0,2) + '0' + value.slice(2);
    }
    const rlpEncodedBlock = (block) => {
        const selectedBlockElements = [
            block.parentHash,
            block.sha3Uncles,
            block.miner,
            block.stateRoot,
            block.transactionsRoot,
            block.receiptsRoot,
            block.logsBloom,
            block.difficulty,
            block.number,
            block.gasLimit,
            block.gasUsed === "0x0" ? "0x": block.gasUsed,
            block.timestamp,
            block.extraData,
            block.mixHash,
            block.nonce,
            block.baseFeePerGas,
        ];
        return RLP.encode(formatHexArray(selectedBlockElements));
    };

    function getEncodedAddress(address) {
        return '0x20' + keccak256(address).slice(2);
    }

    const nonce = 11;//await chain.storageContract.nonce() - 1;
    console.log(nonce);

    //await (await chain.storageContract.send('Avalanche', wallet.address, '0x1234567890')).wait();

    
    const provider = getDefaultProvider('https://api.avax-test.network/ext/bc/C/rpc');
    //const provider = getDefaultProvider('https://ropsten.infura.io/v3/a4812158fbab4a2aaa849e6f4a6dc605');
    //const chain = testnet.find(chain=> chain.name == 'Ethereum');
    //console.log(chain.rpc);
    //const provider = getDefaultProvider(chain.rpc);
    //const N = 10006639;
    //const N = 12293733;
    const address = '0x353A74a7f6786952F8b598F265C83262C9e534f0';//chain.storageContract.address;
    const N = await provider.getBlockNumber();
    console.log(N);
    const block = await provider.perform("getBlock", { blockTag: '0x' + Number(N).toString(16) });
    const rlp = rlpEncodedBlock(block);
    //console.log(block);
    const pos = '0xdce76a9b6a83d9ab95de485fd7264c9bd43053f148a9f32bea7196988d5054de';//(await chain.storageContract.getOutogingPos('Avalanche', wallet.address, nonce))._hex;
    const proofTemp = await provider.send("eth_getProof", [address, [pos], '0x' + Number(N).toString(16)]);
    console.log(proofTemp.storageProof[0]);
    const proof = proofTemp.storageProof[0].proof;
    //console.log(proof);
    console.log(RLP.decode(proof[proof.length - 1]), keccak256(proofTemp.storageProof[0].key));
    console.log(RLP.decode(proofTemp.accountProof[proofTemp.accountProof.length - 1]), keccak256(address));
    const encodedAddress = getEncodedAddress(address);
    console.log(encodedAddress);
    /*const lastItem = getLastItem(proofTemp);
    console.log(RLP.decode(proofTemp.accountProof[proofTemp.accountProof.length-1]));
    proofTemp.accountProof.push(lastItem);*/
    
    
    /*await (await chain.headersContract.receiveHeader(
        keccak256('0x'),
        chain.name,
        keccak256(rlp),
        rlp,
        address,
        proofTemp.accountProof,
    )).wait();*/
    await (await chain.headersContract.temp(chain.name, proofTemp.storageHash));

    //console.log(await destination.contract.get(encodedAddress, proofTemp.accountProof, block.stateRoot));
    
    console.log(await chain.headersContract.stateRoots(chain.name));
    console.log(await chain.headersContract.blockNumbers(chain.name));
    console.log(await chain.headersContract.timestamps(chain.name));
    console.log(await chain.headersContract.storageRoots(chain.name));


    let path = '0x';
    const mapping = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
    let hash = keccak256(proof[0]);
    let items = RLP.decode(proof[0]);
    for(let i=1; i<proof.length; i++) {
        hash = keccak256(proof[i]);
        console.log(items, hash);
        const j = items.findIndex(val => val == hash);
        path += mapping[j];
        items = RLP.decode(proof[i]);
    }
    console.log(path);
    console.log(items);
    console.log(pos, keccak256(pos));
    const encodedPos = '0x20' + keccak256(pos).slice(2);
    console.log(keccak256(proof[0]));
    console.log(keccak256(pos));
    console.log(await chain.headersContract.getStorageAt(chain.name, pos, proof));
    console.log(keccak256('0x1234567890'));

    const tx = await (await chain.storageContract.receive(chain.name, nonce, '0x1234567890', proof)).wait();
    console.log(tx);
}


module.exports = {
    deploy,
    test,
}
