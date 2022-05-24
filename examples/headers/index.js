'use strict';

const { getDefaultProvider, Contract, constants: { AddressZero }, utils: { RLP } } = require('ethers');
const { utils: { deployContract }} = require('@axelar-network/axelar-local-dev');

const Headers = require('../../build/Headers.json');
const Gateway = require('../../build/IAxelarGateway.json');
const IERC20 = require('../../build/IERC20.json');
const { deployContractConstant, predictContractConstant } = require('../../scripts/utils.js');
const { keccak256, defaultAbiCoder } = require('ethers/lib/utils');
const testnet = require('../../info/testnet.json');

const time = new Date().getTime();

async function deploy(chain, wallet) {
    console.log(`Deploying Headers for ${chain.name}.`);
    const contract = await deployContractConstant(
        chain.constAddressDeployer, 
        wallet, 
        Headers, 
        'headers-'+time,
        [],
        [chain.gateway],
    );
    chain.headers = contract.address;
    console.log(`Deployed Headers for ${chain.name} at ${chain.headers}.`);
}

async function test(chains, wallet, options) {
    const args = options.args || [];
    const getGasPrice = options.getGasPrice;
    for(const chain of chains) {
        chain.provider = getDefaultProvider(chain.rpc);
        chain.wallet = wallet.connect(chain.provider);
        chain.contract = new Contract(chain.headers, Headers.abi, chain.wallet);
        chain.gatewayContract = new Contract(chain.gateway, Gateway.abi, chain.wallet);
    }
    const source = chains.find(chain => chain.name == (args[0] || 'Avalanche'));
    const destination = chains.find(chain =>chain.name == (args[1] || 'Fantom'));
    
    
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

    function getLastItem(proof) {
        const val = RLP.encode(formatHexArray([
            proofTemp.nonce,
            proofTemp.balance,
            proofTemp.storageHash,
            proofTemp.codeHash,
            '0x',
        ]));
        console.log('val', val);
        const encodedAddress = getEncodedAddress(proof.address);
        let l = 4;
        for(let i=0; i<proof.accountProof.length; i++) {
            const item = RLP.decode(proof.accountProof[i]);
            if(item.length == 17) {
                l++;
            } else {
                const nibbles = item[0];
                if(item[2] == '1' || item[2] == '3') {
                    l += nibbles.length - 3;
                } else {
                    l += nibbles.length - 4
                }
            }
        }console.log(l);
        const remaining = (l%2==0 ? '0x20' : '0x3') + encodedAddress.slice(l);
        console.log('remaining',remaining);
        const val2 = RLP.encode(formatHexArray([
            remaining,
            val
        ]));
        console.log('val2',val2);
        console.log(keccak256(val2));
        return val2;
    }

    
    //const provider = getDefaultProvider('https://api.avax-test.network/ext/bc/C/rpc');
    //const provider = getDefaultProvider('https://ropsten.infura.io/v3/a4812158fbab4a2aaa849e6f4a6dc605');
    const chain = testnet.find(chain=> chain.name == 'Ethereum');
    console.log(chain.rpc);
    const provider = getDefaultProvider(chain.rpc);
    //const N = 10006639;
    //const N = 12293733;
    const address = chain.gateway;
    const N = await provider.getBlockNumber();
    console.log(N);
    const block = await provider.perform("getBlock", { blockTag: '0x' + Number(N).toString(16) });
    const rlp = rlpEncodedBlock(block);
    //console.log(block);
    console.log(keccak256(rlp), block.hash);
    const key = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    const pos = keccak256(defaultAbiCoder.encode(['bytes32', 'uint256'], [key, 2]));
    const proofTemp = await provider.send("eth_getProof", [address, [pos], '0x' + Number(N).toString(16)]);
    console.log(proofTemp.storageProof[0]);
    const proof = proofTemp.storageProof[0].proof;
    //console.log(proof);
    console.log(RLP.decode(proof[proof.length - 1]));
    const encodedAddress = getEncodedAddress(address);
    console.log(encodedAddress);
    console.log(keccak256(rlp), block.hash);

    /*const lastItem = getLastItem(proofTemp);
    console.log(RLP.decode(proofTemp.accountProof[proofTemp.accountProof.length-1]));
    proofTemp.accountProof.push(lastItem);*/
    
    
    await (await destination.contract.receiveHeader(
        keccak256('0x'),
        chain.name,
        keccak256(rlp),
        rlp,
        encodedAddress,
        proofTemp.accountProof,
    )).wait();

    //console.log(await destination.contract.get(encodedAddress, proofTemp.accountProof, block.stateRoot));
    
    console.log(await destination.contract.stateRoots(chain.name));
    console.log(await destination.contract.blockNumbers(chain.name));
    console.log(await destination.contract.timestamps(chain.name));
    console.log(await destination.contract.storageRoots(chain.name));


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
    console.log(await destination.contract.getStorageAt(chain.name, pos, proof));
    return;
}


module.exports = {
    deploy,
    test,
}
