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
  
  // Log available accounts
  console.log(`Available accounts (${accounts.length}):`)
  accounts.forEach((acc, i) => {
    console.log(`[${i}]: ${acc.address}`)
  })
  
  // Using 3 accounts (deployer + 2 investors) since that's what we have
  if (accounts.length < 3) {
    throw new Error(`Not enough accounts available. Need at least 3, got ${accounts.length}`)
  }
  
  const [deployer, investor1, investor2] = accounts.slice(0, 3)

  // Fetch Network
  const { chainId } = await ethers.provider.getNetwork()

  console.log(`Fetching token and transferring to accounts...\n`)

  // Log the config for debugging
  console.log('Chain ID:', chainId);
  console.log('Config:', JSON.stringify(config[chainId], null, 2));

  // Fetch Tokens
  const tokenConfigs = config[chainId].tokens;
  
  // Main tokens (KEL/USD)
  const kelchain = await ethers.getContractAt('WorkingToken', tokenConfigs.kelchain.address);
  const usd = await ethers.getContractAt('WorkingToken', tokenConfigs.usd.address);
  
  // AMM3 tokens
  const kel3 = await ethers.getContractAt('WorkingToken', tokenConfigs.kelchain3.address);
  const usd3 = await ethers.getContractAt('WorkingToken', tokenConfigs.usd3.address);
  
  console.log('KelChain Token fetched:', kelchain.address);
  console.log('USD Token fetched:', usd.address);
  console.log('KEL3 Token fetched:', kel3.address);
  console.log('USD3 Token fetched:', usd3.address);

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
  console.log(`✅ Sent ${ethers.utils.formatEther(transferAmount)} KELCHAIN to ${investor1.address}`)

  // Send usd tokens to investor 2
  transaction = await usd.connect(deployer).transfer(investor2.address, transferAmount)
  await transaction.wait()
  console.log(`✅ Sent ${ethers.utils.formatEther(transferAmount)} USD to ${investor2.address}`)

  /////////////////////////////////////////////////////////////
  // Adding Liquidity to AMM1
  //
  console.log(`\nFetching AMM1...\n`)

  // Fetch AMM1
  const amm1 = await ethers.getContractAt('AMM', config[chainId].amms.amm1.address)
  console.log(`AMM1 fetched: ${amm1.address}`)

  // Check if this is the first time adding liquidity
  const totalShares = await amm1.totalShares()
  const isFirstLiquidity = totalShares.eq(0)
  
  let token1Amount, token2Amount
  
  if (isFirstLiquidity) {
    // For first liquidity, we can add any amounts we want in the desired ratio
    token1Amount = tokens(100)
    token2Amount = tokens(100)
  } else {
    // For subsequent additions, we need to maintain the existing ratio
    const token1Balance = await amm1.token1Balance()
    const token2Balance = await amm1.token2Balance()
    
    // Calculate the required token2 amount based on current pool ratio
    token1Amount = tokens(100)
    token2Amount = token1Amount.mul(token2Balance).div(token1Balance)
  }

  // Approve tokens
  console.log(`Approving tokens for AMM1...`)
  transaction = await kelchain.connect(deployer).approve(amm1.address, token1Amount)
  await transaction.wait()
  transaction = await usd.connect(deployer).approve(amm1.address, token2Amount)
  await transaction.wait()

  // Deployer adds liquidity to AMM1
  console.log(`Adding liquidity to AMM1...`)
  try {
    transaction = await amm1.connect(deployer).addLiquidity(token1Amount, token2Amount)
    await transaction.wait()
    console.log(`✅ Added liquidity to AMM1: ${ethers.utils.formatEther(token1Amount)} KELCHAIN and ${ethers.utils.formatEther(token2Amount)} USD`)
  } catch (error) {
    console.error('Error adding liquidity to AMM1:', error)
    throw error
  }

  /////////////////////////////////////////////////////////////
  // Adding Liquidity to AMM2
  //
  console.log(`\nFetching AMM2...\n`)

  // Fetch AMM2
  const amm2 = await ethers.getContractAt('AMM', config[chainId].amms.amm2.address)
  console.log(`AMM2 fetched: ${amm2.address}`)
  
  // Check if this is the first time adding liquidity to AMM2
  const amm2TotalShares = await amm2.totalShares()
  const isFirstLiquidityAmm2 = amm2TotalShares.eq(0)
  
  let amm2Token1Amount, amm2Token2Amount
  
  if (isFirstLiquidityAmm2) {
    // For first liquidity, we can add any amounts we want in the desired ratio
    amm2Token1Amount = tokens(80)
    amm2Token2Amount = tokens(100)
  } else {
    // For subsequent additions, we need to maintain the existing ratio
    const token1BalanceAmm2 = await amm2.token1Balance()
    const token2BalanceAmm2 = await amm2.token2Balance()
    
    // Calculate the required token2 amount based on current pool ratio
    amm2Token1Amount = tokens(80)
    amm2Token2Amount = amm2Token1Amount.mul(token2BalanceAmm2).div(token1BalanceAmm2)
  }
  
  // Approve tokens for AMM2
  console.log(`Approving tokens for AMM2...`)
  transaction = await kelchain.connect(deployer).approve(amm2.address, amm2Token1Amount)
  await transaction.wait()
  transaction = await usd.connect(deployer).approve(amm2.address, amm2Token2Amount)
  await transaction.wait()
  
  // Add liquidity to AMM2
  console.log(`Adding liquidity to AMM2...`)
  try {
    transaction = await amm2.connect(deployer).addLiquidity(amm2Token1Amount, amm2Token2Amount)
    await transaction.wait()
    console.log(`✅ Added liquidity to AMM2: ${ethers.utils.formatEther(amm2Token1Amount)} KELCHAIN and ${ethers.utils.formatEther(amm2Token2Amount)} USD`)
  } catch (error) {
    console.error('Error adding liquidity to AMM2:', error)
    throw error
  }

  // Price differences will be created by the initial different ratios between AMMs
  console.log(`✅ AMM1 and AMM2 have been initialized with different price ratios`)

  /////////////////////////////////////////////////////////////
  // Adding Liquidity to AMM3
  //
  try {
    console.log(`\nFetching AMM3...\n`)
    
    // Get AMM3 config
    const amm3Config = config[chainId].amms.amm3;
    if (!amm3Config) {
      console.log('AMM3 not configured, skipping...');
      return;
    }
    
    // Fetch AMM3
    const amm3 = await ethers.getContractAt('AMM', amm3Config.address);
    console.log(`AMM3 fetched: ${amm3.address}`);
    
    // Get the correct token contracts for AMM3
    const amm3Token1 = await ethers.getContractAt('WorkingToken', tokenConfigs[amm3Config.token1].address);
    const amm3Token2 = await ethers.getContractAt('WorkingToken', tokenConfigs[amm3Config.token2].address);
    
    console.log(`AMM3 Token 1 (${await amm3Token1.symbol()}):`, amm3Token1.address);
    console.log(`AMM3 Token 2 (${await amm3Token2.symbol()}):`, amm3Token2.address);
    
    // Check if this is the first time adding liquidity to AMM3
    const amm3TotalShares = await amm3.totalShares();
    const isFirstLiquidityAmm3 = amm3TotalShares.eq(0);
    
    let amm3Token1Amount, amm3Token2Amount;
    
    if (isFirstLiquidityAmm3) {
      // For first liquidity, we can add any amounts we want in the desired ratio
      amm3Token1Amount = tokens(100);
      amm3Token2Amount = tokens(100);
      
      console.log(`Initializing AMM3 with initial liquidity...`);
      
      // Approve tokens for AMM3
      console.log(`Approving ${await amm3Token1.symbol()} for AMM3...`);
      let tx = await amm3Token1.connect(deployer).approve(amm3.address, amm3Token1Amount);
      await tx.wait();
      
      console.log(`Approving ${await amm3Token2.symbol()} for AMM3...`);
      tx = await amm3Token2.connect(deployer).approve(amm3.address, amm3Token2Amount);
      await tx.wait();
      
      // Add initial liquidity
      console.log(`Adding initial liquidity to AMM3...`);
      tx = await amm3.connect(deployer).addLiquidity(amm3Token1Amount, amm3Token2Amount);
      await tx.wait();
      
      console.log(`✅ Added initial liquidity to AMM3: ${ethers.utils.formatEther(amm3Token1Amount)} ${await amm3Token1.symbol()} and ${ethers.utils.formatEther(amm3Token2Amount)} ${await amm3Token2.symbol()}`);
    } else {
      console.log('AMM3 already has liquidity, skipping initialization...');
    }
    
    // Log AMM3 balances
    const [reserve1, reserve2] = await Promise.all([
      amm3.token1Balance(),
      amm3.token2Balance()
    ]);
    
    console.log('\nAMM3 Balances:');
    console.log(`${await amm3Token1.symbol()}: ${ethers.utils.formatEther(reserve1)}`);
    console.log(`${await amm3Token2.symbol()}: ${ethers.utils.formatEther(reserve2)}`);
  } catch (error) {
    console.error('Error initializing AMM3:', error.message);
    console.log('Skipping AMM3 initialization due to error');
  }
  
  console.log(`\n✅ All AMMs have been initialized with different price ratios`)

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
  // Investor 1 Swaps: Kelchain --> USD (AMM2)
  //

  console.log(`Investor 1 Swaps on AMM2...\n`)

  // Investor approves tokens
  transaction = await kelchain.connect(investor1).approve(amm2.address, transferAmount)
  await transaction.wait()

  // Investor swaps 2 tokens
  transaction = await amm2.connect(investor1).swapToken1(tokens(2))
  await transaction.wait()
  console.log(`✅ Investor1 swapped 2 KELCHAIN for USD on AMM2`)

  /////////////////////////////////////////////////////////////
  // Investor 2 Swaps: USD --> Kelchain (AMM2)
  //

  console.log(`Investor 2 Swaps on AMM2...\n`)

  // Investor approves tokens
  transaction = await usd.connect(investor2).approve(amm2.address, transferAmount)
  await transaction.wait()

  // Investor swaps 2 tokens
  transaction = await amm2.connect(investor2).swapToken2(tokens(2))
  await transaction.wait()
  console.log(`✅ Investor2 swapped 2 USD for KELCHAIN on AMM2`)

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
