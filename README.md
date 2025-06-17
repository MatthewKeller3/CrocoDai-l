# 🎯 DEX Aggregator - Best Price Finder

A decentralized exchange aggregator that finds the best prices across multiple AMM pools, similar to 1inch exchange.

## 🚀 Features

- **Multi-DEX Price Comparison**: Compares prices across 2 independent AMM pools
- **Automatic Best Route Finding**: Smart contract automatically routes to the DEX with the better price
- **Real-time Price Updates**: Live price comparison display
- **Multiple Interfaces**: 3 separate DApps (DEX 1, DEX 2, and Aggregator)
- **Modern React UI**: Beautiful, responsive interface with Bootstrap

## 📁 Project Structure

```
algogator/
├── contracts/
│   ├── AMM.sol              # Automated Market Maker contract
│   ├── DexAggregator.sol    # Main aggregator contract
│   ├── Token.sol            # ERC-20 token implementation
│   └── interfaces/
│       └── IAMM.sol         # AMM interface
├── src/
│   ├── components/
│   │   ├── Swap.js          # DEX 1 interface
│   │   ├── Aggregator.js    # DEX Aggregator interface
│   │   └── ...              # Other components
│   └── abis/                # Contract ABIs
└── scripts/
    ├── deploy_all.js        # One-click deployment
    ├── deploy_amm1.js       # Deploy DEX 1
    ├── deploy_amm2.js       # Deploy DEX 2
    └── deploy_aggregator.js # Deploy aggregator
```

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Blockchain
```bash
npx hardhat node
```

### 3. Deploy All Contracts (One Command)
```bash
npx hardhat run scripts/deploy_all.js --network localhost
```

### 4. Start React Frontend
```bash
npm start
```

### 5. Add Liquidity to Both DEXes
- Go to **Deposit** tab and add liquidity to DEX 1
- Deploy some liquidity with different ratios to create price differences

## 📋 Manual Deployment (Step by Step)

If you prefer to deploy contracts individually:

```bash
# Deploy DEX 1 (AMM1 + Tokens)
npx hardhat run scripts/deploy_amm1.js --network localhost

# Deploy DEX 2 (AMM2 using same tokens)
npx hardhat run scripts/deploy_amm2.js --network localhost

# Deploy DEX Aggregator
npx hardhat run scripts/deploy_aggregator.js --network localhost
```

## 🎯 How It Works

1. **Two Independent AMM Pools**: Each DEX operates independently with its own liquidity
2. **Price Comparison**: Aggregator queries both DEXes for the best rate
3. **Smart Routing**: Automatically executes trade on the DEX with better price
4. **Gas Optimization**: Single transaction handles approval, routing, and execution

## 🌐 Available Interfaces

- **`/`** - DEX 1 (Traditional AMM swap interface)
- **`/aggregator`** - 🎯 DEX Aggregator (Best price finder)
- **`/deposit`** - Add liquidity to pools
- **`/withdraw`** - Remove liquidity from pools
- **`/charts`** - Trading charts and analytics

## 🔧 Configuration

Update `src/config.json` with your deployed contract addresses:

```json
{
  "31337": {
    "tokens": {
      "dapp": { "address": "0x..." },
      "usd": { "address": "0x..." }
    },
    "amms": {
      "amm1": { "address": "0x...", "name": "DEX 1" },
      "amm2": { "address": "0x...", "name": "DEX 2" }
    },
    "aggregator": {
      "address": "0x...",
      "name": "DEX Aggregator"
    }
  }
}
```

## 🧪 Testing the Aggregator

1. **Add different liquidity ratios** to AMM1 and AMM2 to create price differences
2. **Use the Aggregator interface** to see real-time price comparison
3. **Observe automatic routing** to the best price DEX
4. **Check transaction events** to verify which DEX was used

## 🚀 Advanced Features

- **Multi-hop routing** (future enhancement)
- **Slippage protection** 
- **MEV protection**
- **Gas optimization**
- **Multiple token pair support**

## 📝 Smart Contract Events

The aggregator emits helpful events:
- `BestRouteFound`: Shows which DEX offers the best rate
- `SwapExecuted`: Records the completed swap with DEX used

## 🎨 Frontend Features

- **Real-time price comparison**
- **Visual best route indicator**
- **Responsive design**
- **MetaMask integration**
- **Transaction history**

---

Built with ❤️ using Hardhat, React, and Solidity
