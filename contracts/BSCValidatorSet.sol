pragma solidity 0.6.4;

import "./System.sol";
import "./lib/BytesToTypes.sol";
import "./lib/Memory.sol";
import "./interface/ILightClient.sol";
import "./interface/ISlashIndicator.sol";
import "./interface/ITokenHub.sol";
import "./interface/IRelayerHub.sol";
import "./interface/IParamSubscriber.sol";
import "./interface/IBSCValidatorSet.sol";
import "./interface/IApplication.sol";
import "./interface/ICrossChain.sol";
import "./lib/SafeMath.sol";
import "./lib/RLPDecode.sol";
import "./lib/CmnPkg.sol";


contract BSCValidatorSet is IBSCValidatorSet, System, IParamSubscriber, IApplication {

  using SafeMath for uint256;
  using RLPDecode for *;

  // will not transfer value less than 0.1 BNB for validators
  uint256 constant public DUSTY_INCOMING = 1e17;

  uint8 public constant JAIL_MESSAGE_TYPE = 1;
  uint8 public constant VALIDATORS_UPDATE_MESSAGE_TYPE = 0;

  // the precision of cross chain value transfer.
  uint256 public constant PRECISION = 1e10;
  uint256 public constant EXPIRE_TIME_SECOND_GAP = 1000;
  uint256 public constant MAX_NUM_OF_VALIDATORS = 41;

  bytes public constant INIT_VALIDATORSET_BYTES = hex"f84580f842f840949fb29aac15b9a4b7f17c3385939b007540f4d791949fb29aac15b9a4b7f17c3385939b007540f4d791949fb29aac15b9a4b7f17c3385939b007540f4d79164";

  uint32 public constant ERROR_UNKNOWN_PACKAGE_TYPE = 101;
  uint32 public constant ERROR_FAIL_CHECK_VALIDATORS = 102;
  uint32 public constant ERROR_LEN_OF_VAL_MISMATCH = 103;
  uint32 public constant ERROR_RELAYFEE_TOO_LARGE = 104;


  /*********************** state of the contract **************************/
  Validator[] public currentValidatorSet;
  uint256 public expireTimeSecondGap;
  uint256 public totalInComing;

  // key is the `consensusAddress` of `Validator`,
  // value is the index of the element in `currentValidatorSet`.
  mapping(address =>uint256) public currentValidatorSetMap;
  uint256 public numOfJailed;

  uint256 public constant BURN_RATIO_SCALE = 10000;
  address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
  uint256 public constant INIT_BURN_RATIO = 0;
  uint256 public burnRatio;
  bool public burnRatioInitialized;

  // BEP-127 Temporary Maintenance
  uint256 public constant INIT_MAX_NUM_OF_MAINTAINING = 3;
  uint256 public constant INIT_MAINTAIN_SLASH_SCALE = 2;

  uint256 public maxNumOfMaintaining;
  uint256 public maintainSlashScale;

  Validator[] public maintainingValidatorSet;
  // key is the `consensusAddress` of `Validator`,
  mapping(address => MaintainInfo) public maintainInfoMap;

  struct Validator{
    address consensusAddress;
    address payable feeAddress;
    address BBCFeeAddress;
    uint64  votingPower;

    // only in state
    bool jailed;
    uint256 incoming;
  }

  // BEP-127 Temporary Maintenance
  struct MaintainInfo {
    bool isMaintaining;
    uint256 startBlockNumber;     // the block number at which the validator enters Maintenance

    // The index of the element in `maintainingValidatorSet`.
    // The values of maintaining validators are stored at 0 ~ maintainingValidatorSet.length - 1,
    // but we add 1 to all indexes, so the index here is range from [1, maintainingValidatorSet.length],
    // and use 0 as a `sentinel value`
    uint256 index;
  }

  /*********************** cross chain package **************************/
  struct IbcValidatorSetPackage {
    uint8  packageType;
    Validator[] validatorSet;
  }

  /*********************** modifiers **************************/
  modifier noEmptyDeposit() {
    require(msg.value > 0, "deposit value is zero");
    _;
  }

  /*********************** events **************************/
  event validatorSetUpdated();
  event validatorJailed(address indexed validator);
  event validatorEmptyJailed(address indexed validator);
  event batchTransfer(uint256 amount);
  event batchTransferFailed(uint256 indexed amount, string reason);
  event batchTransferLowerFailed(uint256 indexed amount, bytes reason);
  event systemTransfer(uint256 amount);
  event directTransfer(address payable indexed validator, uint256 amount);
  event directTransferFail(address payable indexed validator, uint256 amount);
  event deprecatedDeposit(address indexed validator, uint256 amount);
  event validatorDeposit(address indexed validator, uint256 amount);
  event validatorMisdemeanor(address indexed validator, uint256 amount);
  event validatorFelony(address indexed validator, uint256 amount);
  event failReasonWithStr(string message);
  event unexpectedPackage(uint8 channelId, bytes msgBytes);
  event paramChange(string key, bytes value);
  event feeBurned(uint256 amount);
  event validatorEnterMaintenance(address indexed validator);
  event validatorExitMaintenance(address indexed validator);

  /*********************** init **************************/
  function init() external onlyNotInit{
    (IbcValidatorSetPackage memory validatorSetPkg, bool valid)= decodeValidatorSetSynPackage(INIT_VALIDATORSET_BYTES);
    require(valid, "failed to parse init validatorSet");
    for (uint i = 0;i<validatorSetPkg.validatorSet.length;i++) {
      currentValidatorSet.push(validatorSetPkg.validatorSet[i]);
      currentValidatorSetMap[validatorSetPkg.validatorSet[i].consensusAddress] = i+1;
    }
    expireTimeSecondGap = EXPIRE_TIME_SECOND_GAP;
    alreadyInit = true;
  }

  /*********************** Cross Chain App Implement **************************/
  function handleSynPackage(uint8, bytes calldata msgBytes) onlyInit onlyCrossChainContract external override returns(bytes memory responsePayload) {
    (IbcValidatorSetPackage memory validatorSetPackage, bool ok) = decodeValidatorSetSynPackage(msgBytes);
    if (!ok) {
      return CmnPkg.encodeCommonAckPackage(ERROR_FAIL_DECODE);
    }
    uint32 resCode;
    if (validatorSetPackage.packageType == VALIDATORS_UPDATE_MESSAGE_TYPE) {
      resCode = updateValidatorSet(validatorSetPackage.validatorSet);
    } else if (validatorSetPackage.packageType == JAIL_MESSAGE_TYPE) {
      if (validatorSetPackage.validatorSet.length != 1) {
        emit failReasonWithStr("length of jail validators must be one");
        resCode = ERROR_LEN_OF_VAL_MISMATCH;
      } else {
        resCode = jailValidator(validatorSetPackage.validatorSet[0]);
      }
    } else {
      resCode = ERROR_UNKNOWN_PACKAGE_TYPE;
    }
    if (resCode == CODE_OK) {
      return new bytes(0);
    } else {
      return CmnPkg.encodeCommonAckPackage(resCode);
    }
  }

  function handleAckPackage(uint8 channelId, bytes calldata msgBytes) external onlyCrossChainContract override {
    // should not happen
    emit unexpectedPackage(channelId, msgBytes);
  }

  function handleFailAckPackage(uint8 channelId, bytes calldata msgBytes) external onlyCrossChainContract override {
    // should not happen
    emit unexpectedPackage(channelId, msgBytes);
  }

  /*********************** External Functions **************************/
  function deposit(address valAddr) external payable onlyCoinbase onlyInit noEmptyDeposit{
    uint256 value = msg.value;
    uint256 index = currentValidatorSetMap[valAddr];

    uint256 curBurnRatio = INIT_BURN_RATIO;
    if (burnRatioInitialized) {
      curBurnRatio = burnRatio;
    }

    if (value > 0 && curBurnRatio > 0) {
      uint256 toBurn = value.mul(curBurnRatio).div(BURN_RATIO_SCALE);
      if (toBurn > 0) {
        address(uint160(BURN_ADDRESS)).transfer(toBurn);
        emit feeBurned(toBurn);

        value = value.sub(toBurn);
      }
    }

    if (index>0) {
      Validator storage validator = currentValidatorSet[index-1];
      if (validator.jailed) {
        emit deprecatedDeposit(valAddr,value);
      } else {
        totalInComing = totalInComing.add(value);
        validator.incoming = validator.incoming.add(value);
        emit validatorDeposit(valAddr,value);
      }
    } else {
      // get incoming from deprecated validator;
      emit deprecatedDeposit(valAddr,value);
    }
  }

  function jailValidator(Validator memory v) internal returns (uint32) {
    uint256 index = currentValidatorSetMap[v.consensusAddress];
    if (index==0 || currentValidatorSet[index-1].jailed) {
      emit validatorEmptyJailed(v.consensusAddress);
      return CODE_OK;
    }
    uint n = currentValidatorSet.length;
    bool shouldKeep = (numOfJailed >= n-1);
    // will not jail if it is the last valid validator
    if (shouldKeep) {
      emit validatorEmptyJailed(v.consensusAddress);
      return CODE_OK;
    }
    numOfJailed ++;
    currentValidatorSet[index-1].jailed = true;
    emit validatorJailed(v.consensusAddress);
    return CODE_OK;
  }

  function updateValidatorSet(Validator[] memory validatorSet) internal returns (uint32) {
    {
      // do verify.
      (bool valid, string memory errMsg) = checkValidatorSet(validatorSet);
      if (!valid) {
        emit failReasonWithStr(errMsg);
        return ERROR_FAIL_CHECK_VALIDATORS;
      }
    }

    // step 0: force all maintaining validators to exit `Temporary Maintenance`
    // - 1. validators exit maintenance
    // - 2. clear all maintainInfo
    // - 3. get unjailed validators from validatorSet
    Validator[] memory validatorSetTemp = _forceMaintainingValidatorsExit(validatorSet);

    //step 1: do calculate distribution, do not make it as an internal function for saving gas.
    uint crossSize;
    uint directSize;
    for (uint i = 0;i<currentValidatorSet.length;i++) {
      if (currentValidatorSet[i].incoming >= DUSTY_INCOMING) {
        crossSize ++;
      } else if (currentValidatorSet[i].incoming > 0) {
        directSize ++;
      }
    }

    //cross transfer
    address[] memory crossAddrs = new address[](crossSize);
    uint256[] memory crossAmounts = new uint256[](crossSize);
    uint256[] memory crossIndexes = new uint256[](crossSize);
    address[] memory crossRefundAddrs = new address[](crossSize);
    uint256 crossTotal;
    // direct transfer
    address payable[] memory directAddrs = new address payable[](directSize);
    uint256[] memory directAmounts = new uint256[](directSize);
    crossSize = 0;
    directSize = 0;
    uint256 relayFee = ITokenHub(TOKEN_HUB_ADDR).getMiniRelayFee();
    if (relayFee > DUSTY_INCOMING) {
      emit failReasonWithStr("fee is larger than DUSTY_INCOMING");
      return ERROR_RELAYFEE_TOO_LARGE;
    }
    for (uint i = 0;i<currentValidatorSet.length;i++) {
      if (currentValidatorSet[i].incoming >= DUSTY_INCOMING) {
        crossAddrs[crossSize] = currentValidatorSet[i].BBCFeeAddress;
        uint256 value = currentValidatorSet[i].incoming - currentValidatorSet[i].incoming % PRECISION;
        crossAmounts[crossSize] = value.sub(relayFee);
        crossRefundAddrs[crossSize] = currentValidatorSet[i].BBCFeeAddress;
        crossIndexes[crossSize] = i;
        crossTotal = crossTotal.add(value);
        crossSize ++;
      } else if (currentValidatorSet[i].incoming > 0) {
        directAddrs[directSize] = currentValidatorSet[i].feeAddress;
        directAmounts[directSize] = currentValidatorSet[i].incoming;
        directSize ++;
      }
    }

    //step 2: do cross chain transfer
    bool failCross = false;
    if (crossTotal > 0) {
      try ITokenHub(TOKEN_HUB_ADDR).batchTransferOutBNB{value:crossTotal}(crossAddrs, crossAmounts, crossRefundAddrs, uint64(block.timestamp + expireTimeSecondGap)) returns (bool success) {
        if (success) {
           emit batchTransfer(crossTotal);
        } else {
           emit batchTransferFailed(crossTotal, "batch transfer return false");
        }
      }catch Error(string memory reason) {
        failCross = true;
        emit batchTransferFailed(crossTotal, reason);
      }catch (bytes memory lowLevelData) {
        failCross = true;
        emit batchTransferLowerFailed(crossTotal, lowLevelData);
      }
    }

    if (failCross) {
      for (uint i = 0; i< crossIndexes.length;i++) {
        uint idx = crossIndexes[i];
        bool success = currentValidatorSet[idx].feeAddress.send(currentValidatorSet[idx].incoming);
        if (success) {
          emit directTransfer(currentValidatorSet[idx].feeAddress, currentValidatorSet[idx].incoming);
        } else {
          emit directTransferFail(currentValidatorSet[idx].feeAddress, currentValidatorSet[idx].incoming);
        }
      }
    }

    // step 3: direct transfer
    if (directAddrs.length>0) {
      for (uint i = 0;i<directAddrs.length;i++) {
        bool success = directAddrs[i].send(directAmounts[i]);
        if (success) {
          emit directTransfer(directAddrs[i], directAmounts[i]);
        } else {
          emit directTransferFail(directAddrs[i], directAmounts[i]);
        }
      }
    }

    // step 4: do dusk transfer
    if (address(this).balance>0) {
      emit systemTransfer(address(this).balance);
      address(uint160(SYSTEM_REWARD_ADDR)).transfer(address(this).balance);
    }
    // step 5: do update validator set state
    totalInComing = 0;
    numOfJailed = 0;
    if (validatorSetTemp.length>0) {
      doUpdateState(validatorSetTemp);
    }

    // step 6: clean slash contract
    ISlashIndicator(SLASH_CONTRACT_ADDR).clean();
    emit validatorSetUpdated();
    return CODE_OK;
  }

  function getValidators() public view returns(address[] memory) {
    uint n = currentValidatorSet.length;
    uint valid = 0;
    for (uint i = 0;i<n;i++) {
      if (!currentValidatorSet[i].jailed) {
        valid ++;
      }
    }
    address[] memory consensusAddrs = new address[](valid);
    valid = 0;
    for (uint i = 0;i<n;i++) {
      if (!currentValidatorSet[i].jailed) {
        consensusAddrs[valid] = currentValidatorSet[i].consensusAddress;
        valid ++;
      }
    }
    return consensusAddrs;
  }

  function getMaintainingValidators() public view returns(address[] memory maintainingValidators) {
    maintainingValidators = new address[](maintainingValidatorSet.length);
    for (uint i = 0; i < maintainingValidators.length; i++) {
      maintainingValidators[i] = maintainingValidatorSet[i].consensusAddress;
    }
  }

  function getIncoming(address validator)external view returns(uint256) {
    uint256 index = currentValidatorSetMap[validator];
    if (index<=0) {
      return 0;
    }
    return currentValidatorSet[index-1].incoming;
  }

  function isCurrentValidator(address validator) external view override returns (bool) {
    uint256 index = currentValidatorSetMap[validator];
    if (index <= 0) {
      return false;
    }

    // the actual index
    index = index - 1;
    return !currentValidatorSet[index].jailed;
  }

  /*********************** For slash **************************/
  function misdemeanor(address validator)external onlySlash override{
    uint256 validatorIndex = _misdemeanor(validator);
    if (canEnterMaintenance(validatorIndex)) {
      _enterMaintenance(validator, validatorIndex);
    }
  }

  function felony(address validator)external onlySlash override {
    _felony(validator);
  }

  /*********************** For Temporary Maintenance **************************/
  function canEnterMaintenance(uint256 index) public view returns (bool) {
    if (index >= currentValidatorSet.length) {
      return false;
    }

    Validator memory validatorInfo = currentValidatorSet[index];
    address validator = validatorInfo.consensusAddress;

    if (
      validator == address(0)                                       // - 0. check if empty validator
      || (maxNumOfMaintaining == 0 || maintainSlashScale == 0)      // - 1. check if not start
      || maintainingValidatorSet.length >= maxNumOfMaintaining      // - 2. check if exceeded upper limit
      || validatorInfo.jailed                                       // - 3. check if jailed
      || maintainInfoMap[validator].isMaintaining                   // - 4. check if maintaining
      || maintainInfoMap[validator].startBlockNumber > 0            // - 5. check if has Maintained
      || getValidators().length <= 1                                // - 6. check num of remaining unjailed currentValidators
    ) {
      return false;
    }

    return true;
  }

  function enterMaintenance() external {
    // check maintain config
    if (maxNumOfMaintaining == 0) {
      maxNumOfMaintaining = INIT_MAX_NUM_OF_MAINTAINING;
    }
    if (maintainSlashScale == 0) {
      maintainSlashScale = INIT_MAINTAIN_SLASH_SCALE;
    }

    uint256 index = currentValidatorSetMap[msg.sender];
    require(index > 0, "only current validators can enter maintenance");

    // the actually index
    index = index - 1;

    require(canEnterMaintenance(index), "can not enter Temporary Maintenance");
    _enterMaintenance(msg.sender, index);
  }

  function exitMaintenance() external {
    MaintainInfo memory maintainInfo = maintainInfoMap[msg.sender];
    require(maintainInfo.isMaintaining, "not in maintenance");

    uint256 index = maintainInfo.index.sub(1);  // the actually index
    // should not happen, still protect
    require(maintainingValidatorSet[index].consensusAddress == msg.sender, "invalid maintainInfo");

    _exitMaintenance(msg.sender);
  }

  /*********************** Param update ********************************/
  function updateParam(string calldata key, bytes calldata value) override external onlyInit onlyGov{
    if (Memory.compareStrings(key, "expireTimeSecondGap")) {
      require(value.length == 32, "length of expireTimeSecondGap mismatch");
      uint256 newExpireTimeSecondGap = BytesToTypes.bytesToUint256(32, value);
      require(newExpireTimeSecondGap >=100 && newExpireTimeSecondGap <= 1e5, "the expireTimeSecondGap is out of range");
      expireTimeSecondGap = newExpireTimeSecondGap;
    } else if (Memory.compareStrings(key, "burnRatio")) {
      require(value.length == 32, "length of burnRatio mismatch");
      uint256 newBurnRatio = BytesToTypes.bytesToUint256(32, value);
      require(newBurnRatio <= BURN_RATIO_SCALE, "the burnRatio must be no greater than 10000");
      burnRatio = newBurnRatio;
      burnRatioInitialized = true;
    } else if (Memory.compareStrings(key, "maxNumOfMaintaining")) {
      require(value.length == 32, "length of maxNumOfMaintaining mismatch");
      uint256 newMaxNumOfMaintaining = BytesToTypes.bytesToUint256(32, value);
      require(newMaxNumOfMaintaining < MAX_NUM_OF_VALIDATORS, "the maxNumOfMaintaining must be less than MAX_NUM_OF_VALIDATORS");
      maxNumOfMaintaining = newMaxNumOfMaintaining;
    } else if (Memory.compareStrings(key, "maintainSlashScale")) {
      require(value.length == 32, "length of maintainSlashScale mismatch");
      uint256 newMaintainSlashScale = BytesToTypes.bytesToUint256(32, value);
      require(newMaintainSlashScale > 0, "the maintainSlashScale must be greater than 0");
      maintainSlashScale = newMaintainSlashScale;
    } else {
      require(false, "unknown param");
    }
    emit paramChange(key, value);
  }

  /*********************** Internal Functions **************************/

  function checkValidatorSet(Validator[] memory validatorSet) private pure returns(bool, string memory) {
    if (validatorSet.length > MAX_NUM_OF_VALIDATORS){
      return (false, "the number of validators exceed the limit");
    }
    for (uint i = 0;i<validatorSet.length;i++) {
      for (uint j = 0;j<i;j++) {
        if (validatorSet[i].consensusAddress == validatorSet[j].consensusAddress) {
          return (false, "duplicate consensus address of validatorSet");
        }
      }
    }
    return (true,"");
  }

  function doUpdateState(Validator[] memory validatorSet) private{
    uint n = currentValidatorSet.length;
    uint m = validatorSet.length;

    for (uint i = 0;i<n;i++) {
      bool stale = true;
      Validator memory oldValidator = currentValidatorSet[i];
      for (uint j = 0;j<m;j++) {
        if (oldValidator.consensusAddress == validatorSet[j].consensusAddress) {
          stale = false;
          break;
        }
      }
      if (stale) {
        delete currentValidatorSetMap[oldValidator.consensusAddress];
      }
    }

    if (n>m) {
      for (uint i = m;i<n;i++) {
        currentValidatorSet.pop();
      }
    }
    uint k = n < m ? n:m;
    for (uint i = 0;i<k;i++) {
      if (!isSameValidator(validatorSet[i], currentValidatorSet[i])) {
        currentValidatorSetMap[validatorSet[i].consensusAddress] = i+1;
        currentValidatorSet[i] = validatorSet[i];
      } else {
        currentValidatorSet[i].incoming = 0;
      }
    }
    if (m>n) {
      for (uint i = n;i<m;i++) {
        currentValidatorSet.push(validatorSet[i]);
        currentValidatorSetMap[validatorSet[i].consensusAddress] = i+1;
      }
    }
  }

  function isSameValidator(Validator memory v1, Validator memory v2) private pure returns(bool) {
    return v1.consensusAddress == v2.consensusAddress && v1.feeAddress == v2.feeAddress && v1.BBCFeeAddress == v2.BBCFeeAddress && v1.votingPower == v2.votingPower;
  }

  function _misdemeanor(address validator) private returns (uint256) {
    uint256 index = currentValidatorSetMap[validator];
    if (index <= 0) {
      return ~uint256(0);
    }
    // the actually index
    index = index - 1;

    uint256 income = currentValidatorSet[index].incoming;
    currentValidatorSet[index].incoming = 0;
    uint256 rest = currentValidatorSet.length - 1;
    emit validatorMisdemeanor(validator,income);
    if (rest==0) {
      // should not happen, but still protect
      return index;
    }
    uint256 averageDistribute = income/rest;
    if (averageDistribute!=0) {
      for (uint i=0;i<index;i++) {
        currentValidatorSet[i].incoming = currentValidatorSet[i].incoming + averageDistribute;
      }
      uint n = currentValidatorSet.length;
      for (uint i=index+1;i<n;i++) {
        currentValidatorSet[i].incoming = currentValidatorSet[i].incoming + averageDistribute;
      }
    }
    // averageDistribute*rest may less than income, but it is ok, the dust income will go to system reward eventually.

    return index;
  }

  function _felony(address validator) private {
    uint256 index = currentValidatorSetMap[validator];
    if (index <= 0) {
      return;
    }
    // the actually index
    index = index - 1;
    uint256 income = currentValidatorSet[index].incoming;
    uint256 rest = currentValidatorSet.length - 1;
    if (getValidators().length <= 1) {
      // will not remove the validator if it is the only one validator.
      currentValidatorSet[index].incoming = 0;
      return;
    }
    emit validatorFelony(validator,income);

    _removeFromCurrentValidatorSet(validator, index);

    uint256 averageDistribute = income/rest;
    if (averageDistribute!=0) {
      uint n = currentValidatorSet.length;
      for (uint i=0;i<n;i++) {
        currentValidatorSet[i].incoming = currentValidatorSet[i].incoming + averageDistribute;
      }
    }
    // averageDistribute*rest may less than income, but it is ok, the dust income will go to system reward eventually.
  }

  function _removeFromCurrentValidatorSet(address validator, uint256 index) private {
    delete currentValidatorSetMap[validator];
    // It is ok that the validatorSet is not in order.
    if (index != currentValidatorSet.length - 1) {
      currentValidatorSet[index] = currentValidatorSet[currentValidatorSet.length - 1];
      currentValidatorSetMap[currentValidatorSet[index].consensusAddress] = index + 1;
    }
    currentValidatorSet.pop();
  }

  function _forceMaintainingValidatorsExit(Validator[] memory validatorSet) private returns (Validator[] memory unjailedValidatorSet){
    uint256 numOfFelony = 0;
    address validator;
    bool isFelony;

    // 1. validators exit maintenance
    address[] memory maintainingValidators = getMaintainingValidators();

    for (uint i = 0; i < maintainingValidators.length; i++) {
      validator = maintainingValidators[i];
      // exit maintenance
      isFelony = _exitMaintenance(validator);
      delete maintainInfoMap[validator];

      if (!isFelony || numOfFelony >= validatorSet.length - 1) {
        continue;
      }

      // record the jailed validator in validatorSet
      for (uint index = 0; index < validatorSet.length; index++) {
        if (validatorSet[index].consensusAddress == validator) {
          validatorSet[index].jailed = true;
          numOfFelony++;
          break;
        }
      }
    }

    // 2. clear all maintain info
    delete maintainingValidatorSet;
    for (uint256 i = 0; i < validatorSet.length; i++) {
      delete maintainInfoMap[validatorSet[i].consensusAddress];
    }

    // 3. get unjailed validators from validatorSet
    unjailedValidatorSet = new Validator[](validatorSet.length - numOfFelony);
    uint256 i = 0;
    for (uint index = 0; index < validatorSet.length; index++) {
      if (!validatorSet[index].jailed) {
        unjailedValidatorSet[i] = validatorSet[index];
        i++;
      }
    }

    return unjailedValidatorSet;
  }

  function _enterMaintenance(address validator, uint256 index) private {
    // step 1: modify status of the validator
    MaintainInfo storage maintainInfo = maintainInfoMap[validator];
    maintainInfo.isMaintaining = true;
    maintainInfo.startBlockNumber = block.number;

    // step 2: add the validator to maintainingValidatorSet
    maintainingValidatorSet.push(currentValidatorSet[index]);
    maintainInfo.index = maintainingValidatorSet.length;

    // step 3: remove the validator from currentValidatorSet
    _removeFromCurrentValidatorSet(validator, index);

    emit validatorEnterMaintenance(validator);
  }

  function _exitMaintenance(address validator) private returns (bool isFelony){
    // step 1: modify status of the validator
    MaintainInfo storage maintainInfo = maintainInfoMap[validator];
    maintainInfo.isMaintaining = false;

    // step 2: add the validator to currentValidatorSet
    // the actual index
    uint256 index = maintainInfo.index - 1;
    currentValidatorSet.push(maintainingValidatorSet[index]);
    currentValidatorSetMap[validator] = currentValidatorSet.length;

    // step 3: remove the validator from maintainingValidatorSet
    // 0 is the `sentinel value`
    maintainInfo.index = 0;
    // It is ok that the maintainingValidatorSet is not in order.
    if (index != maintainingValidatorSet.length - 1) {
      maintainingValidatorSet[index] = maintainingValidatorSet[maintainingValidatorSet.length - 1];
      maintainInfoMap[maintainingValidatorSet[index].consensusAddress].index = index + 1;
    }
    maintainingValidatorSet.pop();
    emit validatorExitMaintenance(validator);

    // step 4: slash
    if (maintainSlashScale == 0 || currentValidatorSet.length == 0) {
      // should not happen, still protect
      return false;
    }

    uint256 slashCount =
      block.number.sub(maintainInfo.startBlockNumber).div(currentValidatorSet.length).div(maintainSlashScale);

    (uint256 misdemeanorThreshold, uint256 felonyThreshold) = ISlashIndicator(SLASH_CONTRACT_ADDR).getSlashThresholds();
    isFelony = false;
    if (slashCount >= felonyThreshold) {
      _felony(validator);
      ISlashIndicator(SLASH_CONTRACT_ADDR).sendFelonyPackage(validator);
      isFelony = true;
    } else if (slashCount >= misdemeanorThreshold) {
      _misdemeanor(validator);
    }
  }

  //rlp encode & decode function
  function decodeValidatorSetSynPackage(bytes memory msgBytes) internal pure returns (IbcValidatorSetPackage memory, bool) {
    IbcValidatorSetPackage memory validatorSetPkg;

    RLPDecode.Iterator memory iter = msgBytes.toRLPItem().iterator();
    bool success = false;
    uint256 idx=0;
    while (iter.hasNext()) {
      if (idx == 0) {
        validatorSetPkg.packageType = uint8(iter.next().toUint());
      } else if (idx == 1) {
        RLPDecode.RLPItem[] memory items = iter.next().toList();
        validatorSetPkg.validatorSet =new Validator[](items.length);
        for (uint j = 0;j<items.length;j++) {
          (Validator memory val, bool ok) = decodeValidator(items[j]);
          if (!ok) {
            return (validatorSetPkg, false);
          }
          validatorSetPkg.validatorSet[j] = val;
        }
        success = true;
      } else {
        break;
      }
      idx++;
    }
    return (validatorSetPkg, success);
  }

  function decodeValidator(RLPDecode.RLPItem memory itemValidator) internal pure returns(Validator memory, bool) {
    Validator memory validator;
    RLPDecode.Iterator memory iter = itemValidator.iterator();
    bool success = false;
    uint256 idx=0;
    while (iter.hasNext()) {
      if (idx == 0) {
        validator.consensusAddress = iter.next().toAddress();
      } else if (idx == 1) {
        validator.feeAddress = address(uint160(iter.next().toAddress()));
      } else if (idx == 2) {
        validator.BBCFeeAddress = iter.next().toAddress();
      } else if (idx == 3) {
        validator.votingPower = uint64(iter.next().toUint());
        success = true;
      } else {
        break;
      }
      idx++;
    }
    return (validator, success);
  }
}
