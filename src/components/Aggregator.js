import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Card, Form, InputGroup, Button, Row, Col, Spinner, Alert } from 'react-bootstrap'
import { ethers } from 'ethers'

import {
  loadBalances,
  swapViaAggregator
} from '../store/interactions'

const Aggregator = () => {
  const [inputToken, setInputToken] = useState(null)
  const [outputToken, setOutputToken] = useState(null)
  const [inputAmount, setInputAmount] = useState(0)
  const [outputAmount, setOutputAmount] = useState(0)
  const [price, setPrice] = useState(0)
  const [showAlert, setShowAlert] = useState(false)
  const [bestDex, setBestDex] = useState(null)
  // State declarations
  const [rates, setRates] = useState({ amm1: 0, amm2: 0, amm3: 0 })
  const [isSwapping, setIsSwapping] = useState(false)

  const provider = useSelector(state => state.provider.connection)
  const account = useSelector(state => state.provider.account)
  const tokens = useSelector(state => state.tokens.contracts)
  const symbols = useSelector(state => state.tokens.symbols)
  const balances = useSelector(state => state.tokens.balances)
  const amm = useSelector(state => state.amm)
  const dispatch = useDispatch()

  const [amm1Contract, setAmm1Contract] = useState(null)
  const [amm2Contract, setAmm2Contract] = useState(null)
  const [amm3Contract, setAmm3Contract] = useState(null)
  const [aggregatorContract, setAggregatorContract] = useState(null)

  useEffect(() => {
    if (provider && amm) {
      if (amm.amm1?.contract && !amm1Contract) {
        setAmm1Contract(amm.amm1.contract)
      }
      if (amm.amm2?.contract && !amm2Contract) {
        setAmm2Contract(amm.amm2.contract)
      }
      if (amm.amm3?.contract && !amm3Contract) {
        setAmm3Contract(amm.amm3.contract)
      }
      if (amm.aggregator?.contract && !aggregatorContract) {
        setAggregatorContract(amm.aggregator.contract)
      }
    }
  }, [provider, amm, amm1Contract, amm2Contract, amm3Contract, aggregatorContract])

  const inputHandler = useCallback(async (e) => {
    if (!inputToken || !outputToken) return;

    const value = e.target.value;
    setInputAmount(value);

    if (value === '' || value === '0') {
      setOutputAmount('0');
      setPrice(0);
      setBestDex(null);
      setRates({ amm1: 0, amm2: 0, amm3: 0 });
      return;
    }

    try {
      // Get rates from all AMMs
      const amount = ethers.utils.parseEther(value.toString());
      
      let amm1Rate = 0;
      let amm2Rate = 0;
      let amm3Rate = 0;
      
      if (!tokens || !tokens[0] || !tokens[1]) {
        console.error('Tokens not loaded');
        return;
      }

      console.log('Fetching rates for input amount:', ethers.utils.formatEther(amount));
      
      const isToken1ToToken2 = inputToken === tokens[0] && outputToken === tokens[1];
      const isToken2ToToken1 = inputToken === tokens[1] && outputToken === tokens[0];

      // Enhanced token pair validation
      const isValidPair = isToken1ToToken2 || isToken2ToToken1;
      const inputSymbol = inputToken === tokens[0] ? symbols[0] : (inputToken === tokens[1] ? symbols[1] : 'Unknown');
      const outputSymbol = outputToken === tokens[0] ? symbols[0] : (outputToken === tokens[1] ? symbols[1] : 'Unknown');
      
      if (!isValidPair) {
        console.error('Invalid token pair:', {
          inputToken: {
            address: inputToken?.address,
            symbol: inputSymbol
          },
          outputToken: {
            address: outputToken?.address,
            symbol: outputSymbol
          },
          token1: tokens[0]?.address,
          token2: tokens[1]?.address,
          symbol1: symbols[0],
          symbol2: symbols[1]
        });
        return;
      }
      
      console.log('Token pair validated:', {
        from: inputSymbol,
        to: outputSymbol,
        isToken1ToToken2,
        isToken2ToToken1
      });

      // Helper function to safely get swap rate
      const getSwapRate = async (ammContract, isToken1ToToken2, amount, isAmm3 = false) => {
        if (!ammContract) {
          console.log('AMM contract not available');
          return { rate: ethers.BigNumber.from(0), isValid: false };
        }

        const method = isToken1ToToken2 ? 'calculateToken1Swap' : 'calculateToken2Swap';
        const contractAddress = ammContract.address;
        console.log(`Attempting to get rate using ${method} from ${isAmm3 ? 'AMM3' : 'AMM'} at ${contractAddress}`);
        
        // Check if the method exists on the contract
        if (typeof ammContract[method] !== 'function') {
          console.error(`Method ${method} not found on AMM contract at ${contractAddress}`);
          return { rate: ethers.BigNumber.from(0), isValid: false };
        }
        
        try {
          // For AMM3, add a timeout to prevent hanging
          let ratePromise = ammContract[method](amount);
          
          // Add a timeout for AMM3 to prevent hanging
          if (isAmm3) {
            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('AMM3 request timed out')), 5000)
            );
            ratePromise = Promise.race([ratePromise, timeout]);
          }
          
          const rate = await ratePromise;
          console.log(`Successfully got rate from ${isAmm3 ? 'AMM3' : 'AMM'} at ${contractAddress}:`, 
            ethers.utils.formatEther(rate));
          return { rate, isValid: true };
          
        } catch (error) {
          const errorDetails = {
            contract: isAmm3 ? 'AMM3' : 'AMM',
            address: contractAddress,
            method,
            error: error.message,
            code: error.code,
            amount: amount.toString(),
            direction: isToken1ToToken2 ? 'Token1→Token2' : 'Token2→Token1'
          };
          
          if (isAmm3) {
            console.warn('Non-critical AMM3 error, will be skipped:', errorDetails);
          } else {
            console.error('Error getting rate:', errorDetails);
          }
          
          return { rate: ethers.BigNumber.from(0), isValid: false };
        }
      };

      // Get rates from all AMMs with better error handling
      try {
        // Check if AMM3 is available and has the required methods
        let isAmm3Working = false;
        if (amm3Contract) {
          try {
            console.log('Checking AMM3 at address:', amm3Contract.address);
            
            // Only check for the swap calculation methods, not token1Balance
            const hasRequiredMethods = 
              typeof amm3Contract.calculateToken1Swap === 'function' &&
              typeof amm3Contract.calculateToken2Swap === 'function';
              
            if (!hasRequiredMethods) {
              console.warn('AMM3 is missing required swap calculation methods');
            } else {
              console.log('AMM3 has required swap methods, will attempt to use it');
              isAmm3Working = true;
            }
          } catch (amm3Error) {
            console.warn('Error checking AMM3:', {
              message: amm3Error.message,
              code: amm3Error.code
            });
          }
        }
        
        if (!isAmm3Working) {
          console.log('AMM3 will be skipped for this session');
        }

        // Get rates from all working AMMs in parallel
        const ratePromises = [
          getSwapRate(amm1Contract, isToken1ToToken2, amount, false),
          getSwapRate(amm2Contract, isToken1ToToken2, amount, false)
        ];

        // Only include AMM3 if it's working
        if (isAmm3Working && amm3Contract) {
          ratePromises.push(getSwapRate(amm3Contract, isToken1ToToken2, amount, true));
        } else {
          ratePromises.push(Promise.resolve({ rate: ethers.BigNumber.from(0), isValid: false }));
        }

        const [result1, result2, result3] = await Promise.all(ratePromises);
        
        // Process rates from all AMMs
        const rates = [
          { rate: result1.rate, isValid: result1.isValid },
          { rate: result2.rate, isValid: result2.isValid },
          { rate: result3?.rate || ethers.BigNumber.from(0), isValid: result3?.isValid || false }
        ];
        
        // Get valid rates
        const validRates = rates.filter(r => r.isValid).map(r => r.rate);
        
        // If no valid rates, throw an error
        if (validRates.length === 0) {
          throw new Error('No valid rates available from any AMM');
        }
        
        // Find the best rate among valid AMMs
        const bestRate = validRates.reduce((best, current) => 
          current.gt(best) ? current : best, ethers.BigNumber.from(0)
        );
        
        // Set output amount based on best rate
        const outputAmount = bestRate.toString();
        setOutputAmount(ethers.utils.formatEther(outputAmount));
        
        // Set individual rates for display (handle cases where AMM3 is not available)
        setRates({
          amm1: rates[0].isValid ? parseFloat(ethers.utils.formatEther(rates[0].rate)) : 0,
          amm2: rates[1].isValid ? parseFloat(ethers.utils.formatEther(rates[1].rate)) : 0,
          amm3: rates[2]?.isValid ? parseFloat(ethers.utils.formatEther(rates[2].rate)) : 0
        });
        
        // Set price if input amount is valid
        if (parseFloat(inputAmount) > 0) {
          setPrice(parseFloat(ethers.utils.formatEther(bestRate)) / parseFloat(inputAmount));
        }
        
        // Set rates for best rate calculation
        amm1Rate = rates[0].isValid ? rates[0].rate : ethers.BigNumber.from(0);
        amm2Rate = rates[1].isValid ? rates[1].rate : ethers.BigNumber.from(0);
        amm3Rate = rates[2]?.isValid ? rates[2].rate : ethers.BigNumber.from(0);
        
        console.log('Rate calculation complete:', {
          amm1: rates[0].isValid ? ethers.utils.formatEther(rates[0].rate) : 'invalid',
          amm2: rates[1].isValid ? ethers.utils.formatEther(rates[1].rate) : 'invalid',
          amm3: rates[2]?.isValid ? ethers.utils.formatEther(rates[2].rate) : 'invalid',
          bestRate: ethers.utils.formatEther(bestRate)
        });
      } catch (error) {
        console.error('Error fetching rates from AMMs:', error);
        // If there's an error, we'll use zeros for the rates
        amm1Rate = ethers.BigNumber.from(0);
        amm2Rate = ethers.BigNumber.from(0);
        amm3Rate = ethers.BigNumber.from(0);
      }

      const amm1Output = parseFloat(ethers.utils.formatEther(amm1Rate));
      const amm2Output = parseFloat(ethers.utils.formatEther(amm2Rate));
      const amm3Output = amm3Contract ? parseFloat(ethers.utils.formatEther(amm3Rate)) : 0;

      setRates({ amm1: amm1Output, amm2: amm2Output, amm3: amm3Output });

      // Find the best rate among all AMMs
      const rates = [
        { dex: 'AMM1', rate: amm1Output },
        { dex: 'AMM2', rate: amm2Output },
        ...(amm3Contract ? [{ dex: 'AMM3', rate: amm3Output }] : [])
      ];
      
      // Find the AMM with the highest rate
      const bestRate = rates.reduce((best, current) => 
        (current.rate > best.rate) ? current : best
      );
      
      setBestDex(bestRate.dex);
      setOutputAmount(bestRate.rate);
      setPrice(parseFloat(inputAmount) > 0 ? bestRate.rate / parseFloat(inputAmount) : 0);
    } catch (error) {
      console.error('Error calculating rates:', error);
      setRates({ amm1: 0, amm2: 0, amm3: 0 });
      setBestDex(null);
      setOutputAmount('');
      setPrice(0);
    }
  }, [inputToken, outputToken, amm1Contract, amm2Contract, amm3Contract, tokens, inputAmount, symbols]);

  const swapHandler = async (e) => {
    e.preventDefault()
    
    if (!inputToken || !outputToken || !inputAmount || parseFloat(inputAmount) <= 0) {
      setShowAlert(true)
      return
    }
    
    setIsSwapping(true)
    setShowAlert(false)
    
    try {
      // Parse input amount to wei
      const amountInWei = ethers.utils.parseEther(inputAmount.toString())
      
      // Determine which token is being swapped
      const tokenSymbol = inputToken === tokens[0] ? 'KEL' : 'USD';
      
      // Find the best AMM to use
      const ammRates = [
        { dex: 'amm1', rate: rates.amm1, contract: amm1Contract },
        { dex: 'amm2', rate: rates.amm2, contract: amm2Contract },
        ...(amm3Contract ? [{ dex: 'amm3', rate: rates.amm3, contract: amm3Contract }] : [])
      ].filter(amm => amm.contract); // Filter out any undefined contracts
      
      if (ammRates.length === 0) {
        throw new Error('No valid AMMs available for swapping')
      }
      
      const bestAmm = ammRates.reduce((best, current) => 
        (current.rate > best.rate) ? current : best
      );
      
      console.log(`[swapHandler] Best AMM: ${bestAmm.dex} with rate: ${bestAmm.rate}`);
      
      // Execute swap on the best AMM
      const transaction = await swapViaAggregator(
        provider,
        aggregatorContract,
        tokenSymbol,
        amountInWei,
        dispatch,
        { contract: bestAmm.contract, ammName: bestAmm.dex.toUpperCase() }
      )

      if (transaction) {
        const receipt = await transaction.wait(1);
        console.log(`[swapHandler] Transaction mined in block ${receipt.blockNumber}`);
        
        // Refresh balances
        if (amm?.amm1?.contract) {
          await loadBalances(amm.amm1, tokens, account, dispatch);
        }
        
        // Reset form
        setInputAmount(0);
        setOutputAmount(0);
        setPrice(0);
        setBestDex(null);
        setRates({ amm1: 0, amm2: 0, amm3: 0 });
        
        // Show success message
        setShowAlert(true);
      } else {
        throw new Error('Transaction failed to be created');
      }
    } catch (error) {
      console.error('Swap failed:', error);
      window.alert(`Swap Failed: ${error.reason || error.message || 'Unknown error'}`);
    } finally {
      setIsSwapping(false);
    }
  }

  // Update output when input changes
  useEffect(() => {
    const updateOutput = async () => {
      if (inputToken && outputToken && inputAmount > 0) {
        await inputHandler({ target: { value: inputAmount } });
      }
    };
    updateOutput();
  }, [inputToken, outputToken, inputAmount, inputHandler]);

  return (
    <div>
      <Card style={{ maxWidth: '450px' }} className='mx-auto px-4'>
        {account ? (
          <Form onSubmit={swapHandler} style={{ maxWidth: '450px', margin: '50px auto' }}>
            <Row className='my-3'>
              <div className='d-flex justify-content-between'>
                <Form.Label><strong>Input Token</strong></Form.Label>
                <Form.Text muted>
                  Balance: {
                    inputToken === tokens[0] ? (
                      balances[0]
                    ) : inputToken === tokens[1] ? (
                      balances[1]
                    ) : 0
                  }
                </Form.Text>
              </div>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="0.0"
                  value={inputAmount === 0 ? "" : inputAmount}
                  onChange={(e) => inputHandler(e)}
                  disabled={!inputToken}
                />
                <Form.Select
                  aria-label="Default select example"
                  value={inputToken ? inputToken.address : ''}
                  onChange={(e) => setInputToken(tokens.find(token => token.address === e.target.value))}
                >
                  <option value="">Select Token</option>
                  <option value={tokens[0] ? tokens[0].address : ''}>{symbols && symbols[0]}</option>
                  <option value={tokens[1] ? tokens[1].address : ''}>{symbols && symbols[1]}</option>
                </Form.Select>
              </InputGroup>
            </Row>

            <Row className='my-4'>
              <div className='d-flex justify-content-between'>
                <Form.Label><strong>Output Token</strong></Form.Label>
                <Form.Text muted>
                  Balance: {
                    outputToken === tokens[0] ? (
                      balances[0]
                    ) : outputToken === tokens[1] ? (
                      balances[1]
                    ) : 0
                  }
                </Form.Text>
              </div>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="0.0"
                  value={outputAmount === 0 ? "" : outputAmount}
                  disabled
                />
                <Form.Select
                  aria-label="Default select example"
                  value={outputToken ? outputToken.address : ''}
                  onChange={(e) => setOutputToken(tokens.find(token => token.address === e.target.value))}
                >
                  <option value="">Select Token</option>
                  <option value={tokens[0] ? tokens[0].address : ''}>{symbols && symbols[0]}</option>
                  <option value={tokens[1] ? tokens[1].address : ''}>{symbols && symbols[1]}</option>
                </Form.Select>
              </InputGroup>
            </Row>

            {inputAmount > 0 && outputAmount > 0 && (
              <Row className='my-3'>
                <Col>
                  <Alert variant="info">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div><strong>Best Rate:</strong> {bestDex}</div>
                      <div>
                        <strong>Price:</strong> {price ? price.toFixed(6) : '0.0'} 
                        {outputToken === tokens[0] ? (symbols && symbols[1]) : (symbols && symbols[0])} per 
                        {inputToken === tokens[0] ? (symbols && symbols[0]) : (symbols && symbols[1])}
                      </div>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-between">
                      <div>AMM1: {rates.amm1?.toFixed(6)} {symbols && symbols[1]}</div>
                      <div>AMM2: {rates.amm2?.toFixed(6)} {symbols && symbols[1]}</div>
                      {amm3Contract && (
                        <div>AMM3: {rates.amm3?.toFixed(6)} {symbols && symbols[1]}</div>
                      )}
                    </div>
                  </Alert>
                </Col>
              </Row>
            )}

            <Row className='my-3'>
              {isSwapping ? (
                <Spinner animation="border" style={{ display: 'block', margin: '0 auto' }} />
              ) : (
                <Button type="submit" variant="primary" size="lg">
                  Swap via {bestDex || 'Aggregator'}
                </Button>
              )}
              {showAlert && (
                <Alert
                  variant="success"
                  onClose={() => setShowAlert(false)}
                  dismissible
                  className="mt-2"
                >
                  <p>Swap Successful</p>
                  <hr />
                  <p className="mb-0">
                    Check your wallet to see your tokens.
                  </p>
                </Alert>
              )}
            </Row>
          </Form>
        ) : (
          <p
            className='d-flex justify-content-center align-items-center'
            style={{ height: '300px' }}
          >
            Please connect wallet.
          </p>
        )}
      </Card>
    </div>
  )
}

export default Aggregator
