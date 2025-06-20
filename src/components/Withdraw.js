import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Modal from 'react-bootstrap/Modal';
import { ethers } from 'ethers'

import Alert from './Alert'

import {
  removeLiquidity,
  loadBalances
} from '../store/interactions'

const Withdraw = () => {
  const [amount, setAmount] = useState('')
  const [showAlert, setShowAlert] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [estimatedAmounts, setEstimatedAmounts] = useState({ 
    kel: '0', 
    usd: '0',
    poolPercentage: '0'
  })

  const provider = useSelector(state => state.provider.connection)
  const account = useSelector(state => state.provider.account)

  const shares = useSelector(state => state.amm.shares)

  const tokens = useSelector(state => state.tokens.contracts)
  const balances = useSelector(state => state.tokens.balances)

  const ammState = useSelector(state => state.amm)
  const amm = ammState?.amm1?.contract
  const isWithdrawing = useSelector(state => state.amm.withdrawing.isWithdrawing)

  const dispatch = useDispatch()

  // Load balances when component mounts or account changes
  useEffect(() => {
    const loadComponentData = async () => {
      if (amm && tokens && account) {
        try {
          await loadBalances(amm, tokens, account, dispatch)
        } catch (error) {
          console.error('Error loading balances:', error)
        }
      }
    }
    
    loadComponentData()
  }, [account, amm, tokens, dispatch])


  // Format token amounts with specified decimal places, safely handle BigNumber and strings
  const formatTokenAmount = (amount, decimals = 4) => {
    try {
      // Handle null/undefined/empty string
      if (!amount) return '0'
      
      // Convert to string and trim
      const strAmount = amount.toString().trim()
      
      // Handle zero or empty string
      if (strAmount === '0' || strAmount === '0.0' || strAmount === '0.00' || strAmount === '0.000' || strAmount === '0.0000') {
        return '0'
      }
      
      // If it's a BigNumber, format it
      if (ethers.BigNumber.isBigNumber(amount)) {
        const formatted = ethers.utils.formatUnits(amount, 'ether')
        const num = parseFloat(formatted)
        return isNaN(num) ? '0' : num.toFixed(decimals).replace(/\.?0+$/, '')
      }
      
      // If it's a string or number, format it
      const num = parseFloat(strAmount)
      if (isNaN(num)) return '0'
      
      // Format with specified decimals and remove trailing zeros
      return num.toFixed(decimals).replace(/\.?0+$/, '')
    } catch (error) {
      console.error('Error formatting token amount:', error)
      return '0'
    }
  }

  // Calculate estimated token amounts and pool percentage
  const calculateEstimatedAmounts = async (shares) => {
    try {
      // Validate input
      if (!amm) {
        setEstimatedAmounts({ kel: '0', usd: '0', poolPercentage: '0' })
        return
      }
      
      // Convert to string and clean input
      const sharesStr = shares?.toString().trim() || '0'
      if (sharesStr === '' || sharesStr === '.' || isNaN(parseFloat(sharesStr)) || parseFloat(sharesStr) <= 0) {
        setEstimatedAmounts({ kel: '0', usd: '0', poolPercentage: '0' })
        return
      }

      // Parse shares to BigNumber
      let _shares
      try {
        _shares = ethers.utils.parseUnits(sharesStr, 'ether')
      } catch (e) {
        console.error('Error parsing shares:', e)
        setEstimatedAmounts({ kel: '0', usd: '0', poolPercentage: '0' })
        return
      }

      // Calculate withdrawal amounts
      let kelAmount, usdAmount
      try {
        [kelAmount, usdAmount] = await amm.calculateWithdrawAmount(_shares)
      } catch (e) {
        console.error('Error calculating withdraw amounts:', e)
        setEstimatedAmounts({ kel: '0', usd: '0', poolPercentage: '0' })
        return
      }
      
      // Calculate pool percentage
      let poolPercentage = '0'
      try {
        const totalShares = await amm.totalShares()
        if (totalShares.gt(0)) {
          const percentage = _shares.mul(10000).div(totalShares).toNumber() / 100
          poolPercentage = percentage.toFixed(2)
        }
      } catch (e) {
        console.error('Error calculating pool percentage:', e)
      }
      
      // Update state with formatted values
      setEstimatedAmounts({
        kel: formatTokenAmount(kelAmount, 6),
        usd: formatTokenAmount(usdAmount, 6),
        poolPercentage: poolPercentage
      })
    } catch (error) {
      console.error('Error calculating estimated amounts:', error)
      setEstimatedAmounts({ kel: '0', usd: '0', poolPercentage: '0' })
    }
  }

  const handleAmountChange = (value) => {
    // Only allow numbers and one decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
      
      // Don't calculate if empty or just a decimal point
      if (value === '' || value === '.') {
        setEstimatedAmounts({ kel: '0', usd: '0', poolPercentage: '0' })
        return
      }
      
      const numValue = parseFloat(value)
      // Only calculate if we have a valid positive number
      if (!isNaN(numValue) && numValue > 0) {
        calculateEstimatedAmounts(value)
      } else {
        setEstimatedAmounts({ kel: '0', usd: '0', poolPercentage: '0' })
      }
    }
  }

  // Set max shares
  const setMaxShares = () => {
    if (shares && shares.gt(0)) {
      const formattedShares = ethers.utils.formatUnits(shares, 'ether')
      setAmount(formattedShares)
      calculateEstimatedAmounts(formattedShares)
    }
  }

  // Handle confirmation modal
  const handleConfirmation = (e) => {
    e.preventDefault()
    if (amount && !isNaN(amount) && amount > 0) {
      setShowConfirmModal(true)
    }
  }

  // Handle actual withdrawal after confirmation
  const confirmWithdraw = async () => {
    setShowConfirmModal(false)
    await executeWithdraw()
  }

  // Execute the withdrawal
  const executeWithdraw = async () => {
    if (!amm || !amount || isNaN(amount) || amount <= 0) {
      setShowAlert({
        show: true,
        message: 'Invalid withdrawal amount',
        variant: 'danger'
      })
      return
    }

    try {
      setShowAlert({ show: false })
      const _shares = ethers.utils.parseUnits(amount.toString(), 'ether')
      
      // Check if user has enough shares
      const userShares = await amm.shares(account)
      if (_shares.gt(userShares)) {
        setShowAlert({
          show: true,
          message: `Insufficient shares. You have ${ethers.utils.formatUnits(userShares, 'ether')} shares.`,
          variant: 'danger'
        })
        return
      }

      console.log('Initiating withdrawal of', amount, 'shares')
      const receipt = await removeLiquidity(
        provider,
        ammState,
        _shares,
        dispatch
      )

      // Refresh balances
      await loadBalances(ammState, tokens, account, dispatch)

      setShowAlert({
        show: true,
        message: 'Withdrawal successful!',
        variant: 'success',
        transactionHash: receipt.transactionHash
      })
      
      // Reset form
      setAmount('')
      setEstimatedAmounts({ kel: '0', usd: '0', poolPercentage: '0' })
      
    } catch (error) {
      console.error('Withdrawal error:', error)
      setShowAlert({
        show: true,
        message: `Withdrawal failed: ${error.message || 'Unknown error'}`,
        variant: 'danger'
      })
    }
  }

  const withdrawHandler = async (e) => {
    e.preventDefault()
    if (!amm) {
      console.warn('AMM contract not loaded yet')
      setShowAlert({
        show: true,
        message: 'AMM contract not loaded. Please try again.',
        variant: 'danger'
      })
      return
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      setShowAlert({
        show: true,
        message: 'Please enter a valid amount of shares to withdraw',
        variant: 'danger'
      })
      return
    }

    handleConfirmation(e)
  }

  return (
    <div>
      <Card style={{ maxWidth: '450px' }} className='mx-auto px-4'>
        {account ? (
          <Form onSubmit={withdrawHandler} style={{ maxWidth: '450px', margin: '50px auto' }}>

            <Row>
              <Form.Text className='text-end my-2' muted>
                Shares: {shares ? formatTokenAmount(shares, 6) : '0'}
              </Form.Text>
              <InputGroup className="mb-2">
                <Form.Control
                  type="number"
                  placeholder="0"
                  min="0.000000000000000001"
                  step="any"
                  id="shares"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  isInvalid={amount && (isNaN(amount) || amount <= 0)}
                  className="text-end"
                />
                <InputGroup.Text className="justify-content-center" style={{ width: '80px' }}>
                  Shares
                </InputGroup.Text>
                <Button 
                  variant="outline-secondary" 
                  onClick={setMaxShares}
                  style={{ width: '60px' }}
                >
                  Max
                </Button>
              </InputGroup>
              <div className="d-flex justify-content-between mb-3">
                <small className="text-muted">
                  Available: {shares ? formatTokenAmount(shares, 4) : '0'}
                </small>
                {estimatedAmounts.poolPercentage > 0 && (
                  <small className="text-muted">
                    {estimatedAmounts.poolPercentage}% of pool
                  </small>
                )}
              </div>
              
              {amount > 0 && (
                <div className="mb-3 p-3" style={{ 
                  backgroundColor: 'rgba(13, 110, 253, 0.05)', 
                  borderRadius: '8px',
                  border: '1px solid rgba(13, 110, 253, 0.1)'
                }}>
                  <div className="text-center mb-2">
                    <small className="text-muted">You will receive approximately</small>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center">
                      <div className="me-2" style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#1b5e20' }}></div>
                      <span>KEL</span>
                    </div>
                    <span className="fw-bold">{parseFloat(estimatedAmounts.kel).toFixed(4)}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <div className="me-2" style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#198754' }}></div>
                      <span>USD</span>
                    </div>
                    <span className="fw-bold">{parseFloat(estimatedAmounts.usd).toFixed(4)}</span>
                  </div>
                </div>
              )}
            </Row>

            <Row className='my-3'>
              <Button 
                type="submit" 
                variant="primary" 
                className="w-100 py-2"
                disabled={isWithdrawing || !amount || isNaN(amount) || amount <= 0}
              >
                {isWithdrawing ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Withdrawing...
                  </>
                ) : 'Withdraw'}
              </Button>
            </Row>

            <hr />

            <Row className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="d-flex align-items-center">
                  <div className="me-2" style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#1b5e20' }}></div>
                  <span>KEL Balance:</span>
                </div>
                <span className="fw-bold">
                  {balances && balances[0] ? formatTokenAmount(balances[0], 4) : '0'}
                </span>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <div className="me-2" style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#198754' }}></div>
                  <span>USD Balance:</span>
                </div>
                <span className="fw-bold">
                  {balances && balances[1] ? formatTokenAmount(balances[1], 2) : '0'}
                </span>
              </div>
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

      {showAlert?.show && (
        <Alert 
          message={
            showAlert.variant === 'success' 
              ? 'Withdraw Successful' 
              : showAlert.variant === 'danger' 
                ? `Error: ${showAlert.message}`
                : showAlert.message
          }
          transactionHash={showAlert.transactionHash}
          variant={showAlert.variant || 'info'}
          setShowAlert={() => setShowAlert({ ...showAlert, show: false })}
        />
      )}
      
      {isWithdrawing && (
        <div className="text-center my-3">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Processing withdrawal...</p>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Withdrawal</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3">You are about to withdraw:</p>
          
          <div className="mb-3 p-3" style={{ 
            backgroundColor: 'rgba(13, 110, 253, 0.05)', 
            borderRadius: '8px',
            border: '1px solid rgba(13, 110, 253, 0.1)'
          }}>
            <div className="text-center mb-3">
              <h5>{amount} Shares</h5>
              <small className="text-muted">({estimatedAmounts.poolPercentage}% of pool)</small>
            </div>
            
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="d-flex align-items-center">
                <div className="me-2" style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#1b5e20' }}></div>
                <span>KEL</span>
              </div>
              <span className="fw-bold">{parseFloat(estimatedAmounts.kel).toFixed(4)}</span>
            </div>
            
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <div className="me-2" style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#198754' }}></div>
                <span>USD</span>
              </div>
              <span className="fw-bold">{parseFloat(estimatedAmounts.usd).toFixed(4)}</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-muted small">
              <i className="bi bi-info-circle me-1"></i>
              You will receive both tokens based on the current pool ratio.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <Button variant="outline-secondary" onClick={() => setShowConfirmModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirmWithdraw}>
            Confirm Withdrawal
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Withdraw;
