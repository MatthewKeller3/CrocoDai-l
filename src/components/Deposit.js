import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { ethers } from 'ethers'

import Alert from './Alert'

import {
  addLiquidity,
  loadBalances
} from '../store/interactions'

const Deposit = () => {
  const [token1Amount, setToken1Amount] = useState(0)
  const [token2Amount, setToken2Amount] = useState(0)
  const [showAlert, setShowAlert] = useState(false)

  const provider = useSelector(state => state.provider.connection)
  const account = useSelector(state => state.provider.account)

  const tokens = useSelector(state => state.tokens.contracts)
  const symbols = useSelector(state => state.tokens.symbols)
  const balances = useSelector(state => state.tokens.balances)

  const ammState = useSelector(state => state.amm)
  const amm = ammState?.amm1?.contract
  const isDepositing = useSelector(state => state.amm.depositing.isDepositing)
  const isSuccess = useSelector(state => state.amm.depositing.isSuccess)
  const transactionHash = useSelector(state => state.amm.depositing.transactionHash)
  const dispatch = useDispatch()

  const amountHandler = async (e) => {
    if (!amm) {
      console.warn('AMM contract not loaded yet')
      return
    }

    if (e.target.id === 'token1') {
      setToken1Amount(e.target.value)

      // Fetch value from chain
      const _token1Amount = ethers.utils.parseUnits(e.target.value, 'ether')
      const result = await amm.calculateToken2Deposit(_token1Amount)
      const _token2Amount = ethers.utils.formatUnits(result.toString(), 'ether')

      setToken2Amount(_token2Amount)
    } else {
      setToken2Amount(e.target.value)

      // Fetch value from chain
      const _token2Amount = ethers.utils.parseUnits(e.target.value, 'ether')
      const result = await amm.calculateToken1Deposit(_token2Amount)
      const _token1Amount = ethers.utils.formatUnits(result.toString(), 'ether')

      setToken1Amount(_token1Amount)
    }
  }

  const depositHandler = async (e) => {
    e.preventDefault()

    if (!amm) {
      window.alert('AMM contract not loaded. Please try refreshing the page.')
      return
    }

    if (!token1Amount || !token2Amount || 
        parseFloat(token1Amount) <= 0 || 
        parseFloat(token2Amount) <= 0) {
      window.alert('Please enter valid amounts for both tokens')
      return
    }

    setShowAlert(false)

    try {
      const _token1Amount = ethers.utils.parseUnits(token1Amount, 'ether')
      const _token2Amount = ethers.utils.parseUnits(token2Amount, 'ether')

      console.log('Adding liquidity with amounts:', {
        token1: token1Amount,
        token2: token2Amount
      })

      const tx = await addLiquidity(
        provider,
        ammState,
        tokens,
        [_token1Amount, _token2Amount],
        dispatch
      )

      if (tx) {
        console.log('Liquidity added successfully, updating balances...')
        await loadBalances(ammState, tokens, account, dispatch)
        setShowAlert(true)
        
        // Reset form after successful deposit
        setToken1Amount('0')
        setToken2Amount('0')
      }
    } catch (error) {
      console.error('Deposit error:', error)
      window.alert(`Deposit failed: ${error.message || 'Unknown error occurred'}`)
    }
  }

  return (
    <div>
      <Card style={{ maxWidth: '450px' }} className='mx-auto px-4'>
        {account ? (
          <Form onSubmit={depositHandler} style={{ maxWidth: '450px', margin: '50px auto' }}>

            <Row>
              <Form.Text className='text-end my-2' muted>
                Balance: {balances[0]}
              </Form.Text>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="0.0"
                  min="0.0"
                  step="any"
                  id="token1"
                  onChange={(e) => amountHandler(e)}
                  value={token1Amount === 0 ? "" : token1Amount}
                />
                <InputGroup.Text style={{ width: "100px" }} className="justify-content-center">
                  { symbols && symbols[0] }
                </InputGroup.Text>
              </InputGroup>
            </Row>

            <Row className='my-3'>
              <Form.Text className='text-end my-2' muted>
                Balance:  {balances[1]}
              </Form.Text>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="0.0"
                  step="any"
                  id="token2"
                  onChange={(e) => amountHandler(e)}
                  value={token2Amount === 0 ? "" : token2Amount}
                />
                <InputGroup.Text style={{ width: "100px" }} className="justify-content-center">
                  { symbols && symbols[1] }
                </InputGroup.Text>
              </InputGroup>
            </Row>

            <Row className='my-3'>
              {isDepositing ? (
                <Spinner animation="border" style={{ display: 'block', margin: '0 auto' }} />
              ) : (
                <Button type="submit">Deposit</Button>
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

      {isDepositing ? (
        <Alert
          message={'Deposit Pending...'}
          transactionHash={null}
          variant={'info'}
          setShowAlert={setShowAlert}
        />
      ) : isSuccess && showAlert ? (
        <Alert
          message={'Deposit Successful'}
          transactionHash={transactionHash}
          variant={'success'}
          setShowAlert={setShowAlert}
        />
      ) : !isSuccess && showAlert ? (
        <Alert
          message={'Deposit Failed'}
          transactionHash={null}
          variant={'danger'}
          setShowAlert={setShowAlert}
        />
      ) : (
        <></>
      )}

    </div>
  );
}

export default Deposit;
