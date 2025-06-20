import { createSlice } from '@reduxjs/toolkit'

export const amm = createSlice({
  name: 'amm',
  initialState: {
    amm1: { contract: null },
    amm2: { contract: null },
    amm3: { contract: null },
    aggregator: { contract: null },
    shares: 0,
    swaps: [],
    depositing: {
      isDepositing: false,
      isSuccess: false,
      transactionHash: null
    },
    withdrawing: {
      isWithdrawing: false,
      isSuccess: false,
      transactionHash: null
    },
    swapping: {
      isSwapping: false,
      isSuccess: false,
      transactionHash: null
    }
  },
  reducers: {
    setContract: (state, action) => {
      // Handle new format with { address, contract }
      if (action.payload.amm1) {
        state.amm1 = {
          ...state.amm1,
          ...action.payload.amm1,
          address: action.payload.amm1.address || state.amm1.address,
          contract: action.payload.amm1.contract || action.payload.amm1.contract
        }
      }
      
      if (action.payload.amm2) {
        state.amm2 = {
          ...state.amm2,
          ...action.payload.amm2,
          address: action.payload.amm2.address || state.amm2.address,
          contract: action.payload.amm2.contract || action.payload.amm2.contract
        }
      } else {
        state.amm2 = { contract: null, address: null }
      }
      
      if (action.payload.amm3) {
        state.amm3 = {
          ...state.amm3,
          ...action.payload.amm3,
          address: action.payload.amm3.address || state.amm3?.address,
          contract: action.payload.amm3.contract || action.payload.amm3.contract
        }
      } else {
        state.amm3 = { contract: null, address: null }
      }
      
      if (action.payload.aggregator) {
        state.aggregator = {
          ...state.aggregator,
          ...action.payload.aggregator,
          address: action.payload.aggregator.address || state.aggregator.address,
          contract: action.payload.aggregator.contract || action.payload.aggregator.contract
        }
      } else {
        state.aggregator = { contract: null, address: null }
      }
      
      console.log('AMM State Updated:', {
        amm1: { address: state.amm1?.address, hasContract: !!state.amm1?.contract },
        amm2: { address: state.amm2?.address, hasContract: !!state.amm2?.contract },
        aggregator: { address: state.aggregator?.address, hasContract: !!state.aggregator?.contract }
      })
    },
    sharesLoaded: (state, action) => {
      state.shares = action.payload
    },
    swapsLoaded: (state, action) => {
      state.swaps = action.payload
    },
    depositRequest: (state, action) => {
      state.depositing.isDepositing = true
      state.depositing.isSuccess = false
      state.depositing.transactionHash = null
    },
    depositSuccess: (state, action) => {
      state.depositing.isDepositing = false
      state.depositing.isSuccess = true
      state.depositing.transactionHash = action.payload
    },
    depositFail: (state, action) => {
      state.depositing.isDepositing = false
      state.depositing.isSuccess = false
      state.depositing.transactionHash = null
    },
    withdrawRequest: (state, action) => {
      state.withdrawing.isWithdrawing = true
      state.withdrawing.isSuccess = false
      state.withdrawing.transactionHash = null
    },
    withdrawSuccess: (state, action) => {
      state.withdrawing.isWithdrawing = false
      state.withdrawing.isSuccess = true
      state.withdrawing.transactionHash = action.payload
    },
    withdrawFail: (state, action) => {
      state.withdrawing.isWithdrawing = false
      state.withdrawing.isSuccess = false
      state.withdrawing.transactionHash = null
    },
    swapRequest: (state, action) => {
      state.swapping.isSwapping = true
      state.swapping.isSuccess = false
      state.swapping.transactionHash = null
    },
    swapSuccess: (state, action) => {
      state.swapping.isSwapping = false
      state.swapping.isSuccess = true
      state.swapping.transactionHash = action.payload
    },
    swapFail: (state, action) => {
      state.swapping.isSwapping = false
      state.swapping.isSuccess = false
      state.swapping.transactionHash = null
    }
  }
})

export const {
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
} = amm.actions;

export default amm.reducer;
