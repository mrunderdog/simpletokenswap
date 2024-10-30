// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract GKIPExchange is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    IERC20 public gkipToken;
    IERC20 public gusdcToken;
    IERC20 public gusdtToken;

    mapping(address => uint256) public tokenPrices;
    address[] public supportedTokens;

    event TokenExchanged(address indexed from, address indexed to, uint256 amountIn, uint256 amountOut);
    event PricesUpdated(uint256 ethPrice, uint256 gusdcPrice, uint256 gusdtPrice, uint256 gkipPrice);

    constructor(address _gkipToken, address _gusdcToken, address _gusdtToken) Ownable(msg.sender) {
        gkipToken = IERC20(_gkipToken);
        gusdcToken = IERC20(_gusdcToken);
        gusdtToken = IERC20(_gusdtToken);

        supportedTokens = [_gkipToken, _gusdcToken, _gusdtToken];

        // 초기 가격 설정
        tokenPrices[address(0)] = 1 ether; // ETH
        tokenPrices[_gusdcToken] = 1 ether;
        tokenPrices[_gusdtToken] = 1 ether;
        tokenPrices[_gkipToken] = 12 * 10**13; // 0.00012 ether
    }

    function updatePrices(uint256 ethPrice, uint256 gusdcPrice, uint256 gusdtPrice, uint256 gkipPrice) external onlyOwner {
        tokenPrices[address(0)] = ethPrice;
        tokenPrices[address(gusdcToken)] = gusdcPrice;
        tokenPrices[address(gusdtToken)] = gusdtPrice;
        tokenPrices[address(gkipToken)] = gkipPrice;

        emit PricesUpdated(ethPrice, gusdcPrice, gusdtPrice, gkipPrice);
    }

    function updatePrice(address token, uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be greater than zero");
        tokenPrices[token] = newPrice;
    }

    function exchangeTokens(address tokenIn, address tokenOut, uint256 amountIn) external nonReentrant {
        require(tokenIn != tokenOut, "Cannot exchange same token");
        require(isTokenSupported(tokenIn) && isTokenSupported(tokenOut), "Unsupported token");
        require(amountIn > 0, "Amount must be greater than zero");

        uint256 amountOut = calculateAmountOut(tokenIn, tokenOut, amountIn);
        require(amountOut > 0, "Invalid exchange amount");

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(msg.sender, amountOut);

        emit TokenExchanged(tokenIn, tokenOut, amountIn, amountOut);
    }

    function calculateAmountOut(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256) {
        uint256 priceIn = tokenPrices[tokenIn];
        uint256 priceOut = tokenPrices[tokenOut];
        return amountIn.mul(priceIn).div(priceOut);
    }

    function isTokenSupported(address token) public view returns (bool) {
        for (uint i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                return true;
            }
        }
        return false;
    }

    function exchangeETHForToken(address tokenOut) external payable nonReentrant {
        require(isTokenSupported(tokenOut), "Unsupported token");
        require(msg.value > 0, "Amount must be greater than zero");

        uint256 amountOut = calculateAmountOut(address(0), tokenOut, msg.value);
        require(amountOut > 0, "Invalid exchange amount");

        IERC20(tokenOut).transfer(msg.sender, amountOut);

        emit TokenExchanged(address(0), tokenOut, msg.value, amountOut);
    }

    function exchangeTokenForETH(address tokenIn, uint256 amountIn) external nonReentrant {
        require(isTokenSupported(tokenIn), "Unsupported token");
        require(amountIn > 0, "Amount must be greater than zero");

        uint256 ethAmount = calculateAmountOut(tokenIn, address(0), amountIn);
        require(ethAmount > 0, "Invalid exchange amount");
        require(address(this).balance >= ethAmount, "Insufficient ETH balance in contract");

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        payable(msg.sender).transfer(ethAmount);

        emit TokenExchanged(tokenIn, address(0), amountIn, ethAmount);
    }

    function withdrawToken(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
        IERC20(token).transfer(owner(), amount);
    }

    function withdrawETH(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        payable(owner()).transfer(amount);
    }

    receive() external payable {}
}