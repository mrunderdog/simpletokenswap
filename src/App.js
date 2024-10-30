import React, { useEffect, useCallback, useState } from 'react';
import { useWeb3React } from '@web3-react/core';
import { InjectedConnector } from '@web3-react/injected-connector';
import { ethers } from 'ethers';
import TokenExchange from './components/TokenExchange';
import './App.css';

export const SEPOLIA_CHAIN_ID = 11155111;
export const CONTRACT_ADDRESS = '0x52E3A076DdA8816eaFBB16c8b5a3b91C8e4E6fa0';
export const CONTRACT_ABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "tokenOut",
				"type": "address"
			}
		],
		"name": "exchangeETHForToken",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "tokenIn",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "tokenOut",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amountIn",
				"type": "uint256"
			}
		],
		"name": "exchangeTokens",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "tokenIn",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amountIn",
				"type": "uint256"
			}
		],
		"name": "exchangeTokenForETH",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
];

const injected = new InjectedConnector({
  supportedChainIds: [SEPOLIA_CHAIN_ID]
});

function App() {
  const { active, account, activate, deactivate, chainId, library } = useWeb3React();
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', (chainId) => {
        if (parseInt(chainId, 16) === SEPOLIA_CHAIN_ID) {
          activate(injected);
        }
      });
    }
    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, [activate]);

  useEffect(() => {
    if (active && chainId !== SEPOLIA_CHAIN_ID) {
      checkAndSwitchNetwork();
    }
  }, [active, chainId]);

  const handleAccountsChanged = useCallback((accounts) => {
    if (accounts.length > 0 && account !== accounts[0]) {
      activate(injected);
    } else {
      deactivate();
    }
  }, [account, activate, deactivate]);

  useEffect(() => {
    const { ethereum } = window;
    if (ethereum && ethereum.on) {
      ethereum.on('accountsChanged', handleAccountsChanged);
    }

    return () => {
      if (ethereum && ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [handleAccountsChanged]);

  async function connect() {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      await activate(injected, undefined, true);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      const connectedChainId = network.chainId;
      
      if (connectedChainId !== SEPOLIA_CHAIN_ID) {
        console.log('Connected to unsupported network. Attempting to switch to Sepolia...');
        const userConfirmed = window.confirm("This application requires Sepolia network. Do you want to switch to Sepolia?");
        if (userConfirmed) {
          const switched = await checkAndSwitchNetwork();
          if (!switched) {
            console.log('Failed to switch to Sepolia');
            alert("Failed to switch to Sepolia network. Please switch manually in your wallet and try connecting again.");
            await deactivate();
          } else {
            console.log('Successfully switched to Sepolia');
          }
        } else {
          console.log('User declined to switch network');
          alert("This application requires Sepolia network. Please switch to Sepolia and try connecting again.");
          await deactivate();
        }
      } else {
        console.log('Already on Sepolia network');
      }
    } catch (ex) {
      console.error('Failed to connect:', ex);
      if (ex.name === 'UnsupportedChainIdError') {
        const userConfirmed = window.confirm("You're connected to an unsupported network. Do you want to switch to Sepolia?");
        if (userConfirmed) {
          const switched = await checkAndSwitchNetwork();
          if (!switched) {
            alert("Failed to switch to Sepolia network. Please switch manually in your wallet and try connecting again.");
          }
        } else {
          alert("This application requires Sepolia network. Please switch to Sepolia and try connecting again.");
        }
      } else {
        alert("Failed to connect. Please make sure you have MetaMask installed and try again.");
      }
    } finally {
      setIsConnecting(false);
    }
  }

  async function disconnect() {
    try {
      deactivate();
    } catch (ex) {
      console.error('Failed to disconnect:', ex);
    }
  }

  const checkAndSwitchNetwork = async () => {
    const { ethereum } = window;
    if (!ethereum) {
      console.error("No Ethereum provider found");
      return false;
    }

    try {
      await switchToSepolia();
      return true;
    } catch (error) {
      console.error('Failed to switch to Sepolia network:', error);
      alert("Failed to switch to Sepolia network. Please switch manually in your wallet and try again.");
      return false;
    }
  };

  async function switchToSepolia() {
    const { ethereum } = window;
    if (!ethereum) {
      throw new Error("No Ethereum provider found");
    }

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
                chainName: "Sepolia Test Network",
                rpcUrls: ["https://rpc.sepolia.org"],
                nativeCurrency: {
                  name: "Sepolia Ether",
                  symbol: "SEP",
                  decimals: 18
                },
                blockExplorerUrls: ["https://sepolia.etherscan.io"]
              }
            ],
          });
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
          });
        } catch (addError) {
          throw new Error('Failed to add Sepolia network');
        }
      } else {
        throw switchError;
      }
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="placeholder"></div>
          <h1 className="logo-container">
            <img 
              src="/gpex_logo_whtie_1000px.webp" 
              alt="GPEX Token Exchange" 
              className="logo" 
              style={{
                width: '200px',
                height: 'auto'
              }}
            />
          </h1>
          <div className="wallet-buttons">
            {active ? (
              <>
                <button className="wallet-address-button">
                  {account.substring(0, 4)}...{account.substring(account.length - 4)}
                </button>
                <button onClick={disconnect} className="disconnect-button">
                  Disconnect
                </button>
                {chainId !== SEPOLIA_CHAIN_ID && (
                  <button onClick={checkAndSwitchNetwork} className="switch-network-button">
                    Switch to Sepolia
                  </button>
                )}
              </>
            ) : (
              <button onClick={connect} disabled={isConnecting} className="connect-wallet-button">
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="content-container">
        <TokenExchange checkAndSwitchNetwork={checkAndSwitchNetwork} switchToSepolia={switchToSepolia} />
      </main>
    </div>
  );
}

export default App;