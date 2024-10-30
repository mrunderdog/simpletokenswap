import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3React } from '@web3-react/core';
import { ethers } from 'ethers';
import { SEPOLIA_CHAIN_ID, CONTRACT_ADDRESS, CONTRACT_ABI } from '../App';
import './TokenExchange.css';

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  },
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ name: "remaining", type: "uint256" }],
    type: "function"
  },
];

const TOKENS = {
  ETH: { symbol: 'ETH', name: 'Ethereum', decimals: 18, price: 1000 },
  gUSDC: { symbol: 'gUSDC', name: 'gUSDC', address: '0x37B118a528AAD5a22259AFfa21c34254fDa2B60c', decimals: 18, price: 1 },
  gUSDT: { symbol: 'gUSDT', name: 'gUSDT', address: '0xeB06441f880F5948e80Ae62042687b4dE22124f2', decimals: 18, price: 1 },
  gKIP: { symbol: 'gKIP', name: 'gKIP', address: '0x4B5bA223e2f5e4c746C5F714fAD6D641Ef195a5B', decimals: 18, price: 0.00012 },
};

function TokenExchange({ checkAndSwitchNetwork, switchToSepolia }) {
  const { active, library, account, chainId } = useWeb3React();
  const [inputToken, setInputToken] = useState('ETH');
  const [outputToken, setOutputToken] = useState('gKIP');
  const [inputAmount, setInputAmount] = useState('0');
  const [outputAmount, setOutputAmount] = useState('');
  const [balances, setBalances] = useState({});
  const [error, setError] = useState('');
  const [isExchanging, setIsExchanging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);

  const updateBalances = useCallback(async () => {
    if (!active || !library || !account) return;

    const newBalances = {};
    for (const [symbol, token] of Object.entries(TOKENS)) {
      if (symbol === 'ETH') {
        const balance = await library.getBalance(account);
        newBalances[symbol] = ethers.utils.formatEther(balance);
      } else {
        try {
          const tokenContract = new ethers.Contract(token.address, ERC20_ABI, library.getSigner());
          const balance = await tokenContract.balanceOf(account);
          newBalances[symbol] = ethers.utils.formatUnits(balance, token.decimals);
        } catch (error) {
          console.error(`Error fetching balance for ${symbol}:`, error);
          newBalances[symbol] = '0';
        }
      }
    }
    setBalances(newBalances);
  }, [active, library, account]);

  useEffect(() => {
    if (active && library) {
      const init = async () => {
        const result = await checkAndSwitchNetwork();
        if (result) {
          await updateBalances();
        } else {
          console.warn('Failed to switch network');
        }
      };
      init();
    }
  }, [active, library, checkAndSwitchNetwork, updateBalances]);

  useEffect(() => {
    calculateOutputAmount();
  }, [inputAmount, inputToken, outputToken]);

  const calculateOutputAmount = () => {
    if (!inputAmount || !TOKENS[inputToken] || !TOKENS[outputToken]) {
      setOutputAmount('0.0000');
      return;
    }
    
    const inputValue = parseFloat(inputAmount);
    let outputAmount;

    if (inputToken === 'ETH') {
      if (outputToken === 'gUSDC' || outputToken === 'gUSDT') {
        outputAmount = inputValue;
      } else if (outputToken === 'gKIP') {
        outputAmount = (inputValue / 0.001) * 8.333333333;
      }
    } else if (outputToken === 'ETH') {
      if (inputToken === 'gUSDC' || inputToken === 'gUSDT') {
        outputAmount = inputValue;
      } else if (inputToken === 'gKIP') {
        outputAmount = (inputValue / 8.333333333) * 0.001;
      }
    } else {
      let ethValue;
      if (inputToken === 'gUSDC' || inputToken === 'gUSDT') {
        ethValue = inputValue;
      } else if (inputToken === 'gKIP') {
        ethValue = (inputValue / 8.333333333) * 0.001;
      }

      if (outputToken === 'gUSDC' || outputToken === 'gUSDT') {
        outputAmount = ethValue;
      } else if (outputToken === 'gKIP') {
        outputAmount = (ethValue / 0.001) * 8.333333333;
      }
    }

    console.log('Calculation:', { 
      inputAmount,
      inputToken,
      outputToken,
      outputAmount
    });
    
    setOutputAmount(outputAmount.toFixed(6));
  };

  const handleInputTokenChange = (e) => {
    const newInputToken = e.target.value;
    setInputToken(newInputToken);
    
    if (newInputToken === outputToken) {
      const newOutputToken = Object.keys(TOKENS).find(token => token !== newInputToken);
      setOutputToken(newOutputToken);
    }

    setInputAmount('0');
    setOutputAmount('0.0000');
  };

  const handleOutputTokenChange = (e) => {
    const newOutputToken = e.target.value;
    setOutputToken(newOutputToken);
    
    if (newOutputToken === inputToken) {
      const newInputToken = Object.keys(TOKENS).find(token => token !== newOutputToken);
      setInputToken(newInputToken);
    }

    setInputAmount('0');
    setOutputAmount('0.0000');
  };

  const handleExchange = async () => {
    if (!await checkAndSwitchNetwork()) {
      setErrorMessage('Please switch to the Sepolia network to proceed.');
      return;
    }

    if (!active || !library) {
      setErrorMessage('Please connect your wallet first');
      return;
    }

    if (parseFloat(inputAmount) > parseFloat(balances[inputToken])) {
      setErrorMessage(`Insufficient ${inputToken} balance`);
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    setIsExchanging(true);

    try {
      const signer = library.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      let tx;
      const gasLimit = ethers.utils.hexlify(300000);

      if (inputToken === 'ETH') {
        tx = await contract.exchangeETHForToken(TOKENS[outputToken].address, {
          value: ethers.utils.parseEther(inputAmount),
          gasLimit: gasLimit
        });
      } else if (outputToken === 'ETH') {
        const tokenContract = new ethers.Contract(TOKENS[inputToken].address, ERC20_ABI, signer);
        const amount = ethers.utils.parseUnits(inputAmount, TOKENS[inputToken].decimals);
        
        await approveToken(tokenContract, amount);

        tx = await contract.exchangeTokenForETH(TOKENS[inputToken].address, amount, {
          gasLimit: gasLimit
        });
      } else {
        const tokenContract = new ethers.Contract(TOKENS[inputToken].address, ERC20_ABI, signer);
        const amount = ethers.utils.parseUnits(inputAmount, TOKENS[inputToken].decimals);
        
        await approveToken(tokenContract, amount);

        tx = await contract.exchangeTokens(TOKENS[inputToken].address, TOKENS[outputToken].address, amount, {
          gasLimit: gasLimit
        });
      }

      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt.transactionHash);

      setTransactions(prev => [{
        hash: receipt.transactionHash,
        from: inputToken,
        to: outputToken,
        amount: inputAmount
      }, ...prev.slice(0, 4)]);

      alert('Exchange successful!');
      await updateBalances();
    } catch (error) {
      console.error('Exchange failed:', error);
      handleError(error);
    } finally {
      setIsLoading(false);
      setIsExchanging(false);
    }
  };

  const approveToken = async (tokenContract, amount) => {
    const allowance = await tokenContract.allowance(await tokenContract.signer.getAddress(), CONTRACT_ADDRESS);
    if (allowance.lt(amount)) {
      const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, amount);
      await approveTx.wait();
    }
  };

  const handleError = (error) => {
    if (error.code === 4001) {
      setErrorMessage('Transaction was rejected. Please try again.');
    } else if (error.message.includes('insufficient funds')) {
      setErrorMessage('Insufficient funds for this transaction. Please check your balance.');
    } else if (error.message.includes('gas required exceeds allowance')) {
      setErrorMessage('Transaction may fail. Try increasing gas limit.');
    } else {
      setErrorMessage(`Exchange failed: ${error.message}`);
    }
  };

  const setMaxAmount = () => {
    if (inputToken === 'ETH') {
      const maxAmount = parseFloat(balances[inputToken]) - 0.01;
      setInputAmount(maxAmount > 0 ? maxAmount.toString() : '0');
    } else {
      setInputAmount(balances[inputToken]);
    }
  };

  return (
    <div className="exchange-container">
      <h2>Swap</h2>
      <div className="swap-box">
        <div className="token-input">
          <div className="token-select">
            <select 
              value={inputToken} 
              onChange={handleInputTokenChange}
            >
              {Object.keys(TOKENS).map(token => (
                <option key={token} value={token}>{TOKENS[token].name}</option>
              ))}
            </select>
          </div>
          <input
            type="number"
            value={inputAmount}
            onChange={(e) => {
              setInputAmount(e.target.value === '' ? '0' : e.target.value);
              setError('');
            }}
            placeholder="0.0"
          />
          <button onClick={setMaxAmount} className="max-button">MAX</button>
        </div>
        <p className="balance">Balance: {active ? parseFloat(balances[inputToken]).toFixed(4) : '0.0000'} {inputToken}</p>
        
        <div className="swap-icon">↓</div>
        
        <div className="token-input">
          <div className="token-select">
            <select 
              value={outputToken} 
              onChange={handleOutputTokenChange}
            >
              {Object.keys(TOKENS).filter(token => token !== inputToken).map(token => (
                <option key={token} value={token}>{TOKENS[token].name}</option>
              ))}
            </select>
          </div>
          <input
            type="number"
            value={outputAmount || '0.0000'}
            readOnly
            placeholder="0.0000"
          />
        </div>
      </div>
      
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      
      <button 
        onClick={handleExchange} 
        disabled={!active || !inputAmount || parseFloat(inputAmount) > parseFloat(balances[inputToken]) || isExchanging}
        className="swap-button"
      >
        {isLoading ? 'Processing...' : 'Swap'}
      </button>

      {isLoading && <div className="loader">Loading...</div>}

      <div className="transaction-history">
        <h3>Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p>No recent transactions</p>
        ) : (
          <ul>
            {transactions.map((tx, index) => (
              <li key={index}>
                {tx.from} to {tx.to}: {tx.amount}
                <a href={`https://sepolia.etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">View</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TokenExchange;