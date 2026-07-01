// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/UmbraOTC.sol";

contract Deploy is Script {
    // Arc Testnet system contracts
    address constant USDC_ARC = 0x3600000000000000000000000000000000000000;
    address constant EURC_ARC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;

    function run() public returns (UmbraOTC otc) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deploying UmbraOTC from:", deployer);
        console.log("USDC:", USDC_ARC);
        console.log("EURC:", EURC_ARC);

        vm.startBroadcast(deployerKey);
        otc = new UmbraOTC(USDC_ARC, EURC_ARC);
        vm.stopBroadcast();

        console.log("UmbraOTC deployed at:", address(otc));
    }
}
