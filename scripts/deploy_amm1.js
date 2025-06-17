// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  const Token = await hre.ethers.getContractFactory('Token')

  // Deploy Token 1 - DAPP
  let dapp = await Token.deploy('Dapp Token', 'DAPP', '1000000') // 1 million tokens
  await dapp.deployed()
  console.log(`DAPP Token deployed to: ${dapp.address}`)

  // Deploy Token 2 - USD
  const usd = await Token.deploy('USD Token', 'USD', '1000000') // 1 million tokens
  await usd.deployed()
  console.log(`USD Token deployed to: ${usd.address}`)

  // Deploy AMM1 (DEX 1)
  const AMM = await hre.ethers.getContractFactory('AMM')
  const amm1 = await AMM.deploy(dapp.address, usd.address)
  await amm1.deployed()
  console.log(`AMM1 (DEX 1) deployed to: ${amm1.address}`)

  // Save addresses to file for reference
  const fs = require('fs');
  const addresses = {
    dapp: dapp.address,
    usd: usd.address,
    amm1: amm1.address
  };
  
  fs.writeFileSync('amm1-addresses.json', JSON.stringify(addresses, null, 2));
  console.log('\n📁 AMM1 addresses saved to amm1-addresses.json');
  console.log('🎯 AMM1 deployment complete!\n');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
