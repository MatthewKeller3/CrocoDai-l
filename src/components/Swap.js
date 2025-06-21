import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import * as tokensActions from '../store/reducers/tokens'
import * as ammActions from '../store/reducers/amm'
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { ethers } from 'ethers'

import Alert from './Alert'

import {
  swap,
  loadBalances
} from '../store/interactions'

const Swap = () => {
  const [inputToken, setInputToken] = useState(null)
  const [outputToken, setOutputToken] = useState(null)
  const [inputAmount, setInputAmount] = useState(0)
  const [outputAmount, setOutputAmount] = useState(0)

  const [price, setPrice] = useState(0)

  const [showAlert, setShowAlert] = useState(false)

  const provider = useSelector(state => state.provider.connection)
  const account = useSelector(state => state.provider.account)

  const tokens = useSelector(state => state.tokens.contracts)
  const symbols = useSelector(state => state.tokens.symbols)
  const balances = useSelector(state => state.tokens.balances)

  const ammState = useSelector(state => state.amm)
  const amm = ammState?.amm1?.contract
  const isSwapping = useSelector(state => state.amm.swapping.isSwapping)
  const isSuccess = useSelector(state => state.amm.swapping.isSuccess)
  const transactionHash = useSelector(state => state.amm.swapping.transactionHash)

  const dispatch = useDispatch()

  // Check if all required contracts are loaded
  const contractsLoaded = useMemo(() => {
    const tokensReady = tokens?.length === 2 && tokens[0]?.address && tokens[1]?.address;
    const ammReady = ammState?.amm1?.contract && ammState?.amm2?.contract;
    
    console.log('Contract Status:', {
      tokensReady,
      token1: tokens?.[0]?.address,
      token2: tokens?.[1]?.address,
      amm1: ammState?.amm1?.address,
      amm2: ammState?.amm2?.address,
      amm1Contract: !!ammState?.amm1?.contract,
      amm2Contract: !!ammState?.amm2?.contract
    });
    
    return tokensReady && ammReady;
  }, [tokens, ammState]);

  // Load balances when component mounts and when account/tokens change
  useEffect(() => {
    const loadData = async () => {
      if (!account) {
        console.log('Account not connected');
        return;
      }

      console.log('Loading balances with:', {
        account,
        tokens: tokens?.map(t => t?.address),
        amm1: ammState?.amm1?.address,
        amm2: ammState?.amm2?.address,
        contractsLoaded
      });

      try {
        // Verify contracts before loading balances
        if (!tokens?.[0]?.address || !tokens?.[1]?.address) {
          console.error('Token contracts not loaded');
          return;
        }

        // Import loadBalances here to avoid dependency warning
        const { loadBalances } = await import('../store/interactions');
        
        // Load token balances first
        const token1Balance = await tokens[0].balanceOf(account);
        const token2Balance = await tokens[1].balanceOf(account);
        
        console.log('Token Balances:', {
          token1: token1Balance.toString(),
          token2: token2Balance.toString()
        });
        
        // Load AMM balances - try both AMMs if available
        const tryLoadBalances = async (amm) => {
          try {
            console.log('Attempting to load balances with AMM:', amm.address);
            await loadBalances(amm, tokens, account, dispatch);
            return true; // Success
          } catch (error) {
            console.warn(`Failed to load balances with AMM ${amm.address}:`, error);
            return false; // Failed
          }
        };

        let balanceLoadSuccess = false;
        
        // Try AMM1 first
        if (ammState.amm1?.contract) {
          balanceLoadSuccess = await tryLoadBalances(ammState.amm1);
        }
        
        // If AMM1 failed or not available, try AMM2
        if (!balanceLoadSuccess && ammState.amm2?.contract) {
          balanceLoadSuccess = await tryLoadBalances(ammState.amm2);
        }
        
        // If both failed, set default values
        if (!balanceLoadSuccess) {
          console.warn('Could not load balances from any AMM');
          dispatch(tokensActions.balancesLoaded(['0', '0']));
          dispatch(ammActions.sharesLoaded('0'));
        }
        
        // Set default tokens if not set
        if (!inputToken || !outputToken) {
          const [symbol1, symbol2] = await Promise.all([
            tokens[0].symbol(),
            tokens[1].symbol()
          ]);
          console.log('Setting default tokens:', { symbol1, symbol2 });
          setInputToken(symbol1);
          setOutputToken(symbol2);
        }
      } catch (error) {
        console.error('Error in loadData:', error);
      }
    };

    loadData();
    
    // Set up polling
    const balanceInterval = setInterval(loadData, 10000);
    return () => clearInterval(balanceInterval);
  }, [account, contractsLoaded, tokens, ammState, dispatch, inputToken, outputToken]);

  const inputHandler = async (e) => {
    if (!inputToken || !outputToken || !amm) {
      window.alert('Please select tokens and ensure AMM is loaded')
      return
    }

    if (inputToken === outputToken) {
      window.alert('Invalid token pair')
      return
    }

    try {
      const value = e.target.value;
      if (!value || isNaN(value) || parseFloat(value) <= 0) {
        setOutputAmount('0');
        return;
      }

      // Determine token indices based on selected tokens
      const token1Symbol = symbols?.[0] || 'KEL';
      const isToken1Input = inputToken === token1Symbol;
      
      const amount = ethers.utils.parseUnits(value, 'ether');
      
      let result;
      if (isToken1Input) {
        result = await amm.calculateToken1Swap(amount);
      } else {
        result = await amm.calculateToken2Swap(amount);
      }
      
      const outputAmount = ethers.utils.formatUnits(result.toString(), 'ether');
      setInputAmount(value);
      setOutputAmount(outputAmount);
      
    } catch (error) {
      console.error('Error calculating swap:', error);
      setOutputAmount('0');
    }
  }

  const swapHandler = async (e) => {
    e.preventDefault()

    setShowAlert(false)

    if (!inputToken || !outputToken) {
      window.alert('Please select both input and output tokens')
      return
    }

    if (inputToken === outputToken) {
      window.alert('Cannot swap the same token')
      return
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      window.alert('Please enter a valid amount')
      return
    }

    try {
      const _inputAmount = ethers.utils.parseUnits(inputAmount, 'ether')
      
      // Get the correct token contract based on input
      const tokenContract = inputToken === "KelChain" ? tokens[0] : tokens[1]
      
      if (!tokenContract) {
        throw new Error('Token contract not loaded. Please try refreshing the page.')
      }

      console.log('Initiating swap with:', {
        inputToken,
        outputToken,
        inputAmount: inputAmount,
        tokenContract: tokenContract.address
      })
      
      // Call swap with the correct token contract
      const tx = await swap(provider, ammState, tokenContract, inputToken, _inputAmount, dispatch)
      
      if (tx) {
        console.log('Swap successful, updating balances...')
        await loadBalances(ammState, tokens, account, dispatch)
        await getPrice()
        setShowAlert(true)
        
        // Reset input amount after successful swap
        setInputAmount('0')
        setOutputAmount('0')
      }
    } catch (error) {
      console.error('Swap handler error:', error)
      window.alert(`Swap failed: ${error.message || 'Unknown error occurred'}`)
    }
  }

  const getPrice = useCallback(async () => {
    try {
      if (!amm) {
        console.log('AMM contract not loaded yet');
        return;
      }

      if (inputToken === outputToken) {
        setPrice(0);
        return;
      }

      if (inputToken === 'KelChain') {
        const [balance1, balance2] = await Promise.all([
          amm.token1Balance(),
          amm.token2Balance()
        ]);
        if (balance1 && balance2) {
          setPrice(balance2 / balance1);
        }
      } else {
        const [balance1, balance2] = await Promise.all([
          amm.token1Balance(),
          amm.token2Balance()
        ]);
        if (balance1 && balance2) {
          setPrice(balance1 / balance2);
        }
      }
    } catch (error) {
      console.error('Error getting price:', error);
      setPrice(0);
    }
  }, [inputToken, outputToken, amm]);

  useEffect(() => {
    if (inputToken && outputToken && amm) {
      getPrice();
    } else {
      setPrice(0);
    }
  }, [inputToken, outputToken, amm, getPrice]);

  // Get token symbols with fallbacks
  const token1Symbol = symbols?.[0] || 'KEL';
  const token2Symbol = symbols?.[1] || 'USD';

  // Get token balances with fallbacks
  const token1Balance = balances?.[0] || '0';
  const token2Balance = balances?.[1] || '0';

  return (
    <div>
      <Card style={{ maxWidth: '450px' }} className='mx-auto px-4'>
        {account ? (
          <Form onSubmit={swapHandler} style={{ maxWidth: '450px', margin: '50px auto' }}>
            <Row className='my-3'>
              <div className='d-flex justify-content-between'>
                <Form.Label><strong>Input:</strong></Form.Label>
                <Form.Text muted>
                  Balance: {inputToken === token1Symbol ? token1Balance : token2Balance}
                </Form.Text>
              </div>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="0.0"
                  min="0.0"
                  step="any"
                  value={inputAmount === 0 ? '' : inputAmount}
                  onChange={inputHandler}
                  disabled={!inputToken || !outputToken}
                />
                <DropdownButton
                  variant="outline-secondary"
                  title={inputToken || 'Select Token'}
                >
                  <Dropdown.Item onClick={() => {
                    setInputToken(token1Symbol);
                    setOutputToken(token2Symbol);
                    setInputAmount('0');
                    setOutputAmount('0');
                  }}>
                    {token1Symbol}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => {
                    setInputToken(token2Symbol);
                    setOutputToken(token1Symbol);
                    setInputAmount('0');
                    setOutputAmount('0');
                  }}>
                    {token2Symbol}
                  </Dropdown.Item>
                </DropdownButton>
              </InputGroup>
            </Row>

            <Row className='my-3'>
              <div className='d-flex justify-content-between'>
                <Form.Label><strong>Output:</strong></Form.Label>
                <Form.Text muted>
                  Balance: {outputToken === token1Symbol ? token1Balance : token2Balance}
                </Form.Text>
              </div>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="0.0"
                  value={outputAmount === 0 ? '' : outputAmount}
                  disabled
                />
                <DropdownButton
                  variant="outline-secondary"
                  title={outputToken || 'Select Token'}
                  disabled={!inputToken}
                >
                  <Dropdown.Item 
                    onClick={() => {
                      setOutputToken(token1Symbol);
                      setInputToken(token2Symbol);
                      setInputAmount('0');
                      setOutputAmount('0');
                    }}
                    disabled={inputToken === token1Symbol}
                  >
                    {token1Symbol}
                  </Dropdown.Item>
                  <Dropdown.Item 
                    onClick={() => {
                      setOutputToken(token2Symbol);
                      setInputToken(token1Symbol);
                      setInputAmount('0');
                      setOutputAmount('0');
                    }}
                    disabled={inputToken === token2Symbol}
                  >
                    {token2Symbol}
                  </Dropdown.Item>
                </DropdownButton>
              </InputGroup>
            </Row>

            <Row className='my-3'>
              {isSwapping ? (
                <Spinner animation="border" style={{ display: 'block', margin: '0 auto' }} />
              ) : (
                <Button type='submit' disabled={!inputToken || !outputToken || !inputAmount || parseFloat(inputAmount) <= 0}>
                  Swap
                </Button>
              )}
              <Form.Text muted className='mt-2 text-center'>
                Exchange Rate: {price ? price.toFixed(6) : '0'} {outputToken} per {inputToken}
              </Form.Text>
            </Row>
          </Form>
        ) : (
          <p className='d-flex justify-content-center align-items-center' style={{ height: '300px' }}>
            Please connect your wallet to swap tokens.
          </p>
        )}
      </Card>

      {isSwapping ? (
        <Alert
          message={'Swap Pending...'}
          transactionHash={null}
          variant={'info'}
          setShowAlert={setShowAlert}
        />
      ) : isSuccess && showAlert ? (
        <Alert
          message={'Swap Successful'}
          transactionHash={transactionHash}
          variant={'success'}
          setShowAlert={setShowAlert}
        />
      ) : !isSuccess && showAlert ? (
        <Alert
          message={'Swap Failed'}
          transactionHash={null}
          variant={'danger'}
          setShowAlert={setShowAlert}
        />
      ) : null}
    </div>
  );
}

export default Swap;
