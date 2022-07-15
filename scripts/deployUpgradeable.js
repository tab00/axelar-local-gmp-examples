// import { ethers, upgrades } from 'hardhat';
const { ethers, upgrades } = require("hardhat");

async function main() {
  const contractName = "ERC20CrossChainUpgradeable"

  const hre = require("hardhat");
  console.log(`chain: ${hre.network.config.name} (${hre.network.config.chainId})`)
  
  const [signer] = await ethers.getSigners();
  console.log(`signer.address: ${signer.address}`);
  console.log(`signer balance: ${(await signer.getBalance()).toString()}`);

  // We get the contract to deploy
  const Contract = await ethers.getContractFactory(contractName)

  const name = 'An Awesome Axelar Cross Chain Token';
const symbol = 'AACCT';
const decimals = 13;

  const contract = await upgrades.deployProxy(Contract, [name, symbol, decimals], { kind: 'uups' })

  console.log(`waiting for deployment to finish`)
  await contract.deployed()
  const txHash = contract.deployTransaction.hash
  const txReceipt = await ethers.provider.waitForTransaction(txHash)
  const contractAddress = txReceipt.contractAddress
  console.log(`Contract ${contractName} deployed to address ${contractAddress}`)
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
