const { assert, expect } = require('chai')
const { network, getNamedAccounts, ethers, deployments } = require('hardhat')
const { developmentChains, networkConfig } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name)
    ? describe.skip
    : describe('Raffle', () => {
          let raffle, vrfCoordinatorV2Mock, deployer, raffleEnteranceFee, interval
          const chainId = network.config.chainId

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(['all'])
              raffle = await ethers.getContract('Raffle', deployer)
              vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock', deployer)
              raffleEnteranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe('Constructor', () => {
              it('initializes the raffle correctly', async () => {
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), '0')
                  assert.equal(interval.toString(), networkConfig[chainId]['interval'])
              })
          })

          describe('enterRaffle', () => {
              it('revert if you dont pay enough eth', async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      'Raffle__NotEnoughETHEntered'
                  )
              })
              it('records player when they enter', async () => {
                  await raffle.enterRaffle({ value: raffleEnteranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })

              it('emits event on enter', async () => {
                  await expect(raffle.enterRaffle({ value: raffleEnteranceFee })).to.emit(
                      raffle,
                      'RaffleEntered'
                  )
              })

              it('doesnt allow entrance when raffle is calculating state', async () => {
                  await raffle.enterRaffle({ value: raffleEnteranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.send('evm_mine', [])
                  // we pretend to be a chainlink keeper
                  await raffle.performUpkeep([])
                  await expect(
                      raffle.enterRaffle({ value: raffleEnteranceFee })
                  ).to.be.revertedWith('Raffle__NotOpen')
              })
          })

          describe('checkUpKeep', () => {
              it('returns false if people have not sent any ETH', async () => {
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.send('evm_mine', [])
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert(!upKeepNeeded)
              })
              it('returns false if raffle isnt in open state', async () => {
                  await raffle.enterRaffle({ value: raffleEnteranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.send('evm_mine', [])
                  await raffle.performUpkeep([])
                  const raffleState = await raffle.getRaffleState()
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(raffleState.toString(), '1')
                  assert.equal(upKeepNeeded, false)
              })

              it('returns false if enough time hasnt passed', async () => {
                  await raffle.enterRaffle({ value: raffleEnteranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() - 1])
                  await network.provider.request({ method: 'evm_mine', params: [] })
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(upKeepNeeded, false)
              })

              it('returns true if enough time has passed, has players, eth and is open', async () => {
                  await raffle.enterRaffle({ value: raffleEnteranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.request({ method: 'evm_mine', params: [] })
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep('0x')
                  assert(upKeepNeeded)
              })
          })

          describe('performUpkeep', () => {
              it('it can only run if checkupKeep is true', async () => {
                  await raffle.enterRaffle({ value: raffleEnteranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.request({ method: 'evm_mine', params: [] })
                  const tx = await raffle.performUpkeep('0x')
                  assert(tx)
              })

              it('revert when checkup is false', async () => {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      'Raffle__UpKeepNotNeeded'
                  )
              })
              it('updates the raffle state, emits an events and calls the vrf Coordinator', async () => {
                  await raffle.enterRaffle({ value: raffleEnteranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.request({ method: 'evm_mine', params: [] })
                  const tx = await raffle.performUpkeep('0x')
                  const transactionReceipt = await tx.wait(1)
                  const raffleState = await raffle.getRaffleState()
                  const requestId = transactionReceipt.events[1].args.requestId
                  assert(requestId.toNumber() > 0)
                  assert(raffleState.toString() === '1')
              })
          })

          describe('fulfillRandomWords', () => {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEnteranceFee })
                  await network.provider.send('evm_increaseTime', [interval.toNumber() + 1])
                  await network.provider.request({ method: 'evm_mine', params: [] })
              })
              it('can only be called after performUpkeep', async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith('nonexistent request')
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith('nonexistent request')
              })
              it('picks a winner, resets the lottery, and sends money', async () => {
                  const additionalEntrants = 3
                  const startingAccountIndex = 1 //deployer = 0
                  const accounts = await ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = await raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: raffleEnteranceFee })
                  }

                  const startingTimestamp = await raffle.getLatestTimeStamp()

                  // performUpkeep (mock being chainlink Keepers)
                  // fulfillRandomWords (mock being the chainlink VRF)
                  // we will have to wait for the fulfillRandomWords to be called
                  let winnerStartingBalance
                  await new Promise(async (resolve, reject) => {
                      raffle.once('WinnerPicked', async () => {
                          console.log('Found the event..')
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              console.log(recentWinner)
                              console.log(accounts[0].address)
                              console.log(accounts[1].address)
                              console.log(accounts[2].address)
                              console.log(accounts[3].address)
                              const winnerEndingBalance = await accounts[1].getBalance()
                              const raffleState = await raffle.getRaffleState()
                              const endingTimeStamp = await raffle.getLatestTimeStamp()
                              const numOfPlayers = await raffle.getNumberOfPlayers()
                              assert.equal(numOfPlayers.toString(), '0')
                              assert.equal(raffleState.toString(), '0')
                              assert(endingTimeStamp > startingTimestamp)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(
                                      raffleEnteranceFee
                                          .mul(additionalEntrants)
                                          .add(raffleEnteranceFee)
                                  )
                              )
                          } catch (e) {
                              reject(e)
                          }
                          resolve()
                      })

                      //   setting up the listener
                      // below, we will fire the event, and the listener will pick it up, and resolve
                      const tx = await raffle.performUpkeep([])
                      const transactionReceipt = await tx.wait(1)
                      winnerStartingBalance = await accounts[1].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          transactionReceipt.events[1].args.requestId,
                          raffle.address
                      )
                  })
              })
          })
      })
