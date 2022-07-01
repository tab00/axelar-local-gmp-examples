// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IAxelarExecutable } from '@axelar-network/axelar-cgp-solidity/contracts/interfaces/IAxelarExecutable.sol';
import { IAxelarGasService } from '@axelar-network/axelar-cgp-solidity/contracts/interfaces/IAxelarGasService.sol';
import { AxelarDepositService } from '@axelar-network/axelar-cgp-solidity/contracts/deposit-service/AxelarDepositService.sol';
import { AxelarDepositServiceProxy } from '@axelar-network/axelar-cgp-solidity/contracts/deposit-service/AxelarDepositServiceProxy.sol';

contract DepositService is IAxelarExecutable {
    constructor(address gateway_) IAxelarExecutable(gateway_) {
    }
}
