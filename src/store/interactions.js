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

import TOKEN_ABI from '../abis/Token.json';
import AMM_ABI from '../abis/AMM.json';
import AGGREGATOR_ABI from '../abis/DexAggregator.json';
import config from '../config.json';

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
    const kelchainAddress = getChecksumAddress(config[chainId].tokens.kelchain.address)
    const usdAddress = getChecksumAddress(config[chainId].tokens.usd.address)
    
    const kelchain = new ethers.Contract(kelchainAddress, TOKEN_ABI, provider)
    const usd = new ethers.Contract(usdAddress, TOKEN_ABI, provider)

    dispatch(setContracts([kelchain, usd]))
    dispatch(setSymbols([await kelchain.symbol(), await usd.symbol()]))
    
    return { kelchain, usd }
  } catch (error) {
    console.error('Error loading tokens:', error)
    throw error
  }
}

export const loadAMM = async (provider, chainId, dispatch) => {
  try {
    const amm1Address = getChecksumAddress(config[chainId].amms.amm1.address)
    const amm2Address = config[chainId].amms.amm2.address ? 
      getChecksumAddress(config[chainId].amms.amm2.address) : null
    const aggregatorAddress = config[chainId].aggregator.address ? 
      getChecksumAddress(config[chainId].aggregator.address) : null

    const amm1 = new ethers.Contract(amm1Address, AMM_ABI, provider)
    const amm2 = amm2Address ? new ethers.Contract(amm2Address, AMM_ABI, provider) : null
    const aggregator = aggregatorAddress ? new ethers.Contract(aggregatorAddress, AGGREGATOR_ABI, provider) : null

    dispatch(setContract({ amm1, amm2, aggregator }))

    return { amm1, amm2, aggregator }
  } catch (error) {
    console.error('Error loading AMM:', error)
    throw error
  }
}


// ------------------------------------------------------------------------------
// LOAD BALANCES & SHARES
export const loadBalances = async (amm, tokens, account, dispatch) => {
  if (!amm || !amm.amm1 || !amm.amm1.contract || !tokens || !tokens[0] || !tokens[1] || !account) {
    console.warn('loadBalances: Missing required parameters', { 
      amm: !!amm,
      amm1: !!(amm?.amm1),
      amm1Contract: !!(amm?.amm1?.contract),
      token1: !!tokens?.[0], 
      token2: !!tokens?.[1],
      account: !!account 
    });
    return;
  }

  try {
    // Load token balances
    const balance1 = await tokens[0].balanceOf(account);
    const balance2 = await tokens[1].balanceOf(account);

    // Convert BigNumber to string before formatting
    dispatch(balancesLoaded([
      ethers.utils.formatUnits(balance1.toString(), 'ether'),
      ethers.utils.formatUnits(balance2.toString(), 'ether')
    ]));

    // Try to get shares from the contract
    try {
      const shares = await amm.amm1.contract.shares(account);
      // Ensure shares is a string before formatting
      const sharesStr = typeof shares === 'number' ? shares.toString() : shares;
      dispatch(sharesLoaded(ethers.utils.formatUnits(sharesStr, 'ether')));
    } catch (error) {
      console.log('Could not load shares:', error);
      dispatch(sharesLoaded('0'));
    }
    
  } catch (error) {
    console.error('Error in loadBalances:', error);
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
// REMOVE LIQUDITY
export const removeLiquidity = async (provider, amm, shares, dispatch) => {
  try {
    dispatch(withdrawRequest())

    const signer = await provider.getSigner()

    let transaction = await amm.amm1.connect(signer).removeLiquidity(shares)
    await transaction.wait()

    dispatch(withdrawSuccess(transaction.hash))
  } catch (error) {
    dispatch(withdrawFail())
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
    return true

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
  const block = await provider.getBlockNumber()

  const swapStream = await amm.amm1.queryFilter('Swap', 0, block)
  const swaps = swapStream.map(event => {
    return { hash: event.transactionHash, args: event.args }
  })

  dispatch(swapsLoaded(swaps))
}

// ------------------------------------------------------------------------------
// AGGREGATOR FUNCTIONS

export const compareAMMRates = async (amm1, amm2, inputToken, amount) => {
  try {
    let rate1, rate2
    const parsedAmount = ethers.utils.parseUnits(amount.toString(), 'ether')
    
    if (inputToken === 'KelChain') {
      rate1 = await amm1.calculateToken1Swap(parsedAmount)
      rate2 = await amm2.calculateToken1Swap(parsedAmount)
    } else {
      rate1 = await amm1.calculateToken2Swap(parsedAmount)
      rate2 = await amm2.calculateToken2Swap(parsedAmount)
    }
    
    return {
      amm1Rate: ethers.utils.formatUnits(rate1, 'ether'),
      amm2Rate: ethers.utils.formatUnits(rate2, 'ether'),
      bestAMM: rate1.gt(rate2) ? 'amm1' : 'amm2',
      bestRate: ethers.utils.formatUnits(rate1.gt(rate2) ? rate1 : rate2, 'ether')
    }
  } catch (error) {
    console.error('Error comparing AMM rates:', error)
    return null
  }
}

export const swapViaAggregator = async (provider, aggregator, inputToken, amount, dispatch) => {
  try {
    if (!provider || !aggregator || !inputToken || !amount) {
      throw new Error('Missing required parameters for swap')
    }
    
    dispatch(swapRequest())
    
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()
    
    console.log(`[swapViaAggregator] Initiating swap for ${signerAddress}`)
    console.log(`[swapViaAggregator] Token: ${inputToken}, Amount: ${amount.toString()}`)
    
    // Check token approval first
    const tokenContract = inputToken === 'KelChain' 
      ? new ethers.Contract(config[31337].tokens.kelchain.address, TOKEN_ABI, signer)
      : new ethers.Contract(config[31337].tokens.usd.address, TOKEN_ABI, signer)
    
    console.log('[swapViaAggregator] Checking token approval...')
    let allowance = await tokenContract.allowance(signerAddress, aggregator.address)
    console.log(`[swapViaAggregator] Current allowance: ${ethers.utils.formatEther(allowance)}`)
    
    // Convert amount to BigNumber to ensure proper comparison
    const amountBN = ethers.BigNumber.from(amount)
    
    // Check if we need to increase allowance
    if (allowance.lt(amountBN)) {
      console.log('[swapViaAggregator] Current allowance insufficient, approving tokens...')
      
      // First, try to reset approval to 0 (some tokens require this)
      try {
        const resetTx = await tokenContract.approve(aggregator.address, 0)
        console.log('[swapViaAggregator] Reset approval tx:', resetTx.hash)
        await resetTx.wait(1) // Wait for 1 confirmation
      } catch (resetError) {
        console.warn('[swapViaAggregator] Could not reset approval to 0:', resetError)
      }
      
      // Then set the new allowance to the maximum possible value
      const maxUint256 = ethers.constants.MaxUint256
      const approveTx = await tokenContract.approve(aggregator.address, maxUint256, {
        gasLimit: 200000 // Increased gas limit for approval
      })
      console.log(`[swapViaAggregator] New approval tx hash: ${approveTx.hash}`)
      
      // Wait for the approval transaction to be mined
      const receipt = await approveTx.wait(1) // Wait for 1 confirmation
      console.log('[swapViaAggregator] Approval confirmed in block:', receipt.blockNumber)
      
      // Double check the new allowance
      allowance = await tokenContract.allowance(signerAddress, aggregator.address)
      console.log(`[swapViaAggregator] New allowance: ${ethers.utils.formatEther(allowance)}`)
      
      if (allowance.lt(amountBN)) {
        throw new Error(`Failed to set sufficient allowance. Current: ${ethers.utils.formatEther(allowance)}, Required: ${ethers.utils.formatEther(amountBN)}`)
      }
    }
    
    console.log('[swapViaAggregator] Sending swap transaction...')
    
    try {
      // Get the function signature based on token
      const functionName = inputToken === 'KelChain' ? 'swapToken1ForToken2' : 'swapToken2ForToken1'
      console.log(`[swapViaAggregator] Calling ${functionName} with amount:`, amount.toString())
      
      // Estimate gas with a buffer
      let gasEstimate
      try {
        // Try with a buffer to avoid out of gas errors
        gasEstimate = await aggregator.estimateGas[functionName](amount, {
          gasLimit: 300000 // Initial gas limit for estimation
        })
        console.log('[swapViaAggregator] Gas estimate:', gasEstimate.toString())
        // Add 20% buffer to the gas estimate
        gasEstimate = gasEstimate.mul(120).div(100)
      } catch (estimationError) {
        console.error('[swapViaAggregator] Gas estimation failed:', estimationError)
        // If estimation fails, use a high gas limit
        gasEstimate = ethers.BigNumber.from('500000')
        console.log(`[swapViaAggregator] Using fallback gas limit: ${gasEstimate.toString()}`)
      }
      
      // Send the transaction with proper gas parameters
      const txOptions = {
        gasLimit: gasEstimate,
        gasPrice: await provider.getGasPrice()
      }
      
      console.log('[swapViaAggregator] Sending transaction with options:', {
        gasLimit: txOptions.gasLimit.toString(),
        gasPrice: txOptions.gasPrice?.toString()
      })
      
      const transaction = await aggregator.connect(signer)[functionName](amount, txOptions)
      console.log('[swapViaAggregator] Transaction hash:', transaction.hash)
      
      // Wait for the transaction to be mined
      const receipt = await transaction.wait(1) // Wait for 1 confirmation
      console.log('[swapViaAggregator] Transaction confirmed in block:', receipt.blockNumber)
      
      // Check if the transaction was successful
      if (receipt.status === 0) {
        throw new Error('Transaction reverted')
      }
      
      dispatch(swapSuccess(transaction.hash))
      return transaction
      
    } catch (txError) {
      console.error('[swapViaAggregator] Transaction error:', {
        message: txError.message,
        code: txError.code,
        data: txError.data,
        reason: txError.reason,
        stack: txError.stack
      })
      
      // Try to extract revert reason if available
      if (txError.reason || txError.data?.message) {
        throw new Error(txError.reason || txError.data.message)
      }
      
      // Check for common errors
      if (txError.message.includes('insufficient funds')) {
        throw new Error('Insufficient funds for transaction')
      }
      
      if (txError.message.includes('revert')) {
        throw new Error('Transaction reverted. Check token balances and allowances.')
      }
      
      throw new Error(txError.message || 'Transaction failed')
    }
    
  } catch (error) {
    console.error('[swapViaAggregator] Swap failed with error:', {
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
