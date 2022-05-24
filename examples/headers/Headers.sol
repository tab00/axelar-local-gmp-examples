// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IAxelarGateway } from '@axelar-network/axelar-cgp-solidity/src/interfaces/IAxelarGateway.sol';
import { AddressFormat } from '@axelar-network/axelar-cgp-solidity/src/util/AddressFormat.sol';

import "./RLPReader.sol";
import "./MerklePatriciaProof.sol";

contract Headers {
    error NotApprovedByGateway();
    error WrongHash();
    error AlreadyInitialized();

    event Sent(uint256 blockNumber, bytes32 blockHash);

    using AddressFormat for address;

    IAxelarGateway public gateway;
    mapping(string => bytes32) public stateRoots;
    mapping(string => bytes32) public storageRoots;
    mapping(string => uint256) public blockNumbers;
    mapping(string => uint256) public timestamps;

    uint256 public constant STATE_POS = 123;
    uint256 public constant NUMBER_POS = 55;
    uint256 public constant TIMESTAMP_POS = 55;

    //We need to know where the gateway is as well as where the gasReceiver is. length_ is the maximum number of headers to cache per chain.
    function init(address gateway_) external {
        if(address(gateway) != address(0)) revert AlreadyInitialized();
        gateway = IAxelarGateway(gateway_);
    }

    function updateRemoteHeaders (
        string[] memory chains
    ) external {
        bytes memory payload = abi.encode(blockhash(block.number - 1));
        for(uint256 i = 0; i < chains.length; i++) {
            gateway.callContract(
                chains[i], 
                address(this).toLowerString(),
                payload
            );
        }
        emit Sent(block.number - 1, blockhash(block.number - 1));
    }

    function _extractData(bytes calldata header) internal pure returns (
        bytes32 stateHash_, 
        uint256 timestamp_, 
        uint256 blockNumber
    ) {
        RLPReader.RLPItem memory item = RLPReader.toRlpItem(header);
        RLPReader.RLPItem[] memory list = RLPReader.toList(item);
        timestamp_ = RLPReader.toUint(list[11]);
        blockNumber = RLPReader.toUint(list[8]);
        stateHash_ = bytes32(
            RLPReader.toUint(list[3])
        );
    }

    function getEncodedPath() public view returns(bytes memory encodedPath) {
        encodedPath = new bytes(33);
        encodedPath[0] = bytes1(uint8(32));
        bytes32 addressHash = keccak256(abi.encodePacked(address(this)));
        assembly{
            mstore(add(encodedPath, 33), addressHash)
        }
    }

    function receiveHeader(
        bytes32 commandId, 
        string calldata chain,
        bytes32 blockHash,
        bytes calldata blockHeader,
        bytes calldata encodedPath,
        bytes[] memory rlpParentNodes
    ) external {
        if( keccak256(blockHeader) != blockHash )
            revert WrongHash();
        //bytes32 payloadHash = keccak256(abi.encode(blockHash));
        //if (!gateway.validateContractCall(commandId, chain, address(this).toLowerString(), payloadHash))
        //    revert NotApprovedByGateway();
        bytes32 stateRoot;
        (
            stateRoot,
            timestamps[chain],
            blockNumbers[chain]
        ) = _extractData(blockHeader);
        stateRoots[chain] = stateRoot;
        //bytes memory encodedPath = getEncodedPath();
        bytes memory val = MerklePatriciaProof.get(encodedPath, rlpParentNodes, stateRoot);

        RLPReader.RLPItem[] memory list = RLPReader.toList(RLPReader.toRlpItem(val));
        storageRoots[chain] = bytes32(RLPReader.toUint(list[2]));
    }

    function getNibblesForPos(uint256 pos) public pure returns (bytes memory encoded) {
        encoded = new bytes(33);
        encoded[0] = bytes1(uint8(32));
        bytes32 hashed = keccak256(abi.encodePacked(pos));
        assembly {
            mstore(add(encoded,33), hashed)
        }
    }

    function getStorageAt(string memory chain, uint256 pos, bytes[] memory rlpParentNodes) external view returns (bytes memory){
        return MerklePatriciaProof.get(getNibblesForPos(pos), rlpParentNodes, storageRoots[chain]);
    }
}