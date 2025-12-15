import { ponder } from "@/generated";
import { keccak256, toHex } from "viem";

const VAULT_ADDRESS = "0x64Be1630ffD8144EB52896dCD099C805B93328e3".toLowerCase() as `0x${string}`;

const normalize = (address: string | `0x${string}` | undefined | null): `0x${string}` | undefined =>
  address ? (address.toLowerCase() as `0x${string}`) : undefined;

const makeId = (...parts: (string | number | bigint | undefined | null)[]) =>
  parts.filter((p) => p !== undefined && p !== null && `${p}`.length > 0).join("-");

function calculateSharePrice(totalAssets: bigint, totalSupply: bigint): string {
  if (totalSupply === 0n) return "1.0";
  const price = Number(totalAssets) / Number(totalSupply);
  return price.toString();
}

function calculateUtilizationRate(totalOutstandingLoans: bigint, totalAssets: bigint): string {
  if (totalAssets === 0n) return "0";
  const rate = (Number(totalOutstandingLoans) / Number(totalAssets)) * 100;
  return rate.toString();
}

function getInterestTypeString(interestType: number): string {
  return interestType === 0 ? "SIMPLE" : "COMPOUND";
}

function getCompoundingPeriodString(period: number): string {
  switch (period) {
    case 0: return "MONTHLY";
    case 1: return "QUARTERLY";
    case 2: return "ANNUALLY";
    default: return "MONTHLY";
  }
}

function getRoleName(roleHash: `0x${string}`): string {
  const ADMIN_ROLE = keccak256(toHex("ADMIN_ROLE"));
  const RELAYER_ROLE = keccak256(toHex("RELAYER_ROLE"));
  const PAYOR_ROLE = keccak256(toHex("PAYOR_ROLE"));
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  if (roleHash === ADMIN_ROLE) return "ADMIN_ROLE";
  if (roleHash === RELAYER_ROLE) return "RELAYER_ROLE";
  if (roleHash === PAYOR_ROLE) return "PAYOR_ROLE";
  if (roleHash === DEFAULT_ADMIN_ROLE) return "DEFAULT_ADMIN_ROLE";
  return "UNKNOWN_ROLE";
}

const ensureVault = async (context: any, timestamp: bigint) => {
  return await context.db.lendingVaults.upsert({
    id: VAULT_ADDRESS,
    create: {
      totalAssets: 0n,
      totalSupply: 0n,
      totalUnrealizedInterest: 0n,
      totalOutstandingLoans: 0n,
      totalLoansIssued: 0,
      totalInterestEarned: 0n,
      totalDefaultedAmount: 0n,
      totalWrittenOff: 0n,
      activeLoansCount: 0,
      defaultedLoansCount: 0,
      repaidLoansCount: 0,
      totalDeposited: 0n,
      totalWithdrawn: 0n,
      initialSharePrice: "1.0",
      currentSharePrice: "1.0",
      averageInterestRate: "0",
      utilizationRate: "0",
      kycEnabled: false,
      kycRegistry: undefined,
      createdAt: timestamp,
      lastUpdateAt: timestamp,
    },
    update: {},
  });
};

const ensureLender = async (context: any, investorAddress: `0x${string}`, timestamp: bigint) => {
  const vaultId = VAULT_ADDRESS;
  const lenderId = makeId(vaultId, investorAddress);

  const lender = await context.db.lenders.upsert({
    id: lenderId,
    create: {
      vaultId,
      address: investorAddress,
      shares: 0n,
      deposited: 0n,
      withdrawn: 0n,
      realizedGains: 0n,
      unrealizedGains: 0n,
      totalInterestEarned: 0n,
      lastInterestUpdate: timestamp,
      firstDepositTime: undefined,
      lastActivityTime: timestamp,
      depositCount: 0,
      withdrawCount: 0,
      currentValue: 0n,
    },
    update: {},
  });
  return { lenderId, lender };
};

const ensureBorrower = async (context: any, borrowerAddress: `0x${string}`, timestamp: bigint) => {
  const vaultId = VAULT_ADDRESS;
  const borrowerId = makeId(vaultId, borrowerAddress);

  const borrower = await context.db.borrowers.upsert({
    id: borrowerId,
    create: {
      vaultId,
      address: borrowerAddress,
      totalBorrowed: 0n,
      totalRepaid: 0n,
      totalInterestPaid: 0n,
      totalPrincipalPaid: 0n,
      currentOutstanding: 0n,
      currentInterestAccrued: 0n,
      totalLoansCount: 0,
      activeLoansCount: 0,
      repaidLoansCount: 0,
      defaultedLoansCount: 0,
      averageInterestRate: "0",
      onTimePaymentRate: "100",
      defaultRate: "0",
      kycVerified: false,
      kycExpiration: undefined,
      firstLoanTime: undefined,
      lastActivityTime: timestamp,
    },
    update: {},
  });
  return { borrowerId, borrower };
};

ponder.on("SecureVaultExtendedLending:DepositRequested", async ({ event, context }) => {
  await ensureVault(context, event.block.timestamp);

  const investorAddress = normalize(event.args.investor)!;
  const { lenderId } = await ensureLender(context, investorAddress, event.block.timestamp);

  const requestId = makeId(VAULT_ADDRESS, event.args.requestId.toString());

  await context.db.depositRequests.create({
    id: requestId,
    data: {
      vaultId: VAULT_ADDRESS,
      lenderId,
      requestId: event.args.requestId,
      receiver: normalize(event.args.receiver)!,
      assetsRequested: event.args.assets,
      assetsProcessed: 0n,
      sharesIssued: 0n,
      status: "PENDING",
      fullyExecuted: false,
      requestTime: event.block.timestamp,
      lastExecuteTime: undefined,
      executionSharePrice: undefined,
    },
  });
});

ponder.on("SecureVaultExtendedLending:DepositExecuted", async ({ event, context }) => {
  const vault = await ensureVault(context, event.block.timestamp);

  const investorAddress = normalize(event.args.investor)!;
  const { lenderId, lender } = await ensureLender(context, investorAddress, event.block.timestamp);
  const requestId = makeId(VAULT_ADDRESS, event.args.requestId.toString());

  const existingRequest = await context.db.depositRequests.findUnique({ id: requestId });

  if (existingRequest) {
    const newAssetsProcessed = existingRequest.assetsProcessed + event.args.assetsProcessed;
    const newSharesIssued = existingRequest.sharesIssued + event.args.sharesIssued;

    await context.db.depositRequests.update({
      id: requestId,
      data: {
        assetsProcessed: newAssetsProcessed,
        sharesIssued: newSharesIssued,
        status: event.args.fullyExecuted ? "COMPLETED" : "PARTIAL",
        fullyExecuted: event.args.fullyExecuted,
        lastExecuteTime: event.block.timestamp,
        executionSharePrice: event.args.sharesIssued > 0n
          ? calculateSharePrice(event.args.assetsProcessed, event.args.sharesIssued)
          : undefined,
      },
    });
  }

  const executionId = makeId(requestId, event.transaction.hash, event.log.logIndex.toString());
  await context.db.depositExecutions.create({
    id: executionId,
    data: {
      requestId,
      vaultId: VAULT_ADDRESS,
      assetsProcessed: event.args.assetsProcessed,
      sharesIssued: event.args.sharesIssued,
      fullyExecuted: event.args.fullyExecuted,
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
    },
  });

  await context.db.lenders.update({
    id: lenderId,
    data: {
      shares: lender.shares + event.args.sharesIssued,
      deposited: lender.deposited + event.args.assetsProcessed,
      lastActivityTime: event.block.timestamp,
      depositCount: lender.depositCount + (event.args.fullyExecuted ? 1 : 0),
      firstDepositTime: lender.firstDepositTime ?? event.block.timestamp,
      currentValue: lender.currentValue + event.args.assetsProcessed,
    },
  });

  const newTotalAssets = vault.totalAssets + event.args.assetsProcessed;
  const newTotalSupply = vault.totalSupply + event.args.sharesIssued;
  await context.db.lendingVaults.update({
    id: VAULT_ADDRESS,
    data: {
      totalAssets: newTotalAssets,
      totalSupply: newTotalSupply,
      totalDeposited: vault.totalDeposited + event.args.assetsProcessed,
      currentSharePrice: calculateSharePrice(newTotalAssets, newTotalSupply),
      utilizationRate: calculateUtilizationRate(vault.totalOutstandingLoans, newTotalAssets),
      lastUpdateAt: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:WithdrawRequested", async ({ event, context }) => {
  await ensureVault(context, event.block.timestamp);

  const investorAddress = normalize(event.args.investor)!;
  const { lenderId } = await ensureLender(context, investorAddress, event.block.timestamp);

  const requestId = makeId(VAULT_ADDRESS, "withdraw", event.args.requestId.toString());

  await context.db.withdrawRequests.create({
    id: requestId,
    data: {
      vaultId: VAULT_ADDRESS,
      lenderId,
      requestId: event.args.requestId,
      receiver: normalize(event.args.receiver)!,
      sharesRequested: event.args.shares,
      sharesProcessed: 0n,
      assetsReturned: 0n,
      status: "PENDING",
      fullyExecuted: false,
      requestTime: event.block.timestamp,
      lastExecuteTime: undefined,
      executionSharePrice: undefined,
    },
  });
});

ponder.on("SecureVaultExtendedLending:WithdrawExecuted", async ({ event, context }) => {
  const vault = await ensureVault(context, event.block.timestamp);

  const investorAddress = normalize(event.args.investor)!;
  const { lenderId, lender } = await ensureLender(context, investorAddress, event.block.timestamp);
  const requestId = makeId(VAULT_ADDRESS, "withdraw", event.args.requestId.toString());

  const existingRequest = await context.db.withdrawRequests.findUnique({ id: requestId });

  if (existingRequest) {
    const newSharesProcessed = existingRequest.sharesProcessed + event.args.sharesProcessed;
    const newAssetsReturned = existingRequest.assetsReturned + event.args.assetsReturned;

    await context.db.withdrawRequests.update({
      id: requestId,
      data: {
        sharesProcessed: newSharesProcessed,
        assetsReturned: newAssetsReturned,
        status: event.args.fullyExecuted ? "COMPLETED" : "PARTIAL",
        fullyExecuted: event.args.fullyExecuted,
        lastExecuteTime: event.block.timestamp,
        executionSharePrice: event.args.sharesProcessed > 0n
          ? calculateSharePrice(event.args.assetsReturned, event.args.sharesProcessed)
          : undefined,
      },
    });
  }

  const executionId = makeId(requestId, event.transaction.hash, event.log.logIndex.toString());
  await context.db.withdrawExecutions.create({
    id: executionId,
    data: {
      requestId,
      vaultId: VAULT_ADDRESS,
      sharesProcessed: event.args.sharesProcessed,
      assetsReturned: event.args.assetsReturned,
      feeShares: undefined,
      fullyExecuted: event.args.fullyExecuted,
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
    },
  });

  await context.db.lenders.update({
    id: lenderId,
    data: {
      shares: lender.shares - event.args.sharesProcessed,
      withdrawn: lender.withdrawn + event.args.assetsReturned,
      lastActivityTime: event.block.timestamp,
      withdrawCount: lender.withdrawCount + (event.args.fullyExecuted ? 1 : 0),
      currentValue: lender.currentValue > event.args.assetsReturned
        ? lender.currentValue - event.args.assetsReturned
        : 0n,
    },
  });

  const newTotalAssets = vault.totalAssets > event.args.assetsReturned
    ? vault.totalAssets - event.args.assetsReturned
    : 0n;
  const newTotalSupply = vault.totalSupply > event.args.sharesProcessed
    ? vault.totalSupply - event.args.sharesProcessed
    : 0n;
  await context.db.lendingVaults.update({
    id: VAULT_ADDRESS,
    data: {
      totalAssets: newTotalAssets,
      totalSupply: newTotalSupply,
      totalWithdrawn: vault.totalWithdrawn + event.args.assetsReturned,
      currentSharePrice: calculateSharePrice(newTotalAssets, newTotalSupply),
      utilizationRate: calculateUtilizationRate(vault.totalOutstandingLoans, newTotalAssets),
      lastUpdateAt: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:AdminWithdrawal", async ({ event, context }) => {
  const vault = await ensureVault(context, event.block.timestamp);

  const withdrawalId = makeId(VAULT_ADDRESS, "admin", event.transaction.hash, event.log.logIndex.toString());

  await context.db.adminWithdrawals.create({
    id: withdrawalId,
    data: {
      vaultId: VAULT_ADDRESS,
      shareholder: normalize(event.args.shareholder)!,
      receiver: normalize(event.args.receiver)!,
      shares: event.args.shares,
      assets: event.args.assets,
      feeShares: event.args.feeShares,
      feeRecipient: normalize(event.args.feeRecipient),
      timestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
    },
  });

  const shareholderAddress = normalize(event.args.shareholder)!;
  const { lenderId, lender } = await ensureLender(context, shareholderAddress, event.block.timestamp);

  await context.db.lenders.update({
    id: lenderId,
    data: {
      shares: lender.shares > event.args.shares ? lender.shares - event.args.shares : 0n,
      withdrawn: lender.withdrawn + event.args.assets,
      lastActivityTime: event.block.timestamp,
      withdrawCount: lender.withdrawCount + 1,
    },
  });

  const newTotalSupply = vault.totalSupply > event.args.shares
    ? vault.totalSupply - event.args.shares
    : 0n;
  const newTotalAssets = vault.totalAssets > event.args.assets
    ? vault.totalAssets - event.args.assets
    : 0n;
  await context.db.lendingVaults.update({
    id: VAULT_ADDRESS,
    data: {
      totalAssets: newTotalAssets,
      totalSupply: newTotalSupply,
      totalWithdrawn: vault.totalWithdrawn + event.args.assets,
      currentSharePrice: calculateSharePrice(newTotalAssets, newTotalSupply),
      lastUpdateAt: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:LoanIssued", async ({ event, context }) => {
  const vault = await ensureVault(context, event.block.timestamp);

  const borrowerAddress = normalize(event.args.borrower)!;
  const { borrowerId, borrower } = await ensureBorrower(context, borrowerAddress, event.block.timestamp);

  const loanDbId = makeId(VAULT_ADDRESS, event.args.loanId.toString());

  await context.db.loans.create({
    id: loanDbId,
    data: {
      vaultId: VAULT_ADDRESS,
      loanId: event.args.loanId,
      borrowerId,
      principal: event.args.principal,
      interestRateBps: Number(event.args.interestRate),
      interestType: getInterestTypeString(Number(event.args.interestType)),
      compoundingPeriod: getCompoundingPeriodString(Number(event.args.compoundingPeriod)),
      startTimestamp: event.args.timestamp,
      maturityTimestamp: undefined,
      gracePeriodDays: 0,
      disbursementTimestamp: event.args.timestamp,
      minPaymentAmount: 0n,
      lateFeeRateBps: 0,
      outstandingPrincipal: event.args.principal,
      accruedInterest: 0n,
      totalInterestPaid: 0n,
      totalPrincipalPaid: 0n,
      status: "ACTIVE",
      lastInterestUpdateTimestamp: event.args.timestamp,
      lastPaymentTimestamp: undefined,
      defaultTimestamp: undefined,
      totalPaid: 0n,
      totalOwed: event.args.principal,
      isLate: false,
      daysLate: 0,
      currentInterestRate: Number(event.args.interestRate),
      agreementHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      agreementContract: undefined,
      paymentCount: 0,
      latePaymentCount: 0,
    },
  });

  await context.db.borrowers.update({
    id: borrowerId,
    data: {
      totalBorrowed: borrower.totalBorrowed + event.args.principal,
      currentOutstanding: borrower.currentOutstanding + event.args.principal,
      totalLoansCount: borrower.totalLoansCount + 1,
      activeLoansCount: borrower.activeLoansCount + 1,
      firstLoanTime: borrower.firstLoanTime ?? event.block.timestamp,
      lastActivityTime: event.block.timestamp,
    },
  });

  const newTotalOutstanding = vault.totalOutstandingLoans + event.args.principal;
  await context.db.lendingVaults.update({
    id: VAULT_ADDRESS,
    data: {
      totalOutstandingLoans: newTotalOutstanding,
      totalLoansIssued: vault.totalLoansIssued + 1,
      activeLoansCount: vault.activeLoansCount + 1,
      utilizationRate: calculateUtilizationRate(newTotalOutstanding, vault.totalAssets),
      lastUpdateAt: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:LoanPayment", async ({ event, context }) => {
  const vault = await ensureVault(context, event.block.timestamp);

  const payerAddress = normalize(event.args.payer)!;
  const loanDbId = makeId(VAULT_ADDRESS, event.args.loanId.toString());

  const loan = await context.db.loans.findUnique({ id: loanDbId });
  if (!loan) return;

  const paymentId = makeId(loanDbId, event.transaction.hash, event.log.logIndex.toString());

  await context.db.loanPayments.create({
    id: paymentId,
    data: {
      loanId: loanDbId,
      borrowerId: loan.borrowerId,
      payer: payerAddress,
      totalPayment: event.args.totalPayment,
      interestPaid: event.args.interestPaid,
      principalPaid: event.args.principalPaid,
      lateFeesPaid: 0n,
      remainingPrincipal: event.args.remainingPrincipal,
      remainingInterest: event.args.remainingInterest,
      timestamp: event.args.timestamp,
      daysLate: 0,
      wasLate: false,
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
    },
  });

  await context.db.loans.update({
    id: loanDbId,
    data: {
      outstandingPrincipal: event.args.remainingPrincipal,
      accruedInterest: event.args.remainingInterest,
      totalInterestPaid: loan.totalInterestPaid + event.args.interestPaid,
      totalPrincipalPaid: loan.totalPrincipalPaid + event.args.principalPaid,
      totalPaid: loan.totalPaid + event.args.totalPayment,
      totalOwed: event.args.remainingPrincipal + event.args.remainingInterest,
      lastPaymentTimestamp: event.args.timestamp,
      lastInterestUpdateTimestamp: event.args.timestamp,
      paymentCount: loan.paymentCount + 1,
    },
  });

  const borrower = await context.db.borrowers.findUnique({ id: loan.borrowerId });
  if (borrower) {
    await context.db.borrowers.update({
      id: loan.borrowerId,
      data: {
        totalRepaid: borrower.totalRepaid + event.args.totalPayment,
        totalInterestPaid: borrower.totalInterestPaid + event.args.interestPaid,
        totalPrincipalPaid: borrower.totalPrincipalPaid + event.args.principalPaid,
        currentOutstanding: borrower.currentOutstanding > event.args.principalPaid
          ? borrower.currentOutstanding - event.args.principalPaid
          : 0n,
        lastActivityTime: event.block.timestamp,
      },
    });
  }

  const newTotalOutstanding = vault.totalOutstandingLoans > event.args.principalPaid
    ? vault.totalOutstandingLoans - event.args.principalPaid
    : 0n;
  await context.db.lendingVaults.update({
    id: VAULT_ADDRESS,
    data: {
      totalOutstandingLoans: newTotalOutstanding,
      totalInterestEarned: vault.totalInterestEarned + event.args.interestPaid,
      utilizationRate: calculateUtilizationRate(newTotalOutstanding, vault.totalAssets),
      lastUpdateAt: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:LoanFullyRepaid", async ({ event, context }) => {
  const vault = await ensureVault(context, event.block.timestamp);

  const loanDbId = makeId(VAULT_ADDRESS, event.args.loanId.toString());
  const loan = await context.db.loans.findUnique({ id: loanDbId });
  if (!loan) return;

  await context.db.loans.update({
    id: loanDbId,
    data: {
      status: "REPAID",
      outstandingPrincipal: 0n,
      accruedInterest: 0n,
      totalOwed: 0n,
      totalInterestPaid: event.args.totalInterestPaid,
      totalPrincipalPaid: event.args.totalPrincipalPaid,
      totalPaid: event.args.totalPrincipalPaid + event.args.totalInterestPaid,
      lastInterestUpdateTimestamp: event.args.timestamp,
    },
  });

  const borrower = await context.db.borrowers.findUnique({ id: loan.borrowerId });
  if (borrower) {
    await context.db.borrowers.update({
      id: loan.borrowerId,
      data: {
        activeLoansCount: borrower.activeLoansCount > 0 ? borrower.activeLoansCount - 1 : 0,
        repaidLoansCount: borrower.repaidLoansCount + 1,
        currentOutstanding: 0n,
        lastActivityTime: event.block.timestamp,
      },
    });
  }

  await context.db.lendingVaults.update({
    id: VAULT_ADDRESS,
    data: {
      activeLoansCount: vault.activeLoansCount > 0 ? vault.activeLoansCount - 1 : 0,
      repaidLoansCount: vault.repaidLoansCount + 1,
      lastUpdateAt: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:LoanDefaulted", async ({ event, context }) => {
  const vault = await ensureVault(context, event.block.timestamp);

  const loanDbId = makeId(VAULT_ADDRESS, event.args.loanId.toString());
  const loan = await context.db.loans.findUnique({ id: loanDbId });
  if (!loan) return;

  await context.db.loans.update({
    id: loanDbId,
    data: {
      status: "DEFAULTED",
      outstandingPrincipal: event.args.outstandingPrincipal,
      accruedInterest: event.args.outstandingInterest,
      defaultTimestamp: event.args.timestamp,
      lastInterestUpdateTimestamp: event.args.timestamp,
    },
  });

  const borrower = await context.db.borrowers.findUnique({ id: loan.borrowerId });
  if (borrower) {
    await context.db.borrowers.update({
      id: loan.borrowerId,
      data: {
        activeLoansCount: borrower.activeLoansCount > 0 ? borrower.activeLoansCount - 1 : 0,
        defaultedLoansCount: borrower.defaultedLoansCount + 1,
        lastActivityTime: event.block.timestamp,
      },
    });
  }

  await context.db.lendingVaults.update({
    id: VAULT_ADDRESS,
    data: {
      activeLoansCount: vault.activeLoansCount > 0 ? vault.activeLoansCount - 1 : 0,
      defaultedLoansCount: vault.defaultedLoansCount + 1,
      totalDefaultedAmount: vault.totalDefaultedAmount + event.args.outstandingPrincipal,
      lastUpdateAt: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:LoanWrittenOff", async ({ event, context }) => {
  const vault = await ensureVault(context, event.block.timestamp);

  const loanDbId = makeId(VAULT_ADDRESS, event.args.loanId.toString());
  const loan = await context.db.loans.findUnique({ id: loanDbId });
  if (!loan) return;

  await context.db.loans.update({
    id: loanDbId,
    data: {
      status: "WRITTEN_OFF",
      lastInterestUpdateTimestamp: event.args.timestamp,
    },
  });

  await context.db.lendingVaults.update({
    id: VAULT_ADDRESS,
    data: {
      totalWrittenOff: vault.totalWrittenOff + event.args.amountWrittenOff,
      lastUpdateAt: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:KYCRegistrySet", async ({ event, context }) => {
  await ensureVault(context, event.block.timestamp);

  await context.db.lendingVaults.update({
    id: VAULT_ADDRESS,
    data: {
      kycRegistry: normalize(event.args.newRegistry),
      lastUpdateAt: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:KYCEnabled", async ({ event, context }) => {
  await ensureVault(context, event.block.timestamp);

  await context.db.lendingVaults.update({
    id: VAULT_ADDRESS,
    data: {
      kycEnabled: true,
      lastUpdateAt: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:KYCDisabled", async ({ event, context }) => {
  await ensureVault(context, event.block.timestamp);

  await context.db.lendingVaults.update({
    id: VAULT_ADDRESS,
    data: {
      kycEnabled: false,
      lastUpdateAt: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:RoleGranted", async ({ event, context }) => {
  await ensureVault(context, event.block.timestamp);

  const roleHash = event.args.role as `0x${string}`;
  const roleName = getRoleName(roleHash);
  const roleId = makeId(VAULT_ADDRESS, roleHash);

  const role = await context.db.accessControlRoles.upsert({
    id: roleId,
    create: {
      vaultId: VAULT_ADDRESS,
      roleHash,
      roleName,
      adminRoleHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      adminRoleName: "DEFAULT_ADMIN_ROLE",
      memberCount: 0,
      updatedAt: event.block.timestamp,
    },
    update: {},
  });

  const accountAddress = normalize(event.args.account)!;
  const memberId = makeId(roleId, accountAddress);

  await context.db.accessControlRoleMembers.upsert({
    id: memberId,
    create: {
      roleId,
      account: accountAddress,
      isActive: true,
      grantedAt: event.block.timestamp,
      revokedAt: undefined,
      grantTxHash: event.transaction.hash,
      revokeTxHash: undefined,
      grantBlockNumber: event.block.number,
      revokeBlockNumber: undefined,
      updatedAt: event.block.timestamp,
    },
    update: {
      isActive: true,
      grantedAt: event.block.timestamp,
      grantTxHash: event.transaction.hash,
      grantBlockNumber: event.block.number,
      revokedAt: undefined,
      revokeTxHash: undefined,
      revokeBlockNumber: undefined,
      updatedAt: event.block.timestamp,
    },
  });

  await context.db.accessControlRoles.update({
    id: roleId,
    data: {
      memberCount: role.memberCount + 1,
      updatedAt: event.block.timestamp,
    },
  });

  const eventId = makeId(roleId, "GRANTED", event.transaction.hash, event.log.logIndex.toString());
  await context.db.accessControlRoleEvents.create({
    id: eventId,
    data: {
      roleId,
      account: accountAddress,
      adminRoleHash: undefined,
      adminRoleName: undefined,
      eventType: "GRANTED",
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:RoleRevoked", async ({ event, context }) => {
  await ensureVault(context, event.block.timestamp);

  const roleHash = event.args.role as `0x${string}`;
  const roleId = makeId(VAULT_ADDRESS, roleHash);
  const accountAddress = normalize(event.args.account)!;
  const memberId = makeId(roleId, accountAddress);

  const existingMember = await context.db.accessControlRoleMembers.findUnique({ id: memberId });
  if (existingMember) {
    await context.db.accessControlRoleMembers.update({
      id: memberId,
      data: {
        isActive: false,
        revokedAt: event.block.timestamp,
        revokeTxHash: event.transaction.hash,
        revokeBlockNumber: event.block.number,
        updatedAt: event.block.timestamp,
      },
    });
  }

  const role = await context.db.accessControlRoles.findUnique({ id: roleId });
  if (role && role.memberCount > 0) {
    await context.db.accessControlRoles.update({
      id: roleId,
      data: {
        memberCount: role.memberCount - 1,
        updatedAt: event.block.timestamp,
      },
    });
  }

  const eventId = makeId(roleId, "REVOKED", event.transaction.hash, event.log.logIndex.toString());
  await context.db.accessControlRoleEvents.create({
    id: eventId,
    data: {
      roleId,
      account: accountAddress,
      adminRoleHash: undefined,
      adminRoleName: undefined,
      eventType: "REVOKED",
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
    },
  });
});

ponder.on("SecureVaultExtendedLending:RoleAdminChanged", async ({ event, context }) => {
  await ensureVault(context, event.block.timestamp);

  const roleHash = event.args.role as `0x${string}`;
  const roleName = getRoleName(roleHash);
  const roleId = makeId(VAULT_ADDRESS, roleHash);
  const newAdminRoleHash = event.args.newAdminRole as `0x${string}`;
  const newAdminRoleName = getRoleName(newAdminRoleHash);

  await context.db.accessControlRoles.upsert({
    id: roleId,
    create: {
      vaultId: VAULT_ADDRESS,
      roleHash,
      roleName,
      adminRoleHash: newAdminRoleHash,
      adminRoleName: newAdminRoleName,
      memberCount: 0,
      updatedAt: event.block.timestamp,
    },
    update: {
      adminRoleHash: newAdminRoleHash,
      adminRoleName: newAdminRoleName,
      updatedAt: event.block.timestamp,
    },
  });

  const eventId = makeId(roleId, "ADMIN_CHANGED", event.transaction.hash, event.log.logIndex.toString());
  await context.db.accessControlRoleEvents.create({
    id: eventId,
    data: {
      roleId,
      account: undefined,
      adminRoleHash: newAdminRoleHash,
      adminRoleName: newAdminRoleName,
      eventType: "ADMIN_CHANGED",
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
    },
  });
});
