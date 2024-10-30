import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TokenExchange from './TokenExchange';
import { Web3ReactProvider } from '@web3-react/core';
import * as ethers from 'ethers';

// Web3React 프로바이더를 위한 모의 함수
function getLibrary(provider) {
  return new ethers.providers.Web3Provider(provider);
}

// 모의 props
const mockProps = {
  checkAndSwitchNetwork: jest.fn().mockResolvedValue(true),
  switchToSepolia: jest.fn().mockResolvedValue(true),
};

// ethers 라이브러리 모의
jest.mock('ethers', () => {
  const original = jest.requireActual('ethers');
  return {
    ...original,
    utils: {
      ...original.utils,
      parseEther: jest.fn().mockReturnValue('1000000000000000000'),
      formatEther: jest.fn().mockReturnValue('1.0'),
      parseUnits: jest.fn().mockReturnValue('1000000000000000000'),
    },
  };
});

// 모의 useWeb3React 훅
jest.mock('@web3-react/core', () => ({
  ...jest.requireActual('@web3-react/core'),
  useWeb3React: () => ({
    active: true,
    library: {
      getSigner: jest.fn().mockReturnValue({
        getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      }),
      getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
    },
    account: '0x1234567890123456789012345678901234567890',
    chainId: 11155111, // Sepolia chain ID
  }),
}));

// 모의 fetch 함수
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({
      ethereum: { usd: 2000 },
      'usd-coin': { usd: 1 },
      tether: { usd: 1 },
    }),
  })
);

describe('TokenExchange Component', () => {
  beforeEach(() => {
    render(
      <Web3ReactProvider getLibrary={getLibrary}>
        <TokenExchange {...mockProps} />
      </Web3ReactProvider>
    );
  });

  test('renders without crashing', async () => {
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Swap' })).toBeInTheDocument();
    });
  });

  test('displays token options', async () => {
    await waitFor(() => {
      const inputSelect = screen.getAllByRole('combobox')[0];
      const outputSelect = screen.getAllByRole('combobox')[1];

      expect(inputSelect).toBeInTheDocument();
      expect(outputSelect).toBeInTheDocument();

      expect(screen.getAllByText('Ethereum')).toHaveLength(1);
      expect(screen.getAllByText('gUSDC')).toHaveLength(2);
      expect(screen.getAllByText('gUSDT')).toHaveLength(2);
      expect(screen.getAllByText('gKIP')).toHaveLength(2);
    });
  });

  test('updates output amount when input changes', async () => {
    const input = screen.getByPlaceholderText('0.0');
    fireEvent.change(input, { target: { value: '1' } });

    await waitFor(() => {
      const output = screen.getByPlaceholderText('0.0000');
      expect(output).not.toHaveValue('0.0000');
    });
  });

  test('calls handleExchange when Swap button is clicked', async () => {
    const input = screen.getByPlaceholderText('0.0');
    fireEvent.change(input, { target: { value: '1' } });

    await waitFor(() => {
      const swapButton = screen.getByRole('button', { name: 'Swap' });
      expect(swapButton).not.toBeDisabled();
      fireEvent.click(swapButton);
    });
    
    await waitFor(() => {
      expect(mockProps.checkAndSwitchNetwork).toHaveBeenCalled();
    });
  });
});