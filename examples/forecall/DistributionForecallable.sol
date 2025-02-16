//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import { IAxelarForecallable } from '@axelar-network/axelar-cgp-solidity/contracts/interfaces/IAxelarForecallable.sol';
import { IERC20 } from '@axelar-network/axelar-cgp-solidity/contracts/interfaces/IERC20.sol';
import { IAxelarGasService } from '@axelar-network/axelar-cgp-solidity/contracts/interfaces/IAxelarGasService.sol';
import { IAxelarGateway } from '@axelar-network/axelar-cgp-solidity/contracts/interfaces/IAxelarGateway.sol';
import { AddressToString } from 'axelar-utils-solidity/contracts/StringAddressUtils.sol';

contract DistributionForecallable is IAxelarForecallable {
    using AddressToString for address;
    IAxelarGasService gasReceiver;

    constructor() IAxelarForecallable(address(0)) {}

    function init(address _gateway, address _gasReceiver) external {
        if (address(gateway) != address(0) || address(gasReceiver) != address(0)) revert('Already Initialized.');
        gateway = IAxelarGateway(_gateway);
        gasReceiver = IAxelarGasService(_gasReceiver);
    }

    function _sendToMany(
        string memory destinationChain,
        address[] calldata destinationAddresses,
        string memory symbol,
        uint256 amount,
        uint256 feePercent
    ) internal {
        address tokenAddress = gateway.tokenAddresses(symbol);
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        IERC20(tokenAddress).approve(address(gateway), amount);
        bytes memory payload = abi.encode(feePercent, destinationAddresses);
        gateway.callContractWithToken(destinationChain, address(this).toString(), payload, symbol, amount);
    }

    function sendToMany(
        string memory destinationChain,
        address[] calldata destinationAddresses,
        string memory symbol,
        uint256 amount
    ) external payable {
        _sendToMany(destinationChain, destinationAddresses, symbol, amount, 0);
    }

    function sendToManyForecall(
        string memory destinationChain,
        address[] calldata destinationAddresses,
        string memory symbol,
        uint256 amount,
        uint64 feeNum,
        uint64 feeDenom,
        uint128 salt
    ) external payable {
        uint256 feePercent = feeNum + (uint256(feeDenom) << 64) + (uint256(salt) << 128);
        _sendToMany(destinationChain, destinationAddresses, symbol, amount, feePercent);
    }

    function _executeWithToken(
        string memory,
        string memory,
        bytes calldata payload,
        string memory tokenSymbol,
        uint256 amount
    ) internal override {
        (, address[] memory recipients) = abi.decode(payload, (uint256, address[]));
        address tokenAddress = gateway.tokenAddresses(tokenSymbol);

        uint256 sentAmount = amount / recipients.length;
        for (uint256 i = 0; i < recipients.length; i++) {
            IERC20(tokenAddress).transfer(recipients[i], sentAmount);
        }
    }

    function amountPostFee(uint256 amount, bytes calldata payload) public pure override returns (uint256) {
        uint256 feePercent = abi.decode(payload, (uint256));
        uint64 num = uint64(feePercent);
        uint64 denom = uint64(feePercent >> 64);
        if (denom == 0) return amount;
        return amount - (amount * num) / denom;
    }
}
