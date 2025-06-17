import { useSelector, useDispatch } from 'react-redux'
import Navbar from 'react-bootstrap/Navbar';
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Blockies from 'react-blockies'

import { loadAccount, loadBalances } from '../store/interactions'

import config from '../config.json'

const Navigation = () => {
  const chainId = useSelector(state => state.provider.chainId)
  const account = useSelector(state => state.provider.account)
  const tokens = useSelector(state => state.tokens.contracts)
  const amm = useSelector(state => state.amm)

  const dispatch = useDispatch()

  const connectHandler = async () => {
    const account = await loadAccount(dispatch)
    
    // Only load balances if AMM contracts are available
    if (amm && amm.amm1 && tokens && tokens.length >= 2) {
      await loadBalances(amm, tokens, account, dispatch)
    } else {
      console.warn('AMM contracts or tokens not yet loaded')
    }
  }

  const networkHandler = async (e) => {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: e.target.value }],
    })
  }

  return (
    <Navbar 
      className="shadow-sm border-0" 
      expand="lg"
      style={{ 
        background: 'rgba(255, 255, 255, 0.95)', 
        backdropFilter: 'blur(10px)',
        borderRadius: '15px',
        padding: '15px 25px'
      }}
    >
      
      {/* Professional Logo & Brand */}
      <div className="d-flex align-items-center">
        <div 
          className="d-flex align-items-center justify-content-center me-3"
          style={{
            width: '50px',
            height: '50px',
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            borderRadius: '12px',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold'
          }}
        >
          🐊
        </div>
        <div>
          <Navbar.Brand 
            href="#" 
            className="mb-0 fw-bold"
            style={{ 
              fontSize: '24px',
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            AlgoGator
          </Navbar.Brand>
          <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '-5px' }}>
            DEX Aggregator Platform
          </div>
        </div>
      </div>

      <Navbar.Toggle aria-controls="nav" />
      <Navbar.Collapse id="nav" className="justify-content-end">

        <div className="d-flex align-items-center gap-3">

          {/* Network Selector */}
          <div className="d-flex flex-column">
            <small className="text-muted mb-1">Network</small>
            <Form.Select
              aria-label="Network Selector"
              value={config[chainId] ? `0x${chainId.toString(16)}` : `0`}
              onChange={networkHandler}
              style={{ 
                maxWidth: '180px',
                borderRadius: '10px',
                border: '2px solid #e9ecef',
                fontSize: '14px'
              }}
            >
              <option value="0" disabled>Select Network</option>
              <option value="0x7A69">Localhost 8545</option>
              <option value="0x1">Ethereum</option>
              <option value="0xaa36a7">Sepolia</option>
            </Form.Select>
          </div>

          {/* Account Info */}
          {account ? (
            <div className="d-flex flex-column align-items-end">
              <small className="text-muted mb-1">Connected</small>
              <div 
                className="px-3 py-2 rounded-pill"
                style={{ 
                  background: 'linear-gradient(45deg, #28a745, #20c997)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {account.slice(0, 5) + '...' + account.slice(38, 42)}
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column">
              <small className="text-muted mb-1">Wallet</small>
              <Button 
                onClick={connectHandler}
                style={{
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                Connect Wallet
              </Button>
            </div>
          )}

        </div>
      </Navbar.Collapse>
    </Navbar>
  )
}

export default Navigation;
