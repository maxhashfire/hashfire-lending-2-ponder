# Hashfire Lending 2 - Ponder Indexer

Ponder indexer for the Hashfire Launch Fund 2 vault on Avalanche C-Chain.

## Contract

- **Vault Address:** `0x64Be1630ffD8144EB52896dCD099C805B93328e3`
- **Network:** Avalanche C-Chain (43114)
- **Start Block:** 73771073

## Local Development

```bash
npm install
npm run dev
```

GraphQL endpoint: `http://localhost:42069/graphql`

## Digital Ocean Deployment

### App

- **App Name:** `hashfire-lending-two`
- **Region:** NYC1
- **URL:** `https://hashfire-lending-two-XXXXX.ondigitalocean.app` (update after deploy)

### Database

- **Name:** `db-postgresql-nyc3-42715`
- **Region:** NYC3

### Environment Variables

```
DATABASE_URL=<connection-string-from-db-postgresql-nyc3-42715>
PONDER_RPC_URL_43114=https://avalanche-mainnet.infura.io/v3/ee9ace694999466db35636ceac1d39eb
MAX_RPC_REQUESTS_PER_SECOND=50
```

### App Settings

- **HTTP Port:** 42069
- **Build:** Dockerfile
- **Run Command:** (leave empty, Dockerfile handles it)

## GraphQL Queries

```graphql
# Get vault stats
{ lendingVaultss { items { id totalAssets totalSupply utilizationRate } } }

# Get lenders
{ lenderss { items { id address shares deposited } } }

# Get loans
{ loanss { items { id loanId principal status } } }

# Get access control
{ accessControlRoless { items { roleName memberCount } } }
```
