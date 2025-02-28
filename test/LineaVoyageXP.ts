import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { LineaVoyageXP } from "../typechain-types";
import { MINTER_ROLE, DEFAULT_ADMIN_ROLE } from "./utils/constants";
import { deployFromFactory } from "./utils/deployment";
import { BigNumber } from "ethers";

describe("Linea Voyage XP Token Tests", () => {
  let contract: LineaVoyageXP;
  let minter: SignerWithAddress;
  let deployer: SignerWithAddress;

  async function deployLineaVoyageXPFixture() {
    return deployFromFactory("LineaVoyageXP", minter.address) as Promise<LineaVoyageXP>;
  }

  before(async () => {
    [deployer, minter] = await ethers.getSigners();
  });

  beforeEach(async () => {
    contract = await loadFixture(deployLineaVoyageXPFixture);
  });

  describe("Initialization and roles", () => {
    it("minter should have the 'MINTER_ROLE' role", async () => {
      expect(await contract.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("minter address should have the 'DEFAULT_ADMIN_ROLE' role", async () => {
      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, minter.address)).to.be.true;
    });

    it("deployer should NOT have the 'MINTER_ROLE' role", async () => {
      expect(await contract.hasRole(MINTER_ROLE, deployer.address)).to.be.false;
    });

    it("deployer should NOT have the 'DEFAULT_ADMIN_ROLE' role", async () => {
      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.false;
    });
  });

  // commented out for linter, but leaving placeholders

  describe("Single minting", () => {
    it("non-minter cannot mint tokens", async () => {
      await expect(contract.connect(deployer).mint(deployer.address, BigNumber.from(1000))).to.be.revertedWith(
        "AccessControl: account " + deployer.address.toLowerCase() + " is missing role " + MINTER_ROLE,
      );
    });

    it("minter can mint tokens", async () => {
      await contract.connect(minter).mint(deployer.address, BigNumber.from(1000));

      expect(await contract.balanceOf(deployer.address)).to.be.equal(BigNumber.from(1000));
    });
  });

  describe("Batch minting with one amount", () => {
    it("non-minter cannot mint tokens", async () => {
      await expect(contract.batchMint([deployer.address], BigNumber.from(1000))).to.be.revertedWith(
        "AccessControl: account " + deployer.address.toLowerCase() + " is missing role " + MINTER_ROLE,
      );
    });

    it("minter can mint tokens for one address", async () => {
      await contract.connect(minter).batchMint([deployer.address], BigNumber.from(1000));

      expect(await contract.balanceOf(deployer.address)).to.be.equal(BigNumber.from(1000));
    });

    it("minter can mint tokens for multiple address", async () => {
      await contract.connect(minter).batchMint([minter.address, deployer.address], BigNumber.from(1000));

      expect(await contract.balanceOf(deployer.address)).to.be.equal(BigNumber.from(1000));
      expect(await contract.balanceOf(minter.address)).to.be.equal(BigNumber.from(1000));
    });
  });

  describe("Batch minting with varying amounts", () => {
    it("non-minter cannot mint tokens", async () => {
      await expect(contract.batchMintMultiple([deployer.address], [BigNumber.from(1000)])).to.be.revertedWith(
        "AccessControl: account " + deployer.address.toLowerCase() + " is missing role " + MINTER_ROLE,
      );
    });

    it("minter can mint tokens for one address", async () => {
      await contract.connect(minter).batchMintMultiple([deployer.address], [BigNumber.from(1000)]);

      expect(await contract.balanceOf(deployer.address)).to.be.equal(BigNumber.from(1000));
    });

    it("minter can mint tokens for multiple address with different amounts", async () => {
      await contract
        .connect(minter)
        .batchMintMultiple([minter.address, deployer.address], [BigNumber.from(1000), BigNumber.from(2000)]);

      expect(await contract.balanceOf(deployer.address)).to.be.equal(BigNumber.from(2000));
      expect(await contract.balanceOf(minter.address)).to.be.equal(BigNumber.from(1000));
    });

    it("cannot mint when array lengths are different", async () => {
      await expect(
        contract.connect(minter).batchMintMultiple([minter.address, deployer.address], [BigNumber.from(1000)]),
      ).to.be.revertedWith("Array lengths do not match");
    });
  });

  describe("Tokens are SoulBound", () => {
    it("cannot approve token amounts", async () => {
      await expect(
        contract.connect(deployer).approve(minter.address, BigNumber.from(1000)),
      ).to.be.revertedWithCustomError(contract, "TokenIsSoulBound");
    });

    it("cannot transfer token amounts", async () => {
      await expect(
        contract.connect(deployer).transfer(minter.address, BigNumber.from(1000)),
      ).to.be.revertedWithCustomError(contract, "TokenIsSoulBound");
    });

    it("cannot transfer from allowance amounts", async () => {
      await expect(
        contract.connect(deployer).transferFrom(deployer.address, minter.address, BigNumber.from(1000)),
      ).to.be.revertedWithCustomError(contract, "TokenIsSoulBound");
    });

    it("cannot increase token allowance amounts", async () => {
      await expect(
        contract.connect(deployer).increaseAllowance(minter.address, BigNumber.from(1000)),
      ).to.be.revertedWithCustomError(contract, "TokenIsSoulBound");
    });

    it("cannot decrease token allowance amounts", async () => {
      await expect(
        contract.connect(deployer).decreaseAllowance(minter.address, BigNumber.from(1000)),
      ).to.be.revertedWithCustomError(contract, "TokenIsSoulBound");
    });
  });

  describe("Role management", () => {
    it("can renounce DEFAULT_ADMIN_ROLE role and not grant roles", async () => {
      await contract.connect(minter).renounceRole(DEFAULT_ADMIN_ROLE, minter.address);

      await expect(contract.connect(minter).grantRole(DEFAULT_ADMIN_ROLE, minter.address)).to.be.revertedWith(
        "AccessControl: account " + minter.address.toLowerCase() + " is missing role " + DEFAULT_ADMIN_ROLE,
      );
    });

    it("can renounce MINTER_ROLE role and not mint single address tokens", async () => {
      await contract.connect(minter).renounceRole(MINTER_ROLE, minter.address);

      await expect(contract.connect(minter).mint(deployer.address, BigNumber.from(1000))).to.be.revertedWith(
        "AccessControl: account " + minter.address.toLowerCase() + " is missing role " + MINTER_ROLE,
      );
    });

    it("can renounce MINTER_ROLE role and not mint multiple address tokens", async () => {
      await contract.connect(minter).renounceRole(MINTER_ROLE, minter.address);

      await expect(contract.connect(minter).batchMint([deployer.address], BigNumber.from(1000))).to.be.revertedWith(
        "AccessControl: account " + minter.address.toLowerCase() + " is missing role " + MINTER_ROLE,
      );
    });

    it("can renounce MINTER_ROLE role and not mint multiple address tokens with different amounts", async () => {
      await contract.connect(minter).renounceRole(MINTER_ROLE, minter.address);

      await expect(
        contract.connect(minter).batchMintMultiple([deployer.address], [BigNumber.from(1000)]),
      ).to.be.revertedWith(
        "AccessControl: account " + minter.address.toLowerCase() + " is missing role " + MINTER_ROLE,
      );
    });
  });

  describe.skip("Gas limitations", () => {
    it("Can mint for 1000 addresses with the same amount", async () => {
      const randomWallets = [];
      for (let i = 0; i < 1000; i++) {
        randomWallets.push(ethers.Wallet.createRandom().address);
      }

      await contract.connect(minter).batchMint(randomWallets, BigNumber.from(1000), { gasLimit: 26000000 });
    }).timeout(200_000);

    it("Can mint for 1000 addresses with the different amounts amount", async () => {
      const randomWallets = [];
      const amounts = [];

      for (let i = 0; i < 1000; i++) {
        randomWallets.push(ethers.Wallet.createRandom().address);
        amounts.push(BigNumber.from(i + 100));
      }

      await contract.connect(minter).batchMintMultiple(randomWallets, amounts, { gasLimit: 26000000 });
    }).timeout(200_000);
  });
});
