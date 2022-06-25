const { assert, expect } = require('chai')
const { network, getNamedAccounts, ethers, deployments } = require('hardhat')
const { developmentChains, networkConfig } = require('../../helper-hardhat-config')

// to test on the rinkbey, Follow the steps
// 1. Get our subId for chainlink VRF
// 2. Deploy our contract using the subID
// 3. Register the contract with chainlink VRF & it's subId
// 4. Register the contract with chainlink keepers
// 5. Run staging test

developmentChains.includes(network.name)
    ? describe.skip
    : describe('Raffle', () => {
          let raffle, deployer, raffleEnteranceFee

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              raffle = await ethers.getContract('Raffle', deployer)
              raffleEnteranceFee = await raffle.getEntranceFee()
          })

          describe('fulfillRandomWords', () => {
              it('works with live chainlink keepers and chainlink VRF, we get a random winner', async () => {
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  const accounts = await ethers.getSigners()
                  // setup listener before we enter the raffle
                  // just in case the blockchain moves really fast
                  await new Promise(async (resolve, reject) => {
                      raffle.once('WinnerPicked', async () => {
                          console.log('Winner Picked Event Fired!')
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance = await accounts[0].getBalance()
                              const endingTimeStamp = await raffle.getLatestTimeStamp()

                              await expect(raffle.getPlayer(0)).to.be.reverted
                              assert.equal(recentWinner, accounts[0].address)
                              assert.equal(raffleState.toString(), '0')
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(raffleEnteranceFee).toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (err) {
                              reject(err)
                          }
                      })

                      //   enter raffle
                      await raffle.enterRaffle({ value: raffleEnteranceFee })
                      const winnerStartingBalance = await accounts[0].getBalance()
                  })
              })
          })
      })
