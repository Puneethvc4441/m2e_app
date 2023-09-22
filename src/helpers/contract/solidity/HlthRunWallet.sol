// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol'; 
import '@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol';

contract HlthRunWallet { 
    
    address public owner;
    address public constant routerAddress = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address public constant quoterAddress = 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6;
    
    ISwapRouter public immutable swapRouter = ISwapRouter(routerAddress);
    IQuoter public immutable quoter = IQuoter(quoterAddress);
    
    constructor() { 
        owner = msg.sender;
    }
    
    uint8 private constant _NOT_ENTERED = 1;
    uint8 private constant _ENTERED = 2; 
    uint8 private _status = _NOT_ENTERED; 

    uint24 public constant poolFee = 3000;
    event TransferReceived(address _from, uint256 _amount);
    event TransferCoin(address _from, address _destAddr, uint256 _amount);
    event TransferToken(address _from, address _destAddr, uint256 _amount);
 
    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier onlyOwner(){
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    receive() external payable{
        emit TransferReceived(msg.sender, msg.value);
    }

    function transferToken(address _tokenAddress, address _to, uint256 _amount) external onlyOwner nonReentrant { 
        IERC20 token = IERC20(_tokenAddress);
        require(token.balanceOf(address(this)) >= _amount, "Insufficient token balance");
        require(_to != address(0), "cannot transfer to zero address");
        require(token.transfer(_to, _amount), "Token transfer failed");
        emit TransferToken(msg.sender, _to, _amount); 
    }

    function transferCoin(uint256 _amount, address payable _to) external onlyOwner nonReentrant{
        require(address(this).balance >= _amount, "Insufficient funds of Polygon in the contract for withdrawl");
        require(_to != address(0), "cannot withdraw to zero address");
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "withdrawl failed");
        emit TransferCoin(msg.sender, _to, _amount);
    }

    // Swapping funcitonality     

    function swapExactInputSingleHop(uint256 tokenAmountIn, address _tokenInAddress, address _tokenOutAddress) external returns (uint256 amountOut) {
        // msg.sender must approve this contract

        // Transfer the specified amount of DAI to this contract.
        TransferHelper.safeTransferFrom(_tokenInAddress, msg.sender, address(this), tokenAmountIn);

        // Approve the router to spend DAI.
        TransferHelper.safeApprove(_tokenInAddress, address(swapRouter), tokenAmountIn); 

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: _tokenInAddress,
                tokenOut: _tokenOutAddress,
                fee: poolFee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: tokenAmountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
        // The call to `exactInputSingle` executes the swap.
        amountOut = swapRouter.exactInputSingle(params);
    }

    function swapExactInputMultiHop(uint256 tokenAmountIn, address _tokenInAddress, address _tokenMiddleAddress, address _tokenOutAddress) external returns (uint256 amountOut) {
       
        TransferHelper.safeTransferFrom(_tokenInAddress, msg.sender, address(this), tokenAmountIn); 
        
        TransferHelper.safeApprove(_tokenInAddress, address(swapRouter), tokenAmountIn);

         ISwapRouter.ExactInputParams memory params =
            ISwapRouter.ExactInputParams({
                path: abi.encodePacked(_tokenInAddress, poolFee, _tokenMiddleAddress, poolFee, _tokenOutAddress),
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: tokenAmountIn,
                amountOutMinimum: 0
            });

        // Executes the swap.
        amountOut = swapRouter.exactInput(params);
    } 

    function getEstimatedSingleHop(uint _tokenInAmount, address _tokenInAddress, address _tokenOutAddress) external returns (uint256) {
       
        return quoter.quoteExactInputSingle(
            _tokenInAddress,
            _tokenOutAddress,
            poolFee,
            _tokenInAmount,
            0
        );
    }

    function getEstimatedMultiHop(uint _tokenInAmount, address _tokenInAddress, address _tokenMiddleAddress, address _tokenOutAddress) external returns (uint256) {
     
        bytes memory path = abi.encodePacked(_tokenInAddress, poolFee, _tokenMiddleAddress, poolFee, _tokenOutAddress);
         
        return quoter.quoteExactInput(path, _tokenInAmount);
    }

}
