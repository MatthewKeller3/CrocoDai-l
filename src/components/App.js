import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Container, Row, Col, Card } from 'react-bootstrap'

// Components
import Navigation from './Navigation';
import Tabs from './Tabs';
import Swap from './Swap';
import Deposit from './Deposit';
import Withdraw from './Withdraw';
import Charts from './Charts';
import Aggregator from './Aggregator';

import {
  loadProvider,
  loadNetwork,
  loadAccount,
  loadTokens,
  loadAMM
} from '../store/interactions'

function App() {

  const dispatch = useDispatch()

  const loadBlockchainData = async () => {
    // Initiate provider
    const provider = await loadProvider(dispatch)

    // Fetch current network's chainId (e.g. hardhat: 31337, kovan: 42)
    const chainId = await loadNetwork(provider, dispatch)

    // Reload page when network changes
    window.ethereum.on('chainChanged', () => {
      window.location.reload()
    })

    // Fetch current account from Metamask when changed
    window.ethereum.on('accountsChanged', async () => {
      await loadAccount(dispatch)
    })

    // Initiate contracts
    await loadTokens(provider, chainId, dispatch)
    await loadAMM(provider, chainId, dispatch)
  }

  useEffect(() => {
    loadBlockchainData()
  }, [loadBlockchainData]);

  return(
    <div className="app-wrapper" style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      paddingTop: '20px',
      paddingBottom: '40px'
    }}>
      <Container>
        <HashRouter>
          
          {/* Professional Header */}
          <Navigation />

          {/* Main Content Area */}
          <Row className="justify-content-center mt-4">
            <Col lg={10} xl={8}>
              
              {/* Hero Section */}
              <Card className="mb-4 shadow-lg border-0" style={{ 
                background: 'rgba(255, 255, 255, 0.95)', 
                backdropFilter: 'blur(10px)',
                borderRadius: '20px'
              }}>
                <Card.Body className="text-center py-5">
                  <h1 className="display-4 fw-bold text-dark mb-3">
                    🚀 AlgoGator
                  </h1>
                  <p className="lead text-muted mb-4">
                    Advanced DEX Aggregator - Find the best rates across multiple AMMs
                  </p>
                  <div className="d-flex justify-content-center gap-3">
                    <span className="badge bg-primary fs-6 px-3 py-2">Multi-AMM Support</span>
                    <span className="badge bg-success fs-6 px-3 py-2">Best Rate Discovery</span>
                    <span className="badge bg-info fs-6 px-3 py-2">Low Fees</span>
                  </div>
                </Card.Body>
              </Card>

              {/* Navigation Tabs */}
              <Card className="mb-4 shadow border-0" style={{ 
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '15px'
              }}>
                <Card.Body className="px-4 py-3">
                  <Tabs />
                </Card.Body>
              </Card>

              {/* Main Trading Interface */}
              <Card className="shadow-lg border-0" style={{ 
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '20px',
                minHeight: '500px'
              }}>
                <Card.Body className="p-4">
                  <Routes>
                    <Route exact path="/" element={<Swap />} />
                    <Route path="/deposit" element={<Deposit />} />
                    <Route path="/withdraw" element={<Withdraw />} />
                    <Route path="/charts" element={<Charts />} />
                    <Route path="/aggregator" element={<Aggregator />} />
                  </Routes>
                </Card.Body>
              </Card>

            </Col>
          </Row>

          {/* Footer */}
          <Row className="mt-5">
            <Col className="text-center">
              <p className="text-white-50 mb-0">
                ⚡ Powered by Ethereum • Built with React & Hardhat
              </p>
            </Col>
          </Row>

        </HashRouter>
      </Container>
    </div>
  )
}

export default App;
