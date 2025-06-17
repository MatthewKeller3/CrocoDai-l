const hre = require("hardhat");

async function main() {
  const fs = require('fs');
  
  // Read AMM addresses
  let amm1Addresses, amm2Addresses;
  
  try {
    amm1Addresses = JSON.parse(fs.readFileSync('amm1-addresses.json', 'utf8'));
    console.log(' Found AMM1 addresses');
  } catch (error) {
    console.error(' AMM1 addresses not found! Please deploy AMM1 first.');
    process.exit(1);
  }
  
  try {
    amm2Addresses = JSON.parse(fs.readFileSync('amm2-addresses.json', 'utf8'));
    console.log(' Found AMM2 addresses');
  } catch (error) {
    console.error(' AMM2 addresses not found! Please deploy AMM2 first.');
    process.exit(1);
  }

  console.log('\n Deploying DEX Aggregator...\n');

  // Deploy DexAggregator
  const DexAggregator = await hre.ethers.getContractFactory('DexAggregator')
  const aggregator = await DexAggregator.deploy(
    amm1Addresses.amm1,
    amm2Addresses.amm2,
    amm1Addresses.dapp,
    amm1Addresses.usd
  )
  await aggregator.deployed()
  console.log(` DEX Aggregator deployed to: ${aggregator.address}`)

  // Create complete addresses file
  const completeAddresses = {
    tokens: {
      dapp: amm1Addresses.dapp,
      usd: amm1Addresses.usd
    },
    amms: {
      amm1: amm1Addresses.amm1,
      amm2: amm2Addresses.amm2
    },
    aggregator: aggregator.address
  };
  
  fs.writeFileSync('complete-deployment.json', JSON.stringify(completeAddresses, null, 2));
  console.log('\n Complete deployment saved to complete-deployment.json');
  console.log('\n DEX Aggregator deployment complete!');
  console.log('\n Summary:');
  console.log(`    DAPP Token: ${amm1Addresses.dapp}`);
  console.log(`    USD Token: ${amm1Addresses.usd}`);
  console.log(`    AMM1 (DEX 1): ${amm1Addresses.amm1}`);
  console.log(`    AMM2 (DEX 2): ${amm2Addresses.amm2}`);
  console.log(`    Aggregator: ${aggregator.address}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});