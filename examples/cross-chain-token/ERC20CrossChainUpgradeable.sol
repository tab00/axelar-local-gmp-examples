// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

// import { IAxelarGateway } from '@axelar-network/axelar-cgp-solidity/contracts/interfaces/IAxelarGateway.sol';
import { IAxelarGasService } from '@axelar-network/axelar-cgp-solidity/contracts/interfaces/IAxelarGasService.sol';
import { StringToAddress, AddressToString } from 'axelar-utils-solidity/contracts/StringAddressUtils.sol';
import { IERC20CrossChainUpgradeable } from './IERC20CrossChainUpgradeable.sol';

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "axelar-utils-solidity/contracts/executables/AxelarExecutable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract ERC20CrossChainUpgradeable is Initializable, UUPSUpgradeable, AxelarExecutable, IERC20CrossChainUpgradeable, ERC20Upgradeable {
    using StringToAddress for string;
    using AddressToString for address;

    error AlreadyInitialized();

    event FalseSender(string sourceChain, string sourceAddress);

    IAxelarGateway private gateway_local;
    IAxelarGasService public gasReceiver;

    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) public initializer {
        IAxelarExecutable(address(0));
        __ERC20_init(name_, symbol_);
        __UUPSUpgradeable_init();
    }

    function init(address gateway_, address gasReceiver_) external {
        if (address(gateway_local) != address(0) || address(gasReceiver) != address(0)) revert AlreadyInitialized();
        gasReceiver = IAxelarGasService(gasReceiver_);
        gateway_local = IAxelarGateway(gateway_);
    }

    function gateway() public view override returns (IAxelarGateway gateway_) {
        gateway_ = gateway_local;
    }

    // This is for testing.
    function giveMe(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function transferRemote(
        string calldata destinationChain,
        address destinationAddress,
        uint256 amount
    ) public payable override {
        _burn(msg.sender, amount);
        bytes memory payload = abi.encode(destinationAddress, amount);
        string memory stringAddress = address(this).toString();
        if (msg.value > 0) {
            gasReceiver.payNativeGasForContractCall{ value: msg.value }(
                address(this),
                destinationChain,
                stringAddress,
                payload,
                msg.sender
            );
        }
        gateway().callContract(destinationChain, stringAddress, payload);
    }

    function _execute(
        string calldata, /*sourceChain*/
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        if (sourceAddress.toAddress() != address(this)) {
            emit FalseSender(sourceAddress, sourceAddress);
            return;
        }
        (address to, uint256 amount) = abi.decode(payload, (address, uint256));
        _mint(to, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override {}
}
