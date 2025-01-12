# Vale Multisig UI

[![Build Status](https://drone.rpanic.com/api/badges/rpanic/vale-ui/status.svg)](https://drone.rpanic.com/rpanic/vale-ui)

See a hosted version on [wallet.rpanic.com](https://wallet.rpanic.com)

[The zkapp-contract repository](https://github.com/rpanic/vale-contracts)

Vale Multisig is a platform that lets you create you own multisig wallet very easily. 
When you go on the site, you can create a new instance of the vale contract, where you can set the 
signers you want to be able to sign and the amount of signers needed to pass a proposal.

A proposal is an initiative of one of the signers of a wallet to send a specific amount of funds to an address.
This proposal can then be approved or declined by all of the signers.

After creation, you can use the UI to deposit funds to the wallet or propose a new transaction (a proposal).
The proposed transaction with its amount and receiver fields can then be approved or declined by the signers. 
The signatures can also be created in the UI and directly submitted to chain with an aurowallet-signed transaction.

## Prerequisited

- A funded account on berkeley. (use the [faucet](https://faucet.minaprotocol.com/) for that)
- [Aurowallet](https://www.aurowallet.com/) installed in your browser with the funded account imported

## Features

- Dynamic selection of signers, and the threshold for proposal approval
- Sending signatures and deposits with Aurowallet
- Creation of proposals and subsequent signing of approval / disapproval
- Automatic and instant payout of approved proposals
- Device-independent recreation of proposals and signer state using contract-events
- Live feed of pending transactions
- Decoding of transaction-purpose from events
- Proof generation in web-workers outside the main thread

## Limitations

AuroWallet is only used for sending transactions, not for deploying the contract and signing. Signing is only possible with website-stored privatekeys at the moment

Account creation fee for payouts cannot be paid by the contract at the moment due to a bug in snarkyjs 

**[Fixed]** Initialization of proof-based contract instances does not work due to a bug in snarkyjs, a [issue exists](https://github.com/MinaProtocol/mina/issues/12109)

Off-chain storage hasn´t been implemented fully yet. 
Everything works except retrieval of the signers (which can´t be stored in events since its dynamically-sized) 

Website is not yet optimized for mobile

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```
