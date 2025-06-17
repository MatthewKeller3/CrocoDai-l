# 🚀 DEX Aggregator Deployment Guide

Complete step-by-step guide to deploy and test your DEX Aggregator.

## 📋 Prerequisites

1. **Node.js & npm** installed
2. **MetaMask** wallet extension
3. **Git** for cloning (if needed)

## 🛠️ Setup Instructions

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Local Hardhat Network
```bash
# Terminal 1 - Keep this running
npx hardhat node
```

This will start a local blockchain on `http://127.0.0.1:8545` and give you 10 test accounts with ETH.

### Step 3: Configure MetaMask

1. **Add Local Network to MetaMask:**
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`

2. **Import Test Account:**
   - Copy any private key from the Hardhat node output
   - Import it into MetaMask

### Step 4: Deploy All Contracts (One Command)

```bash
# Terminal 2
npx hardhat run scripts/deploy_all.js --network localhost
```

This will:
- ✅ Deploy DAPP and USD tokens
- ✅ Deploy AMM1 (DEX 1)
- ✅ Deploy AMM2 (DEX 2) 
- ✅ Deploy DexAggregator
- ✅ Save all addresses to `src/config.json`

**Expected Output:**
```
🚀 Deploying DEX Aggregator System...

📍 Deploying Tokens...
✅ DAPP Token deployed to: 0x123...
✅ USD Token deployed to: 0x456...

📍 Deploying AMM1...
✅ AMM1 deployed to: 0x789...

📍 Deploying AMM2...
✅ AMM2 deployed to: 0xabc...

📍 Deploying DexAggregator...
✅ DexAggregator deployed to: 0xdef...

💾 Addresses saved to src/config.json
🎉 Deployment complete!
```

### Step 5: Start React Frontend

```bash
# Terminal 3
npm start
```

React app will open at `http://localhost:3000`

## 🧪 Testing the DEX Aggregator

### Phase 1: Initial Setup

1. **Check MetaMask Connection**
   - Ensure you're connected to Hardhat Local network
   - Should show test account with ~10,000 ETH

2. **Get Tokens**
   - You'll automatically have DAPP and USD tokens
   - Check balances in the UI

### Phase 2: Add Liquidity to Both DEXes

**⚠️ IMPORTANT: Add different liquidity ratios to create price differences!**

1. **Add Liquidity to DEX 1:**
   - Go to **Deposit** tab
   - Add: `1000 DAPP + 2000 USD` (1:2 ratio)
   - Click "Deposit"

2. **Add Liquidity to DEX 2:**
   - Switch to AMM2 contract (modify config temporarily)
   - Add: `1000 DAPP + 1500 USD` (1:1.5 ratio)
   - Click "Deposit"

### Phase 3: Test Price Comparison

1. **Go to 🎯 DEX Aggregator tab**

2. **Test Swap Estimation:**
   - Input: `100 DAPP`
   - Output should show: `USD`
   - You should see:
     ```
     DEX 1 Rate: ~190 USD (worse)
     DEX 2 Rate: ~142 USD (better)
     Best DEX: DEX 2 ⭐
     ```

3. **Execute Aggregator Swap:**
   - Click "Swap"
   - MetaMask will prompt for approval
   - Transaction should route through DEX 2 (better price)

### Phase 4: Compare with Individual DEXes

1. **Test DEX 1 (Traditional Interface):**
   - Go to **Swap** tab (root `/`)
   - Same input: `100 DAPP`
   - Should show worse rate than aggregator

2. **Test Manual Comparison:**
   - Compare rates manually
   - Aggregator should always get the better price

## 🎯 Expected Results

### Price Differences You Should See:
- **DEX 1 (1:2 ratio)**: 100 DAPP → ~190 USD
- **DEX 2 (1:1.5 ratio)**: 100 DAPP → ~142 USD  
- **Aggregator**: Automatically uses DEX 2 (better rate)

### UI Indicators:
- ⭐ "Best DEX" indicator
- Real-time price comparison
- Rate difference percentage
- Transaction routing confirmation

## 🐛 Troubleshooting

### Common Issues:

1. **"Contract not deployed" error:**
   ```bash
   # Re-run deployment
   npx hardhat run scripts/deploy_all.js --network localhost
   ```

2. **MetaMask connection issues:**
   - Reset MetaMask account (Settings → Advanced → Reset Account)
   - Re-import test account

3. **No price difference:**
   - Add different liquidity ratios to AMM1 and AMM2
   - Ensure liquidity amounts create price disparity

4. **Aggregator component doesn't load:**
   - Check `src/config.json` has all addresses
   - Verify React development server is running

### Manual Deployment (If needed):

```bash
# Deploy step by step
npx hardhat run scripts/deploy_amm1.js --network localhost
npx hardhat run scripts/deploy_amm2.js --network localhost  
npx hardhat run scripts/deploy_aggregator.js --network localhost
```

## 📊 Success Metrics

✅ **Deployment Success:**
- All 5 contracts deployed without errors
- Addresses saved to config.json
- Frontend loads without errors

✅ **Functionality Success:**
- Price comparison shows different rates
- Aggregator routes to best DEX
- MetaMask transactions work smoothly
- UI updates balances correctly

✅ **Integration Success:**
- All 3 interfaces work (DEX 1, DEX 2, Aggregator)
- Price arbitrage opportunities visible
- Gas optimization compared to manual routing

## 🎉 Congratulations!

You now have a fully functional DEX Aggregator similar to 1inch! 

### Next Steps:
- Experiment with different liquidity ratios
- Add more token pairs
- Implement advanced features (slippage protection, multi-hop routing)
- Deploy to testnet networks

---

**Need Help?** Check the console logs in both browser DevTools and terminal for detailed error messages.
