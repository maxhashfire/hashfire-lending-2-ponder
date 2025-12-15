export const SecureVaultExtendedLendingAbi = [
  // Deposit Events
  {
    type: "event",
    name: "DepositRequested",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "investor", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DepositExecuted",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "investor", type: "address", indexed: true },
      { name: "assetsProcessed", type: "uint256", indexed: false },
      { name: "sharesIssued", type: "uint256", indexed: false },
      { name: "fullyExecuted", type: "bool", indexed: false },
    ],
  },

  // Withdrawal Events
  {
    type: "event",
    name: "WithdrawRequested",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "investor", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WithdrawExecuted",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "investor", type: "address", indexed: true },
      { name: "sharesProcessed", type: "uint256", indexed: false },
      { name: "assetsReturned", type: "uint256", indexed: false },
      { name: "fullyExecuted", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AdminWithdrawal",
    inputs: [
      { name: "shareholder", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "shares", type: "uint256", indexed: false },
      { name: "assets", type: "uint256", indexed: false },
      { name: "feeShares", type: "uint256", indexed: false },
      { name: "feeRecipient", type: "address", indexed: false },
    ],
  },

  // Loan Events
  {
    type: "event",
    name: "LoanIssued",
    inputs: [
      { name: "loanId", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
      { name: "interestRate", type: "uint256", indexed: false },
      { name: "interestType", type: "uint8", indexed: false },
      { name: "compoundingPeriod", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LoanPayment",
    inputs: [
      { name: "loanId", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "totalPayment", type: "uint256", indexed: false },
      { name: "interestPaid", type: "uint256", indexed: false },
      { name: "principalPaid", type: "uint256", indexed: false },
      { name: "remainingPrincipal", type: "uint256", indexed: false },
      { name: "remainingInterest", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LoanFullyRepaid",
    inputs: [
      { name: "loanId", type: "uint256", indexed: true },
      { name: "totalPrincipalPaid", type: "uint256", indexed: false },
      { name: "totalInterestPaid", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LoanDefaulted",
    inputs: [
      { name: "loanId", type: "uint256", indexed: true },
      { name: "outstandingPrincipal", type: "uint256", indexed: false },
      { name: "outstandingInterest", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LoanWrittenOff",
    inputs: [
      { name: "loanId", type: "uint256", indexed: true },
      { name: "amountWrittenOff", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },

  // KYC Events
  {
    type: "event",
    name: "KYCRegistrySet",
    inputs: [
      { name: "oldRegistry", type: "address", indexed: true },
      { name: "newRegistry", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "KYCEnabled",
    inputs: [],
  },
  {
    type: "event",
    name: "KYCDisabled",
    inputs: [],
  },

  // Access Control Events
  {
    type: "event",
    name: "RoleGranted",
    inputs: [
      { name: "role", type: "bytes32", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "RoleRevoked",
    inputs: [
      { name: "role", type: "bytes32", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "RoleAdminChanged",
    inputs: [
      { name: "role", type: "bytes32", indexed: true },
      { name: "previousAdminRole", type: "bytes32", indexed: true },
      { name: "newAdminRole", type: "bytes32", indexed: true },
    ],
  },
] as const;
