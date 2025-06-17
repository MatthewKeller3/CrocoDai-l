// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAMM {
    // View functions for price estimation
    function calculateToken1Swap(uint256 _token1Amount) external view returns (uint256 token2Amount);
    function calculateToken2Swap(uint256 _token2Amount) external view returns (uint256 token1Amount);
    
    // Getter functions for returns (used by aggregator)
    function getToken1EstimatedReturn(uint256 _token2Amount) external view returns (uint256);
    function getToken2EstimatedReturn(uint256 _token1Amount) external view returns (uint256); 
    
    // Swap functions
    function swapToken1(uint256 _token1Amount) external returns (uint256 token2Amount);
    function swapToken2(uint256 _token2Amount) external returns (uint256 token1Amount);
    
    // Token addresses
    function token1() external view returns (address);
    function token2() external view returns (address);
    
    // Balances
    function token1Balance() external view returns (uint256);
    function token2Balance() external view returns (uint256);
}