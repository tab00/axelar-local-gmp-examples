require('hardhat-gas-reporter');
require('solidity-coverage');
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config()

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    solidity: {
        version: '0.8.9',
        settings: {
            evmVersion: process.env.EVM_VERSION || 'london',
            optimizer: {
                enabled: true,
                runs: 1000,
                details: {
                    peephole: true,
                    inliner: true,
                    jumpdestRemover: true,
                    orderLiterals: true,
                    deduplicate: true,
                    cse: true,
                    constantOptimizer: true,
                    yul: true,
                    yulDetails: {
                        stackAllocation: true,
                    },
                },
            },
        },
    },
    paths: {
        sources: "./examples",
    },
    networks: {
        moonbeam: {
            accounts: getAccounts(),
            "name": "Moonbeam",
            "chainId": 2500,
            "url": "http://localhost:8500/0",
        },
        avalanche: {
            accounts: getAccounts(),
            "name": "Avalanche",
            "chainId": 2501,
            "url": "http://localhost:8500/1",
        },
        fantom: {
            accounts: getAccounts(),
            "name": "Fantom",
            "chainId": 2502,
            "url": "http://localhost:8500/2",
        },
        ethereum: {
            accounts: getAccounts(),
            "name": "Ethereum",
            "chainId": 2503,
            "url": "http://localhost:8500/3",
        },
        polygon: {
            accounts: getAccounts(),
            "name": "Polygon",
            "chainId": 2504,
            "url": "http://localhost:8500/4",
        },
    },
};

function getAccounts() {
    return [process.env.PRIVATE_KEY];
}
