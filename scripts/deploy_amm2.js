const hre = require("hardhat");

async function main() {
  // Read AMM1 addresses to reuse same tokens
  const fs = require('fs');
  let addresses;
  
  try {
    addresses = JSON.parse(fs.readFileSync('amm1-addresses.json', 'utf8'));
    console.log('📖 Using existing tokens from AMM1 deployment\n');
  } catch (error) {
    console.log('⚠️  AMM1 addresses not found, deploying new tokens...\n');
    
    // Deploy tokens if they don't exist
    const Token = await hre.ethers.getContractFactory('Token')
    
    const dapp = await Token.deploy('Dapp Token', 'DAPP', '1000000')
    await dapp.deployed()
    console.log(`DAPP Token deployed to: ${dapp.address}`)

    const usd = await Token.deploy('USD Token', 'USD', '1000000')
    await usd.deployed()
    console.log(`USD Token deployed to: ${usd.address}`)
    
    addresses = {
      dapp: dapp.address,
      usd: usd.address
    };
  }

  // Deploy AMM2 (DEX 2) - using same tokens but different liquidity pool
  const AMM = await hre.ethers.getContractFactory('AMM')
  const amm2 = await AMM.deploy(addresses.dapp, addresses.usd)
  await amm2.deployed()
  console.log(`AMM2 (DEX 2) deployed to: ${amm2.address}`)

  // Save AMM2 address
  const amm2Addresses = {
    ...addresses,
    amm2: amm2.address
  };
  
  fs.writeFileSync('amm2-addresses.json', JSON.stringify(amm2Addresses, null, 2));
  console.log('\n📁 AMM2 addresses saved to amm2-addresses.json');
  console.log('🎯 AMM2 deployment complete!\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});