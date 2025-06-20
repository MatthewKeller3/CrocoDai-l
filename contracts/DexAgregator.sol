// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAMM.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DexAggregator {
    // AMM contract addresses
    address public amm1;
    address public amm2;
    address public amm3;
    
    // Token addresses
    address public token1;
    address public token2;
    
    event BestRouteFound(address indexed user, address bestDex, uint256 inputAmount, uint256 outputAmount);
    event SwapExecuted(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, address dexUsed);
    
    constructor(
        address _amm1,
        address _amm2,
        address _amm3,
        address _token1,
        address _token2
    ) {
        require(_amm1 != address(0) && _amm2 != address(0) && _amm3 != address(0), "Invalid AMM addresses");
        require(_token1 != address(0) && _token2 != address(0), "Invalid token addresses");
        require(_amm1 != _amm2 && _amm1 != _amm3 && _amm2 != _amm3, "AMM addresses must be unique");
        
        amm1 = _amm1;
        amm2 = _amm2;
        amm3 = _amm3;
        token1 = _token1;
        token2 = _token2;
    }
    
    // Check which AMM offers better rate for token1 -> token2
    function getBestRateToken1ToToken2(uint256 amount) public view returns (address bestDex, uint256 expectedReturn) {
        require(amount > 0, "Invalid amount");
        
        uint256 returnAmm1 = IAMM(amm1).getToken2EstimatedReturn(amount);
        uint256 returnAmm2 = IAMM(amm2).getToken2EstimatedReturn(amount);
        uint256 returnAmm3 = IAMM(amm3).getToken2EstimatedReturn(amount);
        
        if (returnAmm1 >= returnAmm2 && returnAmm1 >= returnAmm3) {
            return (amm1, returnAmm1);
        } else if (returnAmm2 >= returnAmm1 && returnAmm2 >= returnAmm3) {
            return (amm2, returnAmm2);
        } else {
            return (amm3, returnAmm3);
        }
    }
    
    // Check which AMM offers better rate for token2 -> token1
    function getBestRateToken2ToToken1(uint256 amount) public view returns (address bestDex, uint256 expectedReturn) {
        require(amount > 0, "Invalid amount");
        
        uint256 returnAmm1 = IAMM(amm1).getToken1EstimatedReturn(amount);
        uint256 returnAmm2 = IAMM(amm2).getToken1EstimatedReturn(amount);
        uint256 returnAmm3 = IAMM(amm3).getToken1EstimatedReturn(amount);
        
        if (returnAmm1 >= returnAmm2 && returnAmm1 >= returnAmm3) {
            return (amm1, returnAmm1);
        } else if (returnAmm2 >= returnAmm1 && returnAmm2 >= returnAmm3) {
            return (amm2, returnAmm2);
        } else {
            return (amm3, returnAmm3);
        }
    }
    
    // Swap token1 for token2 using the best AMM
    function swapToken1ForToken2(uint256 amount) external returns (uint256) {
        require(amount > 0, "Invalid amount");
        
        // Transfer tokens from user to this contract
        IERC20(token1).transferFrom(msg.sender, address(this), amount);
        
        // Get best rate
        (address bestDex, uint256 expectedReturn) = getBestRateToken1ToToken2(amount);
        require(expectedReturn > 0, "Insufficient output amount");
        
        // Approve AMM to spend tokens
        IERC20(token1).approve(bestDex, amount);
        
        // Execute swap on the best DEX
        uint256 received = IAMM(bestDex).swapToken1(amount);
        
        // Transfer received tokens to user
        IERC20(token2).transfer(msg.sender, received);
        
        emit SwapExecuted(msg.sender, token1, token2, amount, received, bestDex);
        return received;
    }
    
    // Swap token2 for token1 using the best AMM
    function swapToken2ForToken1(uint256 amount) external returns (uint256) {
        require(amount > 0, "Invalid amount");
        
        // Transfer tokens from user to this contract
        IERC20(token2).transferFrom(msg.sender, address(this), amount);
        
        // Get best rate
        (address bestDex, uint256 expectedReturn) = getBestRateToken2ToToken1(amount);
        require(expectedReturn > 0, "Insufficient output amount");
        
        // Approve AMM to spend tokens
        IERC20(token2).approve(bestDex, amount);
        
        // Execute swap on the best DEX
        uint256 received = IAMM(bestDex).swapToken2(amount);
        
        // Transfer received tokens to user
        IERC20(token1).transfer(msg.sender, received);
        
        emit SwapExecuted(msg.sender, token2, token1, amount, received, bestDex);
        return received;
    }
}