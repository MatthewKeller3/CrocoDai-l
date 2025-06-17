const hre = require("hardhat");

async function main() {
  console.log('🚀 Deploying Complete DEX Aggregator System...\n');
  
  try {
    console.log('=== STEP 1: DEPLOYING TOKENS ===');
    
    // Deploy WorkingToken contracts
    const WorkingToken = await hre.ethers.getContractFactory('WorkingToken');
    
    // Deploy DAPP token
    console.log('Deploying DAPP token...');
    const dappSupply = hre.ethers.utils.parseEther("1000");
    const dapp = await WorkingToken.deploy(dappSupply);
    await dapp.deployed();
    console.log(`✅ DAPP Token: ${dapp.address}`);
    
    // Initialize DAPP token
    await dapp.initialize("Dapp Token", "DAPP");
    console.log('✅ DAPP Token initialized');
    
    // Deploy USD token  
    console.log('Deploying USD token...');
    const usdSupply = hre.ethers.utils.parseEther("1000");
    const usd = await WorkingToken.deploy(usdSupply);
    await usd.deployed();
    console.log(`✅ USD Token: ${usd.address}`);
    
    // Initialize USD token
    await usd.initialize("USD Token", "USD");
    console.log('✅ USD Token initialized');
    
    console.log('\n=== STEP 2: DEPLOYING AMMs ===');
    
    // Deploy AMM contracts
    const AMM = await hre.ethers.getContractFactory('AMM');
    
    // Deploy AMM1 (DAPP/USD)
    console.log('Deploying AMM1 (DAPP/USD)...');
    const amm1 = await AMM.deploy(dapp.address, usd.address);
    await amm1.deployed();
    console.log(`✅ AMM1: ${amm1.address}`);
    
    // Deploy AMM2 (DAPP/USD - different instance)
    console.log('Deploying AMM2 (DAPP/USD)...');
    const amm2 = await AMM.deploy(dapp.address, usd.address);
    await amm2.deployed();
    console.log(`✅ AMM2: ${amm2.address}`);
    
    console.log('\n=== STEP 3: DEPLOYING DEX AGGREGATOR ===');
    
    // Deploy DexAggregator
    const DexAggregator = await hre.ethers.getContractFactory('DexAggregator');
    console.log('Deploying DexAggregator...');
    const dexAggregator = await DexAggregator.deploy(amm1.address, amm2.address, dapp.address, usd.address);
    await dexAggregator.deployed();
    console.log(`✅ DexAggregator: ${dexAggregator.address}`);
    
    console.log('\n=== STEP 4: ADDING LIQUIDITY TO AMMs ===');
    
    // Add liquidity to AMM1
    console.log('Adding liquidity to AMM1...');
    const liquidityAmount = hre.ethers.utils.parseEther("100"); // 100 tokens each
    
    // Approve tokens for AMM1
    await dapp.approve(amm1.address, liquidityAmount);
    await usd.approve(amm1.address, liquidityAmount);
    
    // Add liquidity to AMM1
    await amm1.addLiquidity(liquidityAmount, liquidityAmount);
    console.log('✅ Liquidity added to AMM1');
    
    // Add liquidity to AMM2 with different ratio for price difference
    console.log('Adding liquidity to AMM2...');
    const dappAmount2 = hre.ethers.utils.parseEther("80"); // 80 DAPP
    const usdAmount2 = hre.ethers.utils.parseEther("120"); // 120 USD (different ratio)
    
    // Approve tokens for AMM2
    await dapp.approve(amm2.address, dappAmount2);
    await usd.approve(amm2.address, usdAmount2);
    
    // Add liquidity to AMM2
    await amm2.addLiquidity(dappAmount2, usdAmount2);
    console.log('✅ Liquidity added to AMM2');
    
    console.log('\n=== VERIFICATION ===');
    
    // Check AMM1 prices
    const amm1DappToUsd = await amm1.calculateToken1Swap(hre.ethers.utils.parseEther("1"));
    const amm1UsdToDapp = await amm1.calculateToken2Swap(hre.ethers.utils.parseEther("1"));
    
    console.log('📊 AMM1 Prices:');
    console.log(`   1 DAPP → ${hre.ethers.utils.formatEther(amm1DappToUsd)} USD`);
    console.log(`   1 USD → ${hre.ethers.utils.formatEther(amm1UsdToDapp)} DAPP`);
    
    // Check AMM2 prices
    const amm2DappToUsd = await amm2.calculateToken1Swap(hre.ethers.utils.parseEther("1"));
    const amm2UsdToDapp = await amm2.calculateToken2Swap(hre.ethers.utils.parseEther("1"));
    
    console.log('📊 AMM2 Prices:');
    console.log(`   1 DAPP → ${hre.ethers.utils.formatEther(amm2DappToUsd)} USD`);
    console.log(`   1 USD → ${hre.ethers.utils.formatEther(amm2UsdToDapp)} DAPP`);
    
    // Test DexAggregator
    console.log('\n📊 Testing DexAggregator...');
    const testAmount = hre.ethers.utils.parseEther("1");
    const bestAmmForDapp = await dexAggregator.getBestRateToken1ToToken2(testAmount);
    const bestAmmForUsd = await dexAggregator.getBestRateToken2ToToken1(testAmount);
    
    console.log(`Best AMM for DAPP→USD: AMM${bestAmmForDapp.bestDex === amm1.address ? '1' : '2'}`);
    console.log(`Best AMM for USD→DAPP: AMM${bestAmmForUsd.bestDex === amm1.address ? '1' : '2'}`);
    
    console.log('\n🎉 COMPLETE DEX AGGREGATOR SYSTEM DEPLOYED SUCCESSFULLY!');
    console.log('\n📋 DEPLOYMENT SUMMARY:');
    console.log('════════════════════════════════════════════════════════');
    console.log(`📝 DAPP Token:     ${dapp.address}`);
    console.log(`📝 USD Token:      ${usd.address}`);
    console.log(`🔄 AMM1:           ${amm1.address}`);
    console.log(`🔄 AMM2:           ${amm2.address}`);
    console.log(`🎯 DexAggregator:  ${dexAggregator.address}`);
    console.log('════════════════════════════════════════════════════════');
    
    // Output for config.json
    console.log('\n📄 For config.json:');
    console.log(JSON.stringify({
      "dappToken": dapp.address,
      "usdToken": usd.address,
      "amm1": amm1.address,
      "amm2": amm2.address,
      "dexAggregator": dexAggregator.address
    }, null, 2));
    
  } catch (error) {
    console.error('\n❌ Deployment failed:');
    console.error('Error:', error.message);
    if (error.reason) console.error('Reason:', error.reason);
    if (error.code) console.error('Code:', error.code);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
