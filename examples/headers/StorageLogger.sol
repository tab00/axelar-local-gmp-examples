// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import './Headers.sol';

contract StorageLogger {
    error AlreadyInitialized();

    event Execution(string from, bytes payload);

    uint256 public nonce;
    string public name;
    Headers public headers;

    bytes32 public constant OUTGOING_SALT = keccak256('outgoing');
    bytes32 public constant EXECUTION_SALT = keccak256('execution');
    
    function init(address headers_, string calldata name_) external {
        if(address(headers) != address(0)) revert AlreadyInitialized();
        if(bytes(name).length != 0) revert AlreadyInitialized();
        headers = Headers(headers_);
        name = name_;
    }

    function send(string memory destinationChain, address destinationAddress, bytes calldata payload) external returns (uint256 nonce_) {
        nonce_ = nonce++;
        _set(
            getOutgingPos(destinationChain, destinationAddress, nonce_),
            keccak256(payload)
        );
        return nonce_;
    }

    function remoteOutgoing(string memory chain, address destinationAddress, uint256 nonce_, bytes[] memory proof) public view returns (bytes32) {
        uint256 pos = getOutgingPos(name, destinationAddress, nonce_);
        return headers.getStorageAt(chain, pos, proof);
    }

    function receive(string memory from, uint256 nonce_, bytes calldata payload, bytes[] memory proof) external {
        uint256 executionPos = getExecutionPos(from, msg.sender, nonce_);
        bytes32 executionVal = _get(executionPos);
        require(executionVal & bytes32(1<<(nonce_%256)) == 0, 'ALREADY_EXECUTED');
        require(remoteOutgoing(from, msg.sender, nonce_, proof) == keccak256(payload), 'WRONG_HASH');
        _set(executionPos, executionVal | bytes32(1<<(nonce_%256)));
        _execute(from, payload);
    }

    function getOutgingPos(string memory chain, address destinationAddress, uint256 nonce_) public pure returns (uint256 pos) {
        pos = uint256(keccak256(abi.encode(chain, destinationAddress, OUTGOING_SALT))) + nonce_;
    }

    function getExecutionPos(string memory chain, address destinationAddress, uint256 nonce_) public pure returns (uint256 pos) {
        pos = uint256(keccak256(abi.encode(chain, destinationAddress, EXECUTION_SALT))) + nonce_ / 256;
    }

    function _set(uint256 pos, bytes32 val) internal {
        assembly {
            sstore(pos, val)
        }
    }
    function _get(uint256 pos) internal view returns (bytes32 val) {
        assembly {
            val := sload(pos)
        }
    }

    function _execute(string memory from, bytes calldata payload) internal {
        emit Execution(from, payload);
    }
}