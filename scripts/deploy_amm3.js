const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  
  console.log('🚀 Deploying new tokens for AMM3...\n');
  
  // Deploy new tokens specifically for AMM3
  const Token = await hre.ethers.getContractFactory('Token')
  
  // Deploy Token 1 - KELCHAIN3
  const kelchain3 = await Token.deploy('KelChain3 Token', 'KEL3', '1000000')
  await kelchain3.deployed()
  console.log(`KEL3 Token deployed to: ${kelchain3.address}`)

  // Deploy Token 2 - USD3
  const usd3 = await Token.deploy('USD3 Stablecoin', 'USD3', '1000000')
  await usd3.deployed()
  console.log(`USD3 Token deployed to: ${usd3.address}`)
  
  const addresses = {
    kelchain3: kelchain3.address,
    usd3: usd3.address
  };

  // Deploy AMM3 (DEX 3) - using new tokens
  const AMM = await hre.ethers.getContractFactory('AMM')
  const amm3 = await AMM.deploy(addresses.kelchain3, addresses.usd3, {
    gasLimit: 10000000
  });
  
  await amm3.deployed()
  console.log(`\nAMM3 (DEX 3) deployed to: ${amm3.address}`)
  console.log(`Using tokens:`)
  console.log(`- KEL3: ${addresses.kelchain3}`)
  console.log(`- USD3: ${addresses.usd3}`)

  // Save AMM3 address
  const amm3Addresses = {
    ...addresses,
    amm3: amm3.address
  };
  
  fs.writeFileSync('amm3-addresses.json', JSON.stringify(amm3Addresses, null, 2));
  console.log('\n📁 AMM3 addresses saved to amm3-addresses.json');
  console.log('🎯 AMM3 deployment complete!\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
