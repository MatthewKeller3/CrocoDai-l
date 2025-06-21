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
  const [rates, setRates] = useState({ amm1: 0, amm2: 0 })
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
  const [aggregatorContract, setAggregatorContract] = useState(null)

  useEffect(() => {
    if (provider && amm && amm.amm1 && amm.amm1.contract && !amm1Contract) {
      setAmm1Contract(amm.amm1.contract)
    }
    if (provider && amm && amm.amm2 && amm.amm2.contract && !amm2Contract) {
      setAmm2Contract(amm.amm2.contract)
    }
    if (provider && amm && amm.aggregator && amm.aggregator.contract && !aggregatorContract) {
      setAggregatorContract(amm.aggregator.contract)
    }
  }, [provider, amm, amm1Contract, amm2Contract, aggregatorContract])

  const inputHandler = useCallback(async (e) => {
    if (!inputToken || !outputToken) return;

    const value = e.target.value;
    setInputAmount(value);

    if (value === '' || value === '0') {
      setOutputAmount('0');
      setPrice(0);
      setBestDex(null);
      setRates({ amm1: 0, amm2: 0 });
      return;
    }

    try {
      // Get rates from both AMMs
      const amount = ethers.utils.parseEther(value.toString());
      
      let amm1Rate = 0;
      let amm2Rate = 0;
      
      if (amm1Contract && amm2Contract && tokens && tokens[0] && tokens[1]) {
        if (inputToken === tokens[0] && outputToken === tokens[1]) {
          // KelChain -> USD
          amm1Rate = await amm1Contract.calculateToken1Swap(amount);
          amm2Rate = await amm2Contract.calculateToken1Swap(amount);
        } else if (inputToken === tokens[1] && outputToken === tokens[0]) {
          // USD -> KelChain
          amm1Rate = await amm1Contract.calculateToken2Swap(amount);
          amm2Rate = await amm2Contract.calculateToken2Swap(amount);
        }

        const amm1Output = parseFloat(ethers.utils.formatEther(amm1Rate));
        const amm2Output = parseFloat(ethers.utils.formatEther(amm2Rate));

        setRates({ amm1: amm1Output, amm2: amm2Output });

        // Determine best DEX
        if (amm1Output > amm2Output) {
          setBestDex('AMM1');
          setOutputAmount(amm1Output);
          setPrice(amm1Output / parseFloat(value));
        } else {
          setBestDex('AMM2');
          setOutputAmount(amm2Output);
          setPrice(amm2Output / parseFloat(value));
        }
      }
    } catch (error) {
      console.error('Error calculating rates:', error);
    }
  }, [inputToken, outputToken, amm1Contract, amm2Contract, tokens]);

  const swapHandler = async (e) => {
    e.preventDefault()
    setIsSwapping(true)
    setShowAlert(false)

    try {
      // Parse input amount to wei
      const amountInWei = ethers.utils.parseEther(inputAmount.toString())
      
      let transaction
      
      if (inputToken === tokens[0] && outputToken === tokens[1]) {
        // KelChain -> USD via aggregator
        transaction = await swapViaAggregator(
          provider,
          aggregatorContract,
          'KelChain',
          amountInWei,  // Pass amount in wei
          dispatch
        )
      } else {
        // USD -> KelChain via aggregator  
        transaction = await swapViaAggregator(
          provider,
          aggregatorContract,
          'USD',
          amountInWei,  // Pass amount in wei
          dispatch
        )
      }

      if (transaction) {
        await transaction.wait()
        
        await loadBalances(amm, tokens, account, dispatch)
        setShowAlert(true)
        setInputAmount(0)
        setOutputAmount(0)
        setPrice(0)
        setBestDex(null)
        setRates({ amm1: 0, amm2: 0 })
      } else {
        throw new Error('Transaction failed to be created')
      }
    } catch (error) {
      console.error('Swap failed:', error)
      window.alert(`Swap Failed: ${error.message || 'Unknown error'}`)
    }

    setIsSwapping(false)
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
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>Best Rate:</strong> {bestDex}
                      </div>
                      <div>
                        <strong>Price:</strong> {price?.toFixed(6)} {outputToken?.symbol} per {inputToken?.symbol}
                      </div>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-between">
                      <div>AMM1: {rates.amm1?.toFixed(6)}</div>
                      <div>AMM2: {rates.amm2?.toFixed(6)}</div>
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
