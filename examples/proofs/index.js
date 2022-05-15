
const EventProofDefinition = require("../../build/EventProof.json");
const { ethers, utils: { BigNumber, RLP }, Contract, getDefaultProvider, providers: {Web3Provider} } = require("ethers");
const { GetProof, GetAndVerify } = require("eth-proof");
const { utils: { deployContract, setJSON }, mainnetInfo, testnetInfo } = require('@axelar-network/axelar-local-dev');

const Tree = require('merkle-patricia-tree');
const { keccak256 } = require("ethers/lib/utils");


const blockN = 11560000;


async function deploy(chain, wallet) {
    console.log(`Deploying EventProof for ${chain.name}.`);
    const contract = await deployContract(wallet, EventProofDefinition);
    chain.proof = contract.address;
    console.log(`Deployed EventProof for ${chain.name} at ${chain.proof}.`);
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
const encode = input => {
    return Buffer.from(
        input.slice(2),
        'hex',
    );
}


const getTxTree = async (block) => {
    const tree = new Tree();
    for(const tx of block.transactions) { 
        let siblingPath = encode(formatHex(tx.transactionIndex));
        const selectedTxElements = [
            tx.nonce,
            tx.gasPrice,
            tx.gas || tx.gasLimit,
            tx.to,
            tx.value,
            tx.input || tx.data,
            tx.v,
            tx.r,
            tx.s,
        ];
        const encodedTx = RLP.encode(formatHexArray(selectedTxElements));
        await new Promise((resolve) => {
            tree.put(siblingPath, encodedTx, () => resolve());
        });
    }
    return tree;
};
const getReceiptTree = async (block) => {
    const tree = new Tree();
    for(const receipt of block.receipts) {
        const siblingPath = RLP.encode(formatHex('0x' + receipt.transactionIndex.toString(16)));
        const encoded = receiptToRlp(receipt);
        await new Promise((resolve) => {
            tree.put(siblingPath, encoded, () => resolve());
        });
    }
    return tree;
}

const prepareReceiptProof = (proof) => {
    // the path is HP encoded
    const indexBuffer = proof.txIndex.slice(2);
    const hpIndex = "0x" + (indexBuffer.startsWith("0") ? "1" + indexBuffer.slice(1) : "00" + indexBuffer);
    
    // the value is the second buffer in the leaf (last node)
    const value = "0x" + Buffer.from(proof.receiptProof[proof.receiptProof.length - 1][1]).toString("hex");
    // the parent nodes must be rlp encoded
    const parentNodes = RLP.encode(proof.receiptProof);

    return {
        path: hpIndex,
        rlpEncodedReceipt: value,
        witness: parentNodes
    };
};

const receiptToRlp = (receipt) => {
    const selectedTxElements = [
        receipt.status != null ? formatHex('0x' + (receipt.status).toString(16)) : receipt.root,
        receipt.cumulativeGasUsed.hex,
        receipt.logsBloom,
        receipt.logs.map(log => {
            return [log.address, log.topics, log.data]
        }),
    ];
    return RLP.encode(selectedTxElements);
};


const invoke = async(tree, func, ...args) => {
    return new Promise((resolve) => {
        tree[func](...args, (...args2) => resolve(args2))
    });
}

async function temp() {
    const rpc = testnetInfo[0].rpc;
    const provider = getDefaultProvider(rpc);
    const prover = new GetProof(rpc);
    
    const block = await provider.perform("getBlock", { blockTag: '0x' + Number(blockN).toString(16) });

    const txHash = block.transactions[0];
    const pr = await prover.receiptProof(txHash);
    //console.log(pr);
    //console.log(block);

}

async function test(chains, wallet, options) {//await temp();
    const rpc = testnetInfo[0].rpc;
    const provider = getDefaultProvider(rpc);
    
    /*let tempBlock
    for(let i = 12000000-10; true; i++) {
        tempBlock = await provider.perform("getBlock", { blockTag: '0x' + Number(i).toString(16) });
        console.log(i, tempBlock.transactions.length);
        if(tempBlock.transactions.length == 1) break;
    }
    console.log(tempBlock);
    return;*/

    //const block = require('../../block.json');
    //const rlpBlock = rlpEncodedBlock(block);
    
    //let blockHash = ethers.utils.keccak256(rlpBlock);
    //console.log(blockHash == block.hash);

    
    /*const newBlock = await provider.perform("getBlock", { blockTag: '0x' + Number(10000000).toString(16) });
    newBlock.receipts = [];
    await Promise.all(newBlock.transactions.map(tx => {
        return new Promise(async(resolve) => {
            newBlock.receipts.push(await provider.getTransactionReceipt(tx));
            resolve();
        })
    }));
    setJSON(newBlock, './block7.json');*/

    const block = require('../../block7.json');
    const tree = await getReceiptTree(block);
    console.log('0x'+tree.root.toString('hex'));
    console.log(block.receiptsRoot);
    const encodedReceipts = block.receipts.map(receipt => receiptToRlp(receipt));
    const hashedReceipts = encodedReceipts.map(er => keccak256(er));
    //console.log(encodedReceipts);
    const proofs = []
    for(const index of ['0x80', '0x01', '0x02']) {
        const [, proof] = await invoke(Tree, 'prove', tree, index);
        proofs.push(proof.map(buffer => buffer.toString('hex')));
    };
    console.log(proofs);
    console.log(hashedReceipts);
    console.log(hashedReceipts.map(hashed => keccak256(hashed)));

    const block2 = require('../../block6.json');
    const tree2 = await getReceiptTree(block2);
    console.log('0x'+tree2.root.toString('hex'));
    console.log(block2.receiptsRoot);
    const encodedReceipts2 = block2.receipts.map(receipt => receiptToRlp(receipt));
    const hashedReceipts2 = encodedReceipts2.map(er => keccak256(er));
    const proofs2 = []
    for(const index of ['0x80', '0x01', '0x02']) {
        const [, proof] = await invoke(Tree, 'prove', tree2, index);
        proofs2.push(proof.map(buffer => buffer.toString('hex')));
    };
    console.log(proofs2);
    console.log(keccak256('0x'+proofs2[0][0]));
    console.log(hashedReceipts2);
    console.log(hashedReceipts2.map(hashed => keccak256(hashed)));

    console.log(encodedReceipts[0]);
    Tree.verifyProof(tree, '0x80', proofs[0], (err,val) => console.log('0x'+val.toString('hex')));
    
    //console.log(encodedReceipts2);

    //console.log(block.receipts[0]);
    //console.log(block2.receipts[0]);
    //console.log(block.receipts[1]);

    /*const index = encode(formatHex(block.transactions[4].transactionIndex));
    console.log(index);
    const [, val] = await invoke(tree, 'get', index);
    console.log(val);

    const [, proof] = await invoke(Tree, 'prove', tree, index);
    const hashes = proof.map(val => keccak256(val).slice(2));
    const proofHex = proof.map(val => val.toString('hex'));
    console.log(hashes);
    console.log(proofHex);
    console.log(tree.root.toString('hex') == hashes[0]);
    console.log(tree.root.toString('hex'));
    console.log(hashes[0]);


    console.log(proofHex[0].indexOf(hashes[1]));
    console.log(proofHex[1].indexOf(hashes[2]));

    const [err, val2] = await invoke(Tree, 'verifyProof', '', index, proof);

    console.log(err, val);

    const [, proofTrie] = await invoke(Tree, 'fromProof', proof);

    /*

    // known tx hash in block 6339082
    let txHash = "0x7758e5618428378370610aa6fb72ee80139043f9a6ca3472a346ca80ead000f1";
    const pr = await prover.receiptProof(txHash);
    let receiptProof = prepareReceiptProof(pr);
    //console.log(pr);
    //console.log(receiptProof);

    let result = await chain.contract.merkleProof(
        formatHex( receiptProof.rlpEncodedReceipt ),
        formatHex( receiptProof.path ),
        formatHex( receiptProof.witness ),
        formatHex( block.receiptsRoot ),
    );
    //console.log(block);
    console.log(result);

    const gav = new GetAndVerify(chain.rpc);
    console.log(await gav.receiptAgainstBlockHash('0x7758e5618428378370610aa6fb72ee80139043f9a6ca3472a346ca80ead000f1', block.hash))
*/

  /*for(let i=1;i<await chain.provider.getBlockNumber(); i++) {
      const block = await chain.provider.getBlock(i);
      for(const hash of block.transactions) {
          const tx = await chain.provider.getTransactionReceipt(hash);
          console.log(i, tx.logs);
      }
  }*/
/*
    it("can rlp encode receipt", async () => {
        const rlpExpected =
            "0xf9016601837925c3b9010000100000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000002000000000000000000000000040000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000020000000000000000000f85cf85a947ae0c8ea75428cd62fa48aca8738cff510125f2df842a0934b615ac45ae983959e39bac5d942944fe163a5b1e2b846f603224108d1f56ca0000000000000000000000000dba031ef165613ced730319c5f37ec8e316425ce80";
        const txHash = "0x3b4cfcf4dc6c43e444528b8a26138992e58020b250a804b6b3e510f75439ea0d";
        const receipt = await remoteProvider.perform("getTransactionReceipt", { transactionHash: txHash });
        const rlp = receiptToRlp(receipt);
        expect(rlp).to.equal(rlpExpected);
    }).timeout(4000);

    it("prove header and receipt inclusion", async () => {
        const txHash = "0x0ea44167dd31bca6a29a8f5c52fe4b73e92a7f6b9898322e8dc70478a7366806";
        const eventProof = await loadFixture(deployEventProof);
        
        const block = await remoteProvider.perform("getBlock", { blockTag: new BigNumber(6339082).toHexString() });
        const pr = await prover.receiptProof(txHash);
        const receiptProof = prepareReceiptProof(pr);
        const rlpBlock = rlpEncodedBlock(block);

        const result = await eventProof.functions.proveReceiptInclusion(
            block.hash,
            rlpBlock,
            receiptProof.rlpEncodedReceipt,
            receiptProof.path,
            receiptProof.witness
        );
        expect(result).to.be.true;
    }).timeout(100000);

    it("extract parent hash", async () => {
        const eventProof = await loadFixture(deployEventProof);
        const block = await remoteProvider.perform("getBlock", { blockTag: new BigNumber(5000079).toHexString() });
        const rlpBlock = rlpEncodedBlock(block);
        const parentHash = await eventProof.functions.extractParentHash(rlpBlock);
        expect(parentHash).to.equal(block.parentHash);
    });

    it("prove block hashes", async () => {
        const blockHeaders = [];
        const startIndex = 5000000;
        for (let index = startIndex; index < startIndex + 3; index++) {
            const block = await remoteProvider.perform("getBlock", { blockTag: new BigNumber(index).toHexString() });
            blockHeaders.push(rlpEncodedBlock(block));
        }
        const eventProof = await loadFixture(deployEventProof);
        const result = await eventProof.functions.proveBlocks(blockHeaders);
        
        expect(result).to.equal(true);
    }).timeout(100000);*/
}
module.exports = {
    deploy,
    test,
}