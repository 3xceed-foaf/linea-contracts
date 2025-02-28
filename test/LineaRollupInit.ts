import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { TestLineaRollup, LineaRollupInit__factory } from "../typechain-types";
import { INITIAL_WITHDRAW_LIMIT, ONE_DAY_IN_SECONDS, VERY_HIGH_MIGRATION_BLOCK } from "./utils/constants";
import { deployUpgradableFromFactory } from "./utils/deployment";
import { getProverTestData } from "./utils/helpers";

describe("ZK EVM Init contract", () => {
  let LineaRollup: TestLineaRollup;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let admin: SignerWithAddress;
  let verifier: string;
  let securityCouncil: SignerWithAddress;
  let operator: SignerWithAddress;

  const { parentStateRootHash, firstBlockNumber } = getProverTestData("Light", "output-file.json");

  async function deployLineaRollupFixture() {
    const PlonkVerifierFactory = await ethers.getContractFactory("PlonkVerifier");
    const plonkVerifier = await PlonkVerifierFactory.deploy();
    await plonkVerifier.deployed();

    verifier = plonkVerifier.address;

    const LineaRollup = (await deployUpgradableFromFactory(
      "TestLineaRollup",
      [
        parentStateRootHash,
        firstBlockNumber - 1,
        verifier,
        securityCouncil.address,
        [operator.address],
        ONE_DAY_IN_SECONDS,
        INITIAL_WITHDRAW_LIMIT,
        VERY_HIGH_MIGRATION_BLOCK,
      ],
      {
        initializer: "initialize(bytes32,uint256,address,address,address[],uint256,uint256,uint256)",
        unsafeAllow: ["constructor"],
      },
    )) as TestLineaRollup;

    return { LineaRollup };
  }

  before(async () => {
    [admin, securityCouncil, operator] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const contracts = await loadFixture(deployLineaRollupFixture);
    LineaRollup = contracts.LineaRollup;
  });

  describe("Re-initialisation", () => {
    LineaRollupInit__factory.createInterface();

    it("Should set the initial block number", async () => {
      const l2block = ethers.BigNumber.from(12121);
      const l2BlockNumber = await LineaRollup.currentL2BlockNumber();
      const lineaRollupContract = await deployUpgradableFromFactory("LineaRollupInit", [l2block, parentStateRootHash], {
        initializer: "initializeV2(uint256,bytes32)",
        unsafeAllow: ["constructor"],
      });
      const currentL2BlockNumber = await lineaRollupContract.currentL2BlockNumber();

      expect(currentL2BlockNumber).to.be.equal(l2block);
      expect(currentL2BlockNumber).to.not.be.equal(l2BlockNumber);
      expect(await LineaRollup.periodInSeconds()).to.be.equal(ONE_DAY_IN_SECONDS);
      expect(lineaRollupContract.stateRootHashes(l2block)).to.not.be.equal(
        LineaRollup.stateRootHashes(parentStateRootHash),
      );
    });

    it("Cannot initialize twice", async () => {
      const l2block = ethers.BigNumber.from(12121);
      const l2BlockNumber = await LineaRollup.currentL2BlockNumber();
      const lineaRollupContract = await deployUpgradableFromFactory("LineaRollupInit", [l2block, parentStateRootHash], {
        initializer: "initializeV2(uint256,bytes32)",
        unsafeAllow: ["constructor"],
      });

      await expect(lineaRollupContract.initializeV2(l2BlockNumber, parentStateRootHash)).to.be.revertedWith(
        "Initializable: contract is already initialized",
      );
    });
  });
});
