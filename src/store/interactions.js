import { ethers } from 'ethers'

import {
  setProvider,
  setNetwork,
  setAccount
} from './reducers/provider'

import {
  setContracts,
  setSymbols,
  balancesLoaded
} from './reducers/tokens'

import {
  setContract,
  sharesLoaded,
  swapsLoaded,
  depositRequest,
  depositSuccess,
  depositFail,
  withdrawRequest,
  withdrawSuccess,
  withdrawFail,
  swapRequest,
  swapSuccess,
  swapFail
} from './reducers/amm'

import TOKEN_ABI_RAW from '../abis/Token.json'
import AMM_ABI_RAW from '../abis/AMM.json'
import AGGREGATOR_ABI_RAW from '../abis/DexAggregator.json'
import config from '../config.json'

// Process ABIs to handle both raw and truffle-style ABIs
const getABI = (abi) => {
  if (!abi) return []
  if (Array.isArray(abi)) return abi
  if (abi.abi) return abi.abi
  return abi
}

const TOKEN_ABI = getABI(TOKEN_ABI_RAW)
const AMM_ABI = getABI(AMM_ABI_RAW)
const AGGREGATOR_ABI = getABI(AGGREGATOR_ABI_RAW)

// Log ABIs for debugging
console.log('Token ABI:', TOKEN_ABI.length, 'items')
console.log('AMM ABI:', AMM_ABI.length, 'items')
console.log('Aggregator ABI:', AGGREGATOR_ABI.length, 'items')

// Helper function to ensure addresses are checksummed
const getChecksumAddress = (address) => {
  try {
    return ethers.utils.getAddress(address)
  } catch (error) {
    console.error('Invalid address:', address, error)
    throw new Error(`Invalid address format: ${address}`)
  }
}

export const loadProvider = (dispatch) => {
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  dispatch(setProvider(provider))

  return provider
}

export const loadNetwork = async (provider, dispatch) => {
  const { chainId } = await provider.getNetwork()
  dispatch(setNetwork(chainId))

  return chainId
}

export const loadAccount = async (dispatch) => {
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
  const account = ethers.utils.getAddress(accounts[0])
  dispatch(setAccount(account))

  return account
}

// ------------------------------------------------------------------------------
// LOAD CONTRACTS
export const loadTokens = async (provider, chainId, dispatch) => {
  try {
    const tokens = config[chainId].tokens;
    
    // Load main tokens (KEL and USD)
    const kelchainAddress = getChecksumAddress(tokens.kelchain.address);
    const usdAddress = getChecksumAddress(tokens.usd.address);
    
    const kelchain = new ethers.Contract(kelchainAddress, TOKEN_ABI, provider);
    const usd = new ethers.Contract(usdAddress, TOKEN_ABI, provider);

    // Load AMM3 tokens if they exist
    let kel3, usd3;
    if (tokens.kelchain3 && tokens.usd3) {
      const kel3Address = getChecksumAddress(tokens.kelchain3.address);
      const usd3Address = getChecksumAddress(tokens.usd3.address);
      
      kel3 = new ethers.Contract(kel3Address, TOKEN_ABI, provider);
      usd3 = new ethers.Contract(usd3Address, TOKEN_ABI, provider);
    }

    // Get all token symbols
    const tokenSymbols = [
      await kelchain.symbol(),
      await usd.symbol(),
      ...(kel3 && usd3 ? [await kel3.symbol(), await usd3.symbol()] : [])
    ];

    // Get all token contracts
    const tokenContracts = [kelchain, usd];
    if (kel3 && usd3) {
      tokenContracts.push(kel3, usd3);
    }

    dispatch(setContracts(tokenContracts));
    dispatch(setSymbols(tokenSymbols));
    
    return { 
      kelchain, 
      usd,
      ...(kel3 && usd3 ? { kel3, usd3 } : {})
    };
  } catch (error) {
    console.error('Error loading tokens:', error);
    throw error;
  }
}

export const loadAMM = async (provider, chainId, dispatch) => {
  try {
    const chainConfig = config[chainId]
    if (!chainConfig) {
      console.error('No config found for chainId:', chainId)
      return null
    }

    const { amms, aggregator: aggregatorConfig } = chainConfig
    
    if (!amms?.amm1?.address) {
      console.error('AMM1 address not found in config for chainId:', chainId)
      return null
    }

    // Ensure addresses are checksummed
    const amm1Address = getChecksumAddress(amms.amm1.address)
    const amm2Address = amms.amm2?.address ? getChecksumAddress(amms.amm2.address) : null
    const amm3Address = amms.amm3?.address ? getChecksumAddress(amms.amm3.address) : null
    const aggregatorAddress = aggregatorConfig?.address ? getChecksumAddress(aggregatorConfig.address) : null

    console.log('Loading AMM contracts with addresses:', { 
      amm1: amm1Address, 
      amm2: amm2Address, 
      amm3: amm3Address,
      aggregator: aggregatorAddress
    })

    // Debug ABI
    console.log('AMM ABI functions:', 
      AMM_ABI
        .filter(item => item.type === 'function')
        .map(fn => ({
          name: fn.name,
          inputs: fn.inputs?.map(i => i.type).join(','),
          outputs: fn.outputs?.map(o => o.type).join(',')
        }))
    )
    
    // Create contract instances with signer for write operations
    const signer = provider.getSigner()
    
    // Create contract instances
    const amm1Contract = new ethers.Contract(amm1Address, AMM_ABI, signer)
    const amm2Contract = amm2Address ? new ethers.Contract(amm2Address, AMM_ABI, signer) : null
    const amm3Contract = amm3Address ? new ethers.Contract(amm3Address, AMM_ABI, signer) : null
    
    // Log available methods
    console.log('AMM1 methods:', Object.keys(amm1Contract.functions))
    if (amm2Contract) console.log('AMM2 methods:', Object.keys(amm2Contract.functions))
    if (amm3Contract) console.log('AMM3 methods:', Object.keys(amm3Contract.functions))

    // Also load aggregator if exists
    let aggregatorContract = null
    if (aggregatorAddress) {
      console.log('Loading aggregator contract...')
      aggregatorContract = new ethers.Contract(aggregatorAddress, AGGREGATOR_ABI, signer)
      console.log('Aggregator methods:', Object.keys(aggregatorContract.functions))
    }

    // Create contract objects with token info
    const amm1Obj = { 
      address: amm1Address, 
      contract: amm1Contract,
      token1: 'kelchain',
      token2: 'usd',
      name: amms.amm1.name || 'DEX 1'
    }
    
    const amm2Obj = amm2Address ? { 
      address: amm2Address, 
      contract: amm2Contract,
      token1: 'kelchain',
      token2: 'usd',
      name: amms.amm2?.name || 'DEX 2'
    } : null
    
    const amm3Obj = amm3Address ? { 
      address: amm3Address, 
      contract: amm3Contract,
      token1: amms.amm3?.token1 || 'kelchain3',
      token2: amms.amm3?.token2 || 'usd3',
      name: amms.amm3?.name || 'DEX 3'
    } : null
    
    const aggregatorObj = aggregatorAddress ? { 
      address: aggregatorAddress, 
      contract: aggregatorContract 
    } : null

    // Dispatch to Redux store
    const contracts = {
      amm1: amm1Obj,
      ...(amm2Obj && { amm2: amm2Obj }),
      ...(amm3Obj && { amm3: amm3Obj }),
      ...(aggregatorObj && { aggregator: aggregatorObj })
    }
    
    console.log('Dispatching contracts:', Object.keys(contracts))
    dispatch(setContract(contracts))
    
    console.log('AMM contracts loaded successfully')
    return {
      amm1: amm1Obj,
      amm2: amm2Obj,
      amm3: amm3Obj,
      aggregator: aggregatorObj
    }
  } catch (error) {
    console.error('Error loading AMM contracts:', error)
    throw error
  }
}


// ------------------------------------------------------------------------------
// LOAD BALANCES & SHARES
export const loadBalances = async (amm, tokens, account, dispatch) => {
  // Early return with debug info if we're missing required parameters
  const missingParams = [];
  if (!amm) missingParams.push('amm');
  if (!tokens || !Array.isArray(tokens)) missingParams.push('tokens array');
  if (!tokens?.[0]) missingParams.push('token1');
  if (!tokens?.[1]) missingParams.push('token2');
  if (!account) missingParams.push('account');
  
  if (missingParams.length > 0) {
    console.warn(`loadBalances: Missing required parameters: ${missingParams.join(', ')}`);
    // Still dispatch with zeros to prevent UI from showing stale data
    dispatch(balancesLoaded(['0', '0']));
    dispatch(sharesLoaded('0'));
    return;
  }

  try {
    console.log('Loading token balances for account:', account);
    console.log('Token 1 address:', tokens[0].address);
    console.log('Token 2 address:', tokens[1].address);
    
    // Format balance helper function
    const formatBalance = (balance) => {
      try {
        if (!balance) return '0.0000';
        const formatted = parseFloat(ethers.utils.formatUnits(balance, 18));
        return isNaN(formatted) ? '0.0000' : formatted.toFixed(4);
      } catch (error) {
        console.error('Error formatting balance:', error);
        return '0.0000';
      }
    };
    
    // Load token balances
    let balance1, balance2;
    
    try {
      balance1 = await tokens[0].balanceOf(account);
      console.log('Token 1 balance raw:', balance1.toString());
    } catch (error) {
      console.error('Error loading token 1 balance:', error);
      balance1 = ethers.BigNumber.from(0);
    }
    
    try {
      balance2 = await tokens[1].balanceOf(account);
      console.log('Token 2 balance raw:', balance2.toString());
    } catch (error) {
      console.error('Error loading token 2 balance:', error);
      balance2 = ethers.BigNumber.from(0);
    }
    
    // Format and dispatch balances
    const formattedBalances = [
      formatBalance(balance1),
      formatBalance(balance2)
    ];
    
    console.log('Formatted balances:', formattedBalances);
    dispatch(balancesLoaded(formattedBalances));

    // Try to get shares from the contract if AMM is available
    if (amm?.contract) {
      try {
        console.log('Loading shares for account:', account, 'from AMM:', amm.address);
        // First try the shares function
        const shares = await amm.contract.shares(account);
        const sharesStr = shares?.toString() || '0';
        console.log('LP Shares:', sharesStr);
        dispatch(sharesLoaded(parseFloat(ethers.utils.formatUnits(sharesStr, 'ether')).toFixed(4)));
      } catch (error) {
        console.error('Could not load shares using shares():', error);
        // If shares() fails, try balanceOf as a fallback
        try {
          const shares = await amm.contract.balanceOf(account);
          const sharesStr = shares?.toString() || '0';
          console.log('LP Shares (using balanceOf()):', sharesStr);
          dispatch(sharesLoaded(parseFloat(ethers.utils.formatUnits(sharesStr, 'ether')).toFixed(4)));
        } catch (err) {
          console.error('Could not load shares using balanceOf() either:', err);
          dispatch(sharesLoaded('0'));
        }
      }
    } else {
      console.warn('AMM contract not available for loading shares', { amm });
      dispatch(sharesLoaded('0'));
    }
    
  } catch (error) {
    console.error('Error in loadBalances:', error);
    dispatch(balancesLoaded(['0', '0']));
    dispatch(sharesLoaded('0'));
  }
}


// ------------------------------------------------------------------------------
// ADD LIQUDITY
export const addLiquidity = async (provider, amm, tokens, amounts, dispatch) => {
  try {
    dispatch(depositRequest())

    const signer = await provider.getSigner()

    let transaction

    transaction = await tokens[0].connect(signer).approve(amm.amm1.address, amounts[0])
    await transaction.wait()

    transaction = await tokens[1].connect(signer).approve(amm.amm1.address, amounts[1])
    await transaction.wait()

    transaction = await amm.amm1.connect(signer).addLiquidity(amounts[0], amounts[1])
    await transaction.wait()

    dispatch(depositSuccess(transaction.hash))
  } catch (error) {
    dispatch(depositFail())
  }
}

// ------------------------------------------------------------------------------
// REMOVE LIQUIDITY
export const removeLiquidity = async (provider, amm, shares, dispatch) => {
  try {
    if (!provider || !amm?.amm1?.contract || !shares) {
      console.error('Missing required parameters for removeLiquidity:', { 
        hasProvider: !!provider,
        hasAmm: !!amm,
        hasAmm1: !!amm?.amm1,
        hasAmm1Contract: !!amm?.amm1?.contract,
        hasShares: !!shares
      });
      dispatch(withdrawFail())
      return;
    }

    dispatch(withdrawRequest())
    console.log('Initiating withdrawal of', shares.toString(), 'shares')

    const signer = await provider.getSigner()
    const ammContract = amm.amm1.contract.connect(signer)

    // First, check the expected return amounts
    const [token1Amount, token2Amount] = await ammContract.calculateWithdrawAmount(shares)
    console.log('Expected to receive:', {
      token1: ethers.utils.formatUnits(token1Amount, 'ether'),
      token2: ethers.utils.formatUnits(token2Amount, 'ether')
    })

    // Execute the withdrawal
    console.log('Sending removeLiquidity transaction...')
    const transaction = await ammContract.removeLiquidity(shares)
    console.log('Transaction sent:', transaction.hash)
    
    const receipt = await transaction.wait()
    console.log('Transaction confirmed in block:', receipt.blockNumber)
    
    dispatch(withdrawSuccess(transaction.hash))
    return receipt
  } catch (error) {
    console.error('Error in removeLiquidity:', error)
    dispatch(withdrawFail())
    throw error
  }
}

// ------------------------------------------------------------------------------
// SWAP

export const swap = async (provider, amm, token, symbol, amount, dispatch) => {
  try {
    dispatch(swapRequest())
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()

    // Debug log
    console.log('Swap params:', {
      tokenAddress: token?.address,
      symbol,
      amount: amount.toString(),
      amm1Address: amm?.amm1?.address,
      amm: Object.keys(amm || {})
    })

    // Get the AMM contract instance
    const ammContract = amm?.amm1?.contract
    if (!ammContract?.address) {
      throw new Error('AMM contract not properly initialized')
    }

    if (!token?.address) {
      throw new Error('Token contract not properly initialized')
    }

    // Check current allowance and handle approval if needed
    console.log('=== TOKEN APPROVAL PROCESS START ===')
    console.log('Token:', token.address)
    console.log('Owner:', signerAddress)
    console.log('Spender (AMM):', ammContract.address)
    console.log('Amount to swap:', amount.toString())

    // Get current balance first
    const balance = await token.balanceOf(signerAddress)
    console.log('Current balance:', balance.toString())
    
    // Check if balance is sufficient
    if (balance.lt(amount)) {
      const formattedBalance = ethers.utils.formatUnits(balance, 18)
      const formattedAmount = ethers.utils.formatUnits(amount, 18)
      throw new Error(`Insufficient ${symbol} balance. You need ${formattedAmount} but only have ${formattedBalance}`)
    }

    // Get current allowance
    const currentAllowance = await token.allowance(signerAddress, ammContract.address)
    console.log('Current allowance:', currentAllowance.toString())
    
    // If we have enough allowance, skip approval
    if (currentAllowance.gte(amount)) {
      console.log('✅ Sufficient allowance already set')
      console.log('=== TOKEN APPROVAL PROCESS END ===')
      return true
    }
    
    console.log('Insufficient allowance. Starting approval process...')
    
    // Reset approval to 0 first
    console.log('1. Resetting approval to 0...')
    const resetTx = await token.connect(signer).approve(
      ammContract.address, 
      ethers.constants.Zero,
      { gasLimit: 300000 }
    )
    console.log('   Reset tx hash:', resetTx.hash)
    await resetTx.wait()
    
    // Set new approval to max
    console.log('2. Setting new approval to max...')
    const approveTx = await token.connect(signer).approve(
      ammContract.address, 
      ethers.constants.MaxUint256,
      { gasLimit: 300000 }
    )
    console.log('   Approve tx hash:', approveTx.hash)
    await approveTx.wait()
    
    // Verify new allowance
    const newAllowance = await token.allowance(signerAddress, ammContract.address)
    console.log('   New allowance:', newAllowance.toString())
    
    if (newAllowance.lt(amount)) {
      throw new Error('Failed to set sufficient allowance for swap')
    }
    
    console.log('✅ Approval process completed successfully')
    console.log('=== TOKEN APPROVAL PROCESS END ===')
    
    // Execute the swap with the updated allowance
    console.log('Executing swap with sufficient allowance...')
    try {
      let transaction
      const gasOptions = { 
        gasLimit: 500000,
        gasPrice: ethers.utils.parseUnits('10', 'gwei') // Add explicit gas price
      }
      
      console.log('Swap parameters:', {
        signer: signerAddress,
        token: token.address,
        amount: amount.toString(),
        amm: ammContract.address,
        gasOptions
      })

      // Estimate gas first
      let estimatedGas
      try {
        if (symbol === "KelChain") {
          estimatedGas = await ammContract.estimateGas.swapToken1(amount, gasOptions)
          console.log('Estimated gas for swapToken1:', estimatedGas.toString())
        } else {
          estimatedGas = await ammContract.estimateGas.swapToken2(amount, gasOptions)
          console.log('Estimated gas for swapToken2:', estimatedGas.toString())
        }
        // Add 20% buffer to estimated gas
        gasOptions.gasLimit = estimatedGas.mul(120).div(100)
        console.log('Gas limit with buffer:', gasOptions.gasLimit.toString())
      } catch (estimationError) {
        console.error('Gas estimation failed:', estimationError)
        throw new Error(`Gas estimation failed: ${estimationError.message}`)
      }

      // Execute the swap with better error handling
      try {
        if (symbol === "KelChain") {
          console.log('Swapping KelChain (token1)')
          transaction = await ammContract.connect(signer).swapToken1(amount, gasOptions)
        } else {
          console.log('Swapping USD (token2)')
          transaction = await ammContract.connect(signer).swapToken2(amount, gasOptions)
        }
        
        console.log('Swap transaction sent:', transaction.hash)
        const receipt = await transaction.wait()
        console.log('Swap confirmed in block:', receipt.blockNumber)
        console.log('Gas used:', receipt.gasUsed.toString())
        
        dispatch(swapSuccess(transaction.hash))
        return true
      } catch (swapError) {
        console.error('Swap execution failed:', {
          error: swapError,
          code: swapError.code,
          message: swapError.message,
          data: swapError.data,
          reason: swapError.reason
        })
        throw swapError
      }
    } catch (error) {
      console.error('Swap error:', error)
      if (error.data) {
        const reason = error.data.message?.replace('execution reverted: ', '') || 'Unknown reason'
        console.error('Error reason:', reason)
        dispatch(swapFail(reason))
      } else {
        dispatch(swapFail(error.message || 'Unknown error'))
      }
      return false
    }
  } catch (error) {
    console.error('[swap] Swap failed with error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      data: error.data,
      reason: error.reason,
      stack: error.stack
    });
    
    // Format a user-friendly error message
    let errorMessage = 'Transaction failed';
    if (error.reason) {
      errorMessage += `: ${error.reason}`;
    } else if (error.data?.message) {
      errorMessage += `: ${error.data.message}`;
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    dispatch(swapFail(errorMessage));
    throw new Error(errorMessage);
  }
}

// ------------------------------------------------------------------------------
// LOAD ALL SWAPS

export const loadAllSwaps = async (provider, amm, dispatch) => {
  try {
    const block = await provider.getBlockNumber()
    console.log('Loading swaps up to block:', block)

    // Fetch swaps from both AMMs in parallel
    const [amm1Swaps, amm2Swaps] = await Promise.all([
      amm.amm1?.contract?.queryFilter('Swap', 0, block).catch(e => {
        console.error('Error fetching swaps from AMM1:', e)
        return []
      }) || [],
      
      amm.amm2?.contract?.queryFilter('Swap', 0, block).catch(e => {
        console.error('Error fetching swaps from AMM2:', e)
        return []
      }) || []
    ])

    console.log('Fetched swaps:', {
      amm1Count: amm1Swaps.length,
      amm2Count: amm2Swaps.length
    })

    // Combine and sort all swaps by block number
    const allSwaps = [...amm1Swaps, ...amm2Swaps]
      .sort((a, b) => a.blockNumber - b.blockNumber)
      .map(event => ({
        ...event,
        ammAddress: event.address,
        hash: event.transactionHash,
        args: event.args || {}
      }))

    console.log('Dispatching', allSwaps.length, 'swaps to store')
    dispatch(swapsLoaded(allSwaps))
    return allSwaps
  } catch (error) {
    console.error('Error in loadAllSwaps:', error)
    dispatch(swapsLoaded([]))
    return []
  }
}

// Log detailed AMM state for debugging
// eslint-disable-next-line no-unused-vars
const logAMMState = async (amm, name = 'AMM') => {
  try {
    if (!amm?.contract) {
      console.log(`[logAMMState] ${name}: Contract not available`);
      return;
    }
    
    console.log(`[logAMMState] Checking ${name} contract at ${amm.address}`);
    
    // Get contract state using view functions
    const [
      token1Addr,
      token2Addr,
      token1Balance,
      token2Balance,
      k,
      totalShares,
      // hasToken1BalanceFn,
      // hasToken2BalanceFn,
      // hasKFn,
      // hasTotalSharesFn,
      hasGetToken1EstimatedReturnFn,
      hasGetToken2EstimatedReturnFn,
      hasSwapToken1Fn,
      hasSwapToken2Fn
    ] = await Promise.all([
      amm.contract.token1().catch(() => 'error'),
      amm.contract.token2().catch(() => 'error'),
      amm.contract.token1Balance ? amm.contract.token1Balance().catch(() => 'error') : Promise.resolve('function not available'),
      amm.contract.token2Balance ? amm.contract.token2Balance().catch(() => 'error') : Promise.resolve('function not available'),
      amm.contract.K ? amm.contract.K().catch(() => 'error') : Promise.resolve('function not available'),
      amm.contract.totalShares ? amm.contract.totalShares().catch(() => 'error') : Promise.resolve('function not available'),
      Promise.resolve(!!amm.contract.token1Balance),
      Promise.resolve(!!amm.contract.token2Balance),
      Promise.resolve(!!amm.contract.K),
      Promise.resolve(!!amm.contract.totalShares),
      Promise.resolve(!!amm.contract.getToken1EstimatedReturn),
      Promise.resolve(!!amm.contract.getToken2EstimatedReturn),
      Promise.resolve(!!amm.contract.swapToken1),
      Promise.resolve(!!amm.contract.swapToken2)
    ]);
    
    // Log basic contract info
    console.log(`[logAMMState] ${name} State:`, {
      address: amm.address,
      token1: token1Addr,
      token2: token2Addr,
      token1Balance: token1Balance?.toString() || 'error',
      token2Balance: token2Balance?.toString() || 'error',
      k: k?.toString() || 'error',
      totalShares: totalShares?.toString() || 'error',
      hasRequiredFunctions: {
        getToken1EstimatedReturn: hasGetToken1EstimatedReturnFn,
        getToken2EstimatedReturn: hasGetToken2EstimatedReturnFn,
        swapToken1: hasSwapToken1Fn,
        swapToken2: hasSwapToken2Fn
      }
    });
    
    // Log available methods for debugging
    const availableMethods = Object.entries(amm.contract)
      .filter(([_, value]) => typeof value === 'function')
      .map(([key]) => key);
    console.log(`[logAMMState] ${name} Available Methods:`, availableMethods);
    
    // Log ABI function signatures
    if (AMM_ABI) {
      const functionSignatures = AMM_ABI
        .filter(item => item.type === 'function')
        .map(fn => ({
          name: fn.name,
          inputs: fn.inputs?.map(i => i.type).join(',') || 'none',
          outputs: fn.outputs?.map(o => o.type).join(',') || 'none'
        }));
      console.log(`[logAMMState] ${name} ABI Functions:`, functionSignatures);
    } else {
      console.warn('[logAMMState] AMM_ABI not available');
    }
  } catch (error) {
    console.error(`Error getting ${name} state:`, error)
  }
}

// AGGREGATOR FUNCTIONS

export const compareAMMRates = async (amm1, amm2, amm3, inputToken, amount) => {
  try {
    console.log('Comparing AMM rates for', amount, inputToken);
    
    // Log AMM contract addresses for debugging
    console.log('AMM1:', amm1?.address);
    console.log('AMM2:', amm2?.address);
    console.log('AMM3:', amm3?.address);

    // Log contract methods for debugging
    if (amm1) {
      console.log('AMM1 methods:', Object.keys(amm1));
    } else {
      console.log('AMM1: Contract not available');
    }

    if (amm2) {
      console.log('AMM2 methods:', Object.keys(amm2));
    } else {
      console.log('AMM2: Contract not available');
    }

    if (amm3) {
      console.log('AMM3 methods:', Object.keys(amm3));
    } else {
      console.log('AMM3: Contract not available');
    }

    console.log('compareAMMRates - Input:', { inputToken, amount });

    // Get rates from all AMMs using the correct function names
    const rates = await Promise.all([
      // AMM1
      (async () => {
        try {
          if (!amm1) return ethers.BigNumber.from(0);
          
          let result;
          if (inputToken === 'KEL') {
            // Swap KEL (token1) to USD (token2)
            result = await amm1.calculateToken1Swap(amount);
            console.log('AMM1 rate (KEL->USD):', ethers.utils.formatEther(result), 'USD per KEL');
          } else {
            // Swap USD (token2) to KEL (token1)
            result = await amm1.calculateToken2Swap(amount);
            console.log('AMM1 rate (USD->KEL):', ethers.utils.formatEther(result), 'KEL per USD');
          }
          return result;
        } catch (e) {
          console.error('Error in AMM1 calculation:', e);
          return ethers.BigNumber.from(0);
        }
      })(),
      // AMM2
      (async () => {
        try {
          if (!amm2) return ethers.BigNumber.from(0);
          
          let result;
          if (inputToken === 'KEL') {
            result = await amm2.calculateToken1Swap(amount);
            console.log('AMM2 rate (KEL->USD):', ethers.utils.formatEther(result), 'USD per KEL');
          } else {
            result = await amm2.calculateToken2Swap(amount);
            console.log('AMM2 rate (USD->KEL):', ethers.utils.formatEther(result), 'KEL per USD');
          }
          return result;
        } catch (e) {
          console.error('Error in AMM2 calculation:', e);
          return ethers.BigNumber.from(0);
        }
      })(),
      // AMM3 (if available)
      (async () => {
        if (!amm3) return ethers.BigNumber.from(0);
        
        try {
          let result;
          if (inputToken === 'KEL') {
            result = await amm3.calculateToken1Swap(amount);
            console.log('AMM3 rate (KEL->USD):', ethers.utils.formatEther(result), 'USD per KEL');
          } else {
            result = await amm3.calculateToken2Swap(amount);
            console.log('AMM3 rate (USD->KEL):', ethers.utils.formatEther(result), 'KEL per USD');
          }
          return result;
        } catch (e) {
          console.error('Error in AMM3 calculation:', e);
          return ethers.BigNumber.from(0);
        }
      })()
    ])
    
    console.log('AMM Rates:', {
      amm1: ethers.utils.formatEther(rates[0]),
      amm2: ethers.utils.formatEther(rates[1]),
      amm3: amm3 ? ethers.utils.formatEther(rates[2]) : 'N/A'
    })
    
    console.log('All AMM rates:', {
      amm1: ethers.utils.formatEther(rates[0].toString()),
      amm2: ethers.utils.formatEther(rates[1].toString()),
      amm3: amm3 ? ethers.utils.formatEther(rates[2].toString()) : 'N/A'
    });

    // Find the AMM with the best rate (non-zero)
    let bestAmm = null;
    let bestRate = ethers.BigNumber.from(0);
    
    if (rates[0].gt(0)) {
      bestAmm = 'amm1';
      bestRate = rates[0];
    }
    
    if (rates[1].gt(bestRate)) {
      bestAmm = 'amm2';
      bestRate = rates[1];
    }
    
    if (amm3 && rates[2].gt(bestRate)) {
      bestAmm = 'amm3';
      bestRate = rates[2];
    }
    
    if (!bestAmm) {
      console.warn('No valid rates found from any AMM');
      bestAmm = 'amm1'; // Default to amm1 if no valid rates found
      bestRate = rates[0];
    }
    
    return {
      betterAMM: bestAmm,
      betterRate: bestRate,
      rates: {
        amm1: rates[0],
        amm2: rates[1],
        amm3: rates[2]
      }
    }
  } catch (error) {
    console.error('Error comparing AMM rates:', error)
    throw error
  }
}

export const swapViaAggregator = async (provider, aggregator, inputToken, amount, dispatch, amm3 = null) => {
  // Input validation
  if (!provider) throw new Error('Provider is required')
  if (!aggregator) throw new Error('Aggregator contract is required')
  if (!inputToken) throw new Error('Input token is required')
  if (!amount) throw new Error('Amount is required')
  if (!dispatch) throw new Error('Dispatch function is required')
  
  try {
    console.group('[swapViaAggregator] Starting swap process')
    
    dispatch(swapRequest())
    
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()
    
    console.log('Account:', signerAddress)
    console.log('Token:', inputToken)
    console.log('Amount:', ethers.utils.formatEther(amount), 'wei')
    
    // Get token contract with proper error handling
    let tokenAddress
    try {
      tokenAddress = inputToken === 'KEL' 
        ? config[31337].tokens.kelchain.address
        : config[31337].tokens.usd.address
      
      if (!tokenAddress) {
        throw new Error(`Token address not found for ${inputToken}`)
      }
    } catch (tokenError) {
      console.error('Error getting token address:', tokenError)
      throw new Error(`Invalid token: ${inputToken}`)
    }
    
    const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer)
    console.log('Token contract:', tokenContract.address)
    
    // Check token balance first
    const balance = await tokenContract.balanceOf(signerAddress)
    console.log('Current token balance:', ethers.utils.formatEther(balance), inputToken)
    
    if (balance.lt(amount)) {
      throw new Error(`Insufficient ${inputToken} balance. Required: ${ethers.utils.formatEther(amount)}, Available: ${ethers.utils.formatEther(balance)}`)
    }
    
    // Check and handle token approval
    console.log('Checking token approval...')
    const amountBN = ethers.BigNumber.from(amount)
    let allowance = await tokenContract.allowance(signerAddress, aggregator.address)
    console.log('Current allowance:', ethers.utils.formatEther(allowance), inputToken)
    
    if (allowance.lt(amountBN)) {
      console.log('Insufficient allowance, requesting approval...')
      
      try {
        // First try to reset approval to 0 if needed
        const resetTx = await tokenContract.approve(aggregator.address, 0)
        console.log('Reset approval tx sent:', resetTx.hash)
        await resetTx.wait(1)
      } catch (resetError) {
        console.warn('Could not reset approval to 0:', resetError.message)
      }
      
      // Set maximum approval
      const maxUint256 = ethers.constants.MaxUint256
      const approveTx = await tokenContract.approve(aggregator.address, maxUint256, {
        gasLimit: 200000
      })
      console.log('Approval tx sent:', approveTx.hash)
      
      const receipt = await approveTx.wait(1)
      console.log('Approval confirmed in block:', receipt.blockNumber)
      
      allowance = await tokenContract.allowance(signerAddress, aggregator.address)
      console.log('New allowance:', ethers.utils.formatEther(allowance), inputToken)
      
      if (allowance.lt(amountBN)) {
        throw new Error(`Failed to set sufficient allowance. Current: ${ethers.utils.formatEther(allowance)}, Required: ${ethers.utils.formatEther(amountBN)}`)
      }
    }
    
    // Find the best AMM rate
    console.log('Finding best AMM rate...')
    let betterAMM, bestRate, ammName
    
    try {
      const rates = await compareAMMRates(
        aggregator.amm1,
        aggregator.amm2,
        amm3?.contract || null,
        inputToken,
        amount
      )
      
      betterAMM = rates.betterAMM
      bestRate = rates.bestRate
      ammName = rates.ammName
      
      if (!betterAMM) {
        throw new Error('No suitable AMM found for the swap')
      }
      
      console.log(`Best rate found on ${ammName}:`, bestRate.toString())
    
      // Prepare the swap transaction
      console.log('Preparing swap transaction...')
      const ammContract = new ethers.Contract(betterAMM, AMM_ABI, signer)
      
      // Determine which swap function to use based on input token
      const isToken1 = inputToken === 'KEL'
      const swapFunction = isToken1 ? 'swapToken1' : 'swapToken2'
      
      console.log(`Executing ${swapFunction} on ${ammName}...`)
      
      // Estimate gas first
      let gasEstimate
      try {
        gasEstimate = await ammContract.estimateGas[swapFunction](amount, {
          from: signerAddress
        })
        // Add 20% buffer
        gasEstimate = gasEstimate.mul(120).div(100)
        console.log('Estimated gas:', gasEstimate.toString())
      } catch (estimationError) {
        console.warn('Gas estimation failed, using fallback:', estimationError.message)
        gasEstimate = 500000 // Fallback gas limit
      }
      
      // Execute the swap
      const tx = await ammContract[swapFunction](amount, {
        gasLimit: gasEstimate,
        gasPrice: await provider.getGasPrice()
      })
      
      console.log('Swap transaction sent:', tx.hash)
      
      // Wait for the transaction to be mined
      const receipt = await tx.wait(1)
      console.log('Transaction confirmed in block:', receipt.blockNumber)
      
      if (receipt.status === 0) {
        throw new Error('Transaction reverted')
      }
      
      // Get the actual amount received
      const swapEvents = receipt.events?.filter(x => x.event === 'Swap')
      if (swapEvents && swapEvents.length > 0) {
        const swapEvent = swapEvents[0]
        const amountOut = isToken1 ? swapEvent.args.amount2 : swapEvent.args.amount1
        console.log(`Received ${ethers.utils.formatEther(amountOut)} ${isToken1 ? 'USD' : 'KEL'}`)
      }
      
      // Dispatch success
      dispatch(swapSuccess(tx.hash))
      return tx
    } catch (error) {
      console.error('Error during swap execution:', error)
      throw error // This will be caught by the outer catch block
    }
    
  } catch (error) {
    console.error('Swap failed:', {
      message: error.message,
      code: error.code,
      data: error.data,
      reason: error.reason,
      stack: error.stack
    })
    
    // Format a user-friendly error message
    let errorMessage = 'Transaction failed';
    if (error.reason) {
      errorMessage += `: ${error.reason}`;
    } else if (error.data?.message) {
      errorMessage += `: ${error.data.message}`;
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    dispatch(swapFail(errorMessage));
    throw new Error(errorMessage);
  } finally {
    console.groupEnd()
  }
}
