require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-etherscan')
require('hardhat-deploy')
require('solidity-coverage')
require('hardhat-gas-reporter')
require('hardhat-contract-sizer')
require('dotenv').config()

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const RINKBEY_RPC_URL = process.env.RINKBEY_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const COINTMARKETCAP_API_KEY = process.env.COINTMARKETCAP_API_KEY

module.exports = {
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },
        rinkbey: {
            chainId: 4,
            blockConfirmations: 6,
            url: RINKBEY_RPC_URL,
            accounts: [PRIVATE_KEY],
        },
    },
    solidity: {
        compilers: [{ version: '0.8.8' }, { version: '0.6.0' }],
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
    gasReporter: {
        enabled: false,
        outputFile: 'gas-report.txt',
        noColors: true,
        currency: 'USD',
        coinmarketcap: COINTMARKETCAP_API_KEY,
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    mocha: {
        timeout: 200000, // 200 seconds
    },
}
