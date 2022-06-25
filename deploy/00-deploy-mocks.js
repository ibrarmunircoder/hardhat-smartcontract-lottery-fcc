const { ethers } = require('hardhat')
const { developmentChains } = require('../helper-hardhat-config')

const BASE_FEE = ethers.utils.parseEther('0.25')
const GAS_PRICE_LINK = 1e9 //it's calculated values based on the gas price of the chain

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    if (developmentChains.includes(network.name)) {
        log('Local network detected!.. Deploying contract')
        await deploy('VRFCoordinatorV2Mock', {
            contract: 'VRFCoordinatorV2Mock',
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })
        log('Mocks Deployed')
        log('--------------------------------------------------------')
    }
}

module.exports.tags = ['all', 'mocks']
