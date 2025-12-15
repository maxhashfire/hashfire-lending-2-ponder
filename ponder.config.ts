import { createConfig } from "@ponder/core";
import { http } from "viem";
import { SecureVaultExtendedLendingAbi } from "./abis/SecureVaultExtendedLendingAbi";

const avalancheRpc = process.env.PONDER_RPC_URL_43114 ?? "https://avalanche-mainnet.infura.io/v3/ee9ace694999466db35636ceac1d39eb";
const databaseUrl = process.env.DATABASE_URL;
const maxRequestsPerSecond = Number(process.env.MAX_RPC_REQUESTS_PER_SECOND ?? "50");
const pollingInterval = Number(process.env.POLLING_INTERVAL_MS ?? "4000");

export default createConfig({
  database: databaseUrl
    ? {
        kind: "postgres",
        connectionString: databaseUrl,
        poolConfig: {
          max: 30,
          ssl: { rejectUnauthorized: false },
        },
      }
    : {
        kind: "sqlite",
      },
  networks: {
    avalanche: {
      chainId: 43114,
      transport: http(avalancheRpc, {
        batch: {
          batchSize: 100,
          wait: 16,
        },
        timeout: 60_000,
        retryCount: 3,
        retryDelay: 1000,
      }),
      maxRequestsPerSecond,
      pollingInterval,
    },
  },
  contracts: {
    SecureVaultExtendedLending: {
      network: "avalanche",
      abi: SecureVaultExtendedLendingAbi,
      address: "0x64Be1630ffD8144EB52896dCD099C805B93328e3",
      startBlock: 73771073,
      maxBlockRange: 2000,
    },
  },
});
