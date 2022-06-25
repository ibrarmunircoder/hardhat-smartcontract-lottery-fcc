const { network, ethers } = require('hardhat')
const { developmentChains, networkConfig } = require('../helper-hardhat-config')
const { verify } = require('../utils/verify')

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther('2')

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2MockAddress, subscriptionId
    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock')
        vrfCoordinatorV2MockAddress = vrfCoordinatorV2Mock.address
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        // this transaction emits an event with a subscript id and we can get it
        subscriptionId = await transactionReceipt.events[0].args.subId
        // now fund the subscription
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        // if not in local host or hardhat network
        vrfCoordinatorV2MockAddress = networkConfig[chainId]['vrfCoordinatorV2']
        // creating subscription through vrf.chain.link website for test or real netwrok
        subscriptionId = networkConfig[chainId]['subscriptionId']
    }

    const entranceFee = networkConfig[chainId]['entranceFee']
    const gasLane = networkConfig[chainId]['gasLane']
    const callbackGasLimit = networkConfig[chainId]['callbackGasLimit']
    const interval = networkConfig[chainId]['interval']
    const args = [
        vrfCoordinatorV2MockAddress,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]
    const raffle = await deploy('Raffle', {
        from: deployer,
        args,
        log: true,
        waitConfirmations: network.config.blockConfirmations,
    })

    log('---------------------------------------------', raffle.address)

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(raffle.address, args)
    }
}

module.exports.tags = ['all', 'raffle']
