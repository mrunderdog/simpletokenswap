import React, { useEffect } from 'react';
import { useWeb3React } from '@web3-react/core';
import { InjectedConnector } from '@web3-react/injected-connector';

const injected = new InjectedConnector({
  supportedChainIds: [1, 11155111], // Ethereum Mainnet와 Sepolia 테스트넷 모두 지원
});

function WalletConnect() {
  const { activate, deactivate, active, account, chainId, library } = useWeb3React();

  const connectWallet = async () => {
    try {
      console.log('Connecting wallet...');
      await activate(injected, undefined, true);
      console.log('Wallet connected successfully');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const disconnectWallet = () => {
    try {
      deactivate();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  const switchToSepolia = async () => {
    if (!library || !library.provider.request) {
      console.error('No provider available');
      return;
    }

    try {
      await library.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia의 chainId (16진수)
      });
    } catch (switchError) {
      // 사용자가 Sepolia 네트워크를 추가하지 않은 경우
      if (switchError.code === 4902) {
        try {
          await library.provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia Test Network',
              nativeCurrency: {
                name: 'Sepolia Ether',
                symbol: 'SEP',
                decimals: 18
              },
              rpcUrls: ['https://sepolia.infura.io/v3/YOUR-PROJECT-ID'],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }],
          });
        } catch (addError) {
          console.error('Failed to add Sepolia network:', addError);
        }
      } else {
        console.error('Failed to switch to Sepolia network:', switchError);
      }
    }
  };

  useEffect(() => {
    if (active && chainId !== 11155111) {
      const confirmSwitch = window.confirm('Please switch to Sepolia Test Network. Click OK to switch.');
      if (confirmSwitch) {
        switchToSepolia();
      }
    }
  }, [active, chainId]);

  return (
    <div className="wallet-info">
      {active ? (
        <div>
          <p>Connected: {account}</p>
          <p>Network: {chainId === 11155111 ? 'Sepolia Test Network' : 'Wrong Network'}</p>
          <button onClick={disconnectWallet}>Disconnect Wallet</button>
          {chainId !== 11155111 && (
            <div className="network-warning">
              <p>You are connected to the wrong network.</p>
              <button onClick={switchToSepolia}>Switch to Sepolia</button>
            </div>
          )}
        </div>
      ) : (
        <button onClick={connectWallet}>Connect MetaMask</button>
      )}
    </div>
  );
}

export default WalletConnect;