const hre = require("hardhat");

async function main() {
  console.log('🚀 Starting Complete DEX Aggregator Deployment...\n');
  
  // Step 1: Deploy Tokens using WorkingToken (two-step pattern)
  console.log('📦 Step 1: Deploying Tokens...');
  const WorkingToken = await hre.ethers.getContractFactory('WorkingToken')

  // Deploy with proper supply - use ethers.utils.parseEther for proper 18 decimal tokens
  // 1,000,000 tokens = 1,000,000 * 10^18 wei
  const totalSupply = hre.ethers.utils.parseEther('1000000')
  
  console.log('   Deploying DAPP Token...')
  const dapp = await WorkingToken.deploy(totalSupply)
  await dapp.deployed()
  console.log(`   ✅ DAPP Token deployed: ${dapp.address}`)
  
  // Initialize DAPP token
  await dapp.initialize('KelChain Token', 'KEL')
  console.log(`   ✅ DAPP Token initialized`)

  console.log('   Deploying USD Token...')
  const usd = await WorkingToken.deploy(totalSupply)
  await usd.deployed()
  console.log(`   ✅ USD Token deployed: ${usd.address}`)
  
  // Initialize USD token
  await usd.initialize('USD Token', 'USD')
  console.log(`   ✅ USD Token initialized`)

  // Step 2: Deploy AMM1 (DEX 1)
  console.log('\n🔄 Step 2: Deploying AMM1 (DEX 1)...');
  const AMM = await hre.ethers.getContractFactory('AMM')
  const amm1 = await AMM.deploy(dapp.address, usd.address)
  await amm1.deployed()
  console.log(`   ✅ AMM1 (DEX 1): ${amm1.address}`)

  // Step 3: Deploy AMM2 (DEX 2)
  console.log('\n🔄 Step 3: Deploying AMM2 (DEX 2)...');
  const amm2 = await AMM.deploy(dapp.address, usd.address)
  await amm2.deployed()
  console.log(`   ✅ AMM2 (DEX 2): ${amm2.address}`)

  // Step 4: Deploy AMM3 (DEX 3) with new tokens
  console.log('\n🔄 Step 4: Deploying AMM3 (DEX 3) with new tokens...');
  
  // Deploy new tokens specifically for AMM3
  console.log('   Deploying KEL3 Token...')
  const kel3 = await WorkingToken.deploy(totalSupply)
  await kel3.deployed()
  console.log(`   ✅ KEL3 Token deployed: ${kel3.address}`)
  await kel3.initialize('KelChain3 Token', 'KEL3')
  console.log(`   ✅ KEL3 Token initialized`)

  console.log('   Deploying USD3 Token...')
  const usd3 = await WorkingToken.deploy(totalSupply)
  await usd3.deployed()
  console.log(`   ✅ USD3 Token deployed: ${usd3.address}`)
  await usd3.initialize('USD3 Stable', 'USD3')
  console.log(`   ✅ USD3 Token initialized`)

  // Deploy AMM3 with new tokens
  const amm3 = await AMM.deploy(kel3.address, usd3.address)
  await amm3.deployed()
  console.log(`   ✅ AMM3 (DEX 3): ${amm3.address}`)

  // Step 5: Deploy DEX Aggregator
  console.log('\n🎯 Step 5: Deploying DEX Aggregator...');
  const DexAggregator = await hre.ethers.getContractFactory('DexAggregator')
  // Deploy with all 3 AMMs and main token pair (AMM3 will use the same token addresses but with different balances)
  const aggregator = await DexAggregator.deploy(
    amm1.address,  // AMM1 address
    amm2.address,  // AMM2 address
    amm3.address,  // AMM3 address
    dapp.address,  // Main token1 (KEL)
    usd.address   // Main token2 (USD)
  )
  await aggregator.deployed()
  console.log(`   ✅ DEX Aggregator: ${aggregator.address}`)

  // Step 5: Save all addresses
  console.log('\n💾 Step 5: Saving deployment addresses...');
  const fs = require('fs');
  const addresses = {
    tokens: {
      dapp: dapp.address,
      usd: usd.address
    },
    amms: {
      amm1: amm1.address,
      amm2: amm2.address,
      amm3: amm3.address
    },
    aggregator: aggregator.address
  };
  
  fs.writeFileSync('complete-deployment.json', JSON.stringify(addresses, null, 2));
  console.log('   ✅ Addresses saved to complete-deployment.json');

  // Summary
  console.log('\n🎉 DEPLOYMENT COMPLETE! 🎉');
  console.log('\n📋 Deployment Summary:');
  console.log('═══════════════════════════════════════');
  console.log(`💰 DAPP Token:     ${dapp.address}`);
  console.log(`💰 USD Token:      ${usd.address}`);
  console.log(`🔷 KEL3 Token:     ${kel3.address}`);
  console.log(`🔷 USD3 Token:     ${usd3.address}`);
  console.log(`🔄 AMM1 (DEX 1):   ${amm1.address}`);
  console.log(`🔄 AMM2 (DEX 2):   ${amm2.address}`);
  console.log(`🔄 AMM3 (DEX 3):   ${amm3.address} (uses KEL3/USD3)`);
  console.log(`🎯 DEX Aggregator: ${aggregator.address}`);
  console.log('═══════════════════════════════════════');
  console.log('\n📝 Next Steps:');
  console.log('1. Update src/config.json with these addresses');
  console.log('2. Add liquidity to both AMMs');
  console.log('3. Test the aggregator functionality');
  console.log('4. Start the React frontend\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
