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

  // Step 4: Deploy DEX Aggregator
  console.log('\n🎯 Step 4: Deploying DEX Aggregator...');
  const DexAggregator = await hre.ethers.getContractFactory('DexAggregator')
  const aggregator = await DexAggregator.deploy(
    amm1.address,
    amm2.address,
    dapp.address,
    usd.address
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
      amm2: amm2.address
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
  console.log(`🔄 AMM1 (DEX 1):   ${amm1.address}`);
  console.log(`🔄 AMM2 (DEX 2):   ${amm2.address}`);
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
