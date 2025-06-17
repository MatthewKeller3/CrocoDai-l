// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const config = require('../src/config.json')

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

const ether = tokens
const shares = ether

async function main() {

  // Fetch accounts
  console.log(`Fetching accounts & network \n`)
  const accounts = await ethers.getSigners()
  const deployer = accounts[0]
  const investor1 = accounts[1]
  const investor2 = accounts[2]
  const investor3 = accounts[3]
  const investor4 = accounts[4]

  // Fetch Network
  const { chainId } = await ethers.provider.getNetwork()

  console.log(`Fetching token and transferring to accounts...\n`)

  // Fetch KelChain Token (using WorkingToken interface)
  const kelchain = await ethers.getContractAt('WorkingToken', config[chainId].tokens.kelchain.address)
  console.log(`KelChain Token fetched: ${kelchain.address}`)

  // Fetch USD Token (using WorkingToken interface)
  const usd = await ethers.getContractAt('WorkingToken', config[chainId].tokens.usd.address)
  console.log(`USD Token fetched: ${usd.address}`)

  // Check deployer balances first
  const deployerKelchainBalance = await kelchain.balanceOf(deployer.address)
  const deployerUsdBalance = await usd.balanceOf(deployer.address)
  
  console.log(`Deployer KELCHAIN balance: ${ethers.utils.formatEther(deployerKelchainBalance)}`)
  console.log(`Deployer USD balance: ${ethers.utils.formatEther(deployerUsdBalance)}`)

  /////////////////////////////////////////////////////////////
  // Distribute Tokens to Investors (reduced amounts)
  //

  let transaction

  // Send smaller amounts to avoid insufficient balance
  const transferAmount = tokens(5) // Reduced from 10 to 5

  // Send kelchain tokens to investor 1
  transaction = await kelchain.connect(deployer).transfer(investor1.address, transferAmount)
  await transaction.wait()
  console.log(`✅ Sent ${ethers.utils.formatEther(transferAmount)} KELCHAIN to investor1`)

  // Send usd tokens to investor 2
  transaction = await usd.connect(deployer).transfer(investor2.address, transferAmount)
  await transaction.wait()
  console.log(`✅ Sent ${ethers.utils.formatEther(transferAmount)} USD to investor2`)

  // Send kelchain tokens to investor 3
  transaction = await kelchain.connect(deployer).transfer(investor3.address, transferAmount)
  await transaction.wait()
  console.log(`✅ Sent ${ethers.utils.formatEther(transferAmount)} KELCHAIN to investor3`)

  // Send usd tokens to investor 4
  transaction = await usd.connect(deployer).transfer(investor4.address, transferAmount)
  await transaction.wait()
  console.log(`✅ Sent ${ethers.utils.formatEther(transferAmount)} USD to investor4`)

  /////////////////////////////////////////////////////////////
  // Adding Liquidity to AMM1
  //

  let liquidityAmount = tokens(20) // Reduced from 100 to 20

  console.log(`\nFetching AMM1...\n`)

  // Fetch AMM1
  const amm1 = await ethers.getContractAt('AMM', config[chainId].amms.amm1.address)
  console.log(`AMM1 fetched: ${amm1.address}`)

  transaction = await kelchain.connect(deployer).approve(amm1.address, liquidityAmount)
  await transaction.wait()

  transaction = await usd.connect(deployer).approve(amm1.address, liquidityAmount)
  await transaction.wait()

  // Deployer adds liquidity to AMM1
  console.log(`Adding liquidity to AMM1...`)
  transaction = await amm1.connect(deployer).addLiquidity(liquidityAmount, liquidityAmount)
  await transaction.wait()
  console.log(`✅ Added ${ethers.utils.formatEther(liquidityAmount)} liquidity to AMM1`)

  /////////////////////////////////////////////////////////////
  // Adding Liquidity to AMM2
  //

  console.log(`\nFetching AMM2...\n`)

  // Fetch AMM2
  const amm2 = await ethers.getContractAt('AMM', config[chainId].amms.amm2.address)
  console.log(`AMM2 fetched: ${amm2.address}`)

  // Different liquidity ratio for AMM2 to create price differences
  let amm2LiquidityAmount1 = tokens(15) // Different ratio: 15:25
  let amm2LiquidityAmount2 = tokens(25)

  transaction = await kelchain.connect(deployer).approve(amm2.address, amm2LiquidityAmount1)
  await transaction.wait()

  transaction = await usd.connect(deployer).approve(amm2.address, amm2LiquidityAmount2)
  await transaction.wait()

  // Deployer adds liquidity to AMM2 with different ratio
  console.log(`Adding liquidity to AMM2 with different ratio...`)
  transaction = await amm2.connect(deployer).addLiquidity(amm2LiquidityAmount1, amm2LiquidityAmount2)
  await transaction.wait()
  console.log(`✅ Added ${ethers.utils.formatEther(amm2LiquidityAmount1)} KELCHAIN and ${ethers.utils.formatEther(amm2LiquidityAmount2)} USD to AMM2`)

  /////////////////////////////////////////////////////////////
  // Investor 1 Swaps: Kelchain --> USD (AMM1)
  //

  console.log(`\nInvestor 1 Swaps on AMM1...\n`)

  // Investor approves tokens (reduced amount)
  transaction = await kelchain.connect(investor1).approve(amm1.address, transferAmount)
  await transaction.wait()

  // Investor swaps 1 token
  transaction = await amm1.connect(investor1).swapToken1(tokens(1))
  await transaction.wait()
  console.log(`✅ Investor1 swapped 1 KELCHAIN for USD on AMM1`)

  /////////////////////////////////////////////////////////////
  // Investor 2 Swaps: USD --> Kelchain (AMM1)
  //

  console.log(`Investor 2 Swaps on AMM1...\n`)
  // Investor approves tokens
  transaction = await usd.connect(investor2).approve(amm1.address, transferAmount)
  await transaction.wait()

  // Investor swaps 1 token
  transaction = await amm1.connect(investor2).swapToken2(tokens(1))
  await transaction.wait()
  console.log(`✅ Investor2 swapped 1 USD for KELCHAIN on AMM1`)

  /////////////////////////////////////////////////////////////
  // Investor 3 Swaps: Kelchain --> USD (AMM2)
  //

  console.log(`Investor 3 Swaps on AMM2...\n`)

  // Investor approves tokens
  transaction = await kelchain.connect(investor3).approve(amm2.address, transferAmount)
  await transaction.wait()

  // Investor swaps 2 tokens
  transaction = await amm2.connect(investor3).swapToken1(tokens(2))
  await transaction.wait()
  console.log(`✅ Investor3 swapped 2 KELCHAIN for USD on AMM2`)

  /////////////////////////////////////////////////////////////
  // Investor 4 Swaps: USD --> Kelchain (AMM2)
  //

  console.log(`Investor 4 Swaps on AMM2...\n`)

  // Investor approves tokens
  transaction = await usd.connect(investor4).approve(amm2.address, transferAmount)
  await transaction.wait()

  // Investor swaps 2 tokens
  transaction = await amm2.connect(investor4).swapToken2(tokens(2))
  await transaction.wait()
  console.log(`✅ Investor4 swapped 2 USD for KELCHAIN on AMM2`)

  console.log(`\n🎉 Seeding completed successfully!`)
  console.log(`✅ Both AMMs now have liquidity`)
  console.log(`✅ Price differences established between AMM1 and AMM2`)
  console.log(`✅ Test swaps completed on both AMMs`)
  console.log(`✅ Ready for aggregator testing!`)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
