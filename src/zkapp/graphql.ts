import axios, {AxiosResponse} from "axios";
import { Config } from "./config";
import {DeployedWalletImpl} from "@/zkapp/viewmodel";
import {Transaction} from "@/components/TxListComponent.vue";
import {inject} from "vue";
import {PendingTxService} from "@/zkapp/pendingtx";

type GetEventResponse = {
    txid: string,
    auid: number,
    fields: string[]
}[]

type GetBlockResponse = {
    command_hash: string,
    balancechange: number,
    height: number,
    block_hash: string,
    fee: string,
    type: string,
    block_timestamp: string
}[]

export interface WalletTransaction{
    command_hash: string,
    balancechange: number,
    height: number,
    block_hash: string,
    fee: string,
    type: string,
    block_timestamp: string,
    fields: string[]
}

type GetCanonicalBlockResponse = {
    state_hash: string
}[]

export class GraphQlService{

    url = Config.GRAPHQL_URL

    resturl = "https://berkeley-api.eu2.rpanic.com/rpc"

    pendingTxs: PendingTxService

    constructor(pendingTxs: PendingTxService) {
        this.pendingTxs = pendingTxs
    }

    async getMinedTransactions(address: string) : Promise<WalletTransaction[]>{

        let headers = {
            Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXJjaGl2ZV9yZWFkZXJfcm9sZSJ9.CbjLkuif5Y14PCTX0MPgTx5ob2-V10CcBiXzB6Ruiw4"
        }

        let param = {
            input_pk: address
        }
        try {
            let events = await axios.post<GetEventResponse>(this.resturl + "/getevents", param, {headers: headers}) as AxiosResponse<GetEventResponse>

            let txinfo = await axios.post<GetBlockResponse>(this.resturl + "/getblock", param, {headers}) as AxiosResponse<GetBlockResponse>
            let blocktxs = txinfo.data as GetBlockResponse

            let grouped = {}
            blocktxs.forEach(x => {
                grouped[x.command_hash] = (grouped[x.command_hash] ?? []).concat([x])
            })

            //Filtering out inclusions which got orphaned
            for(let chash in grouped){
                if(grouped[chash].length > 1){

                    let heights = new Set(grouped[chash]!.map(x => x.height) as number[])

                    let heightToCanonical = {}

                    for(let height of heights){
                        let can = await axios.post<GetCanonicalBlockResponse>(this.resturl + "/getcanonicalblock", {height_input: height}, {headers}) as AxiosResponse<GetCanonicalBlockResponse>
                        if(can.data[0]){
                            heightToCanonical[height + ""] = can.data[0].state_hash
                        }else{
                            heightToCanonical[height + ""] = "none"
                        }
                    }

                    let canonicalTx = grouped[chash]
                        .filter(x => x.block_hash === heightToCanonical[x.height + ""])[0]
                        ?? grouped[chash][0] //In case blocks cannot be retrieved

                    blocktxs = blocktxs.filter(x => x.command_hash === chash ? x.block_hash === canonicalTx.block_hash : true)

                }
            }

            let eventtxs = events.data.map(a => {
                let blocktx = blocktxs.find(b => b.command_hash === a.txid)
                return {...blocktx!, fields: a.fields} as WalletTransaction
            });
            eventtxs.forEach(tx => {

                tx.type = this.getTransactionTypeByEventData(tx.fields, tx.balancechange)

            })

            let txs = blocktxs.filter(tx => tx.type === "USER_COMMAND") //since they don´t have events
                .map(tx => {
                    return {...tx, fields: []} as WalletTransaction
                })
            txs.push(...eventtxs)

            txs = txs.filter((x, i) => txs.findIndex(y => y.command_hash === x.command_hash) <= i)

            txs = txs.sort((a, b) => a.height == b.height ? 0 : (a.height > b.height ? 1 : -1))

            return txs

        }catch (e){
            console.log(e)
            return []
        }
    }

    getTransactionTypeByEventData(data: string[], balancechange: number) : string{
        if(data[0].length){
            data = data[0] as any as string[]
        }
        switch (data[0]){
            case "0":
                return "DEPLOYMENT"
            case "1": //init
                return "DEPLOYMENT"
            case "2":
                if(Math.abs(balancechange) > 0){
                    return "TRANSFER"
                }else{
                    return "SIGNATURE"
                }
        }
        if(!data[0]){
            console.log("Tx event data[0] is undefined")
        }
        console.log(data[0])
        return "Other"
    }

    async getTransactions(wallet: DeployedWalletImpl) : Promise<Transaction[]>{

        let arr = [] as Transaction[]

        //Pending txs
        // let pendings = this.pendingTxs.getPendingTxs()
        // console.log(pendings)
        // if(pendings[wallet.address] !== undefined && pendings[wallet.address].length > 0) {
        //     let pendingsP = await Promise.all(
        //         pendings[wallet.address].map(hash => this.getPendingTransaction(hash)) as Promise<{ pending: boolean, type: string }>[]
        //     )
        //     console.log(pendingsP)
        //
        //     let ptxs = pendingsP.filter(x => x.pending === true).map((b, i) => {
        //         return {
        //             type: b.type,
        //             txid: pendings[wallet.address][i],
        //             successful: false,
        //             address: wallet.address,
        //             value: 0, //TODO
        //             block: "",
        //             blocknumber: 0,
        //             timestamp: new Date().getTime()
        //         } as Transaction
        //     })
        //
        //     arr.push(...ptxs)
        //
        //     pendings[wallet.address]
        //         .filter((x, i) => pendingsP[i].pending !== true)
        //         .forEach(tx => this.pendingTxs.resolveTx(wallet.address, tx))
        // }


        let minedtxs = (await this.getMinedTransactions(wallet.address)).map(tx => {

            let type = tx.type === "USER_COMMAND" ? "DEPOSIT" : tx.type

            return {
                address: wallet.address,
                blocknumber: tx.height,
                block: tx.block_hash,
                txid: tx.command_hash,
                successful: true,
                value: Math.abs(tx.balancechange),
                type: type,
                timestamp: Number.parseInt(tx.block_timestamp)
            } as Transaction
        })

        arr.push(...minedtxs)

        arr = arr.sort((a, b) => {
            if(a.blocknumber === 0){
                return 1
            }else if(a.blocknumber === 0){
                return -1
            }
            let c = (a.blocknumber == b.blocknumber ? 0 : (a.blocknumber > b.blocknumber ? 1 : -1))
            return -1 * c
        })

        return arr
    }

    async getPendingTransaction(hash: string) : Promise<{ pending: boolean, type: string }> { //whether the transaction is found in the mempool

        let query = `query MyQuery {
            pooledZkappCommands(hashes: "$hash") {
              hash
              zkappCommand {
                  accountUpdates {
                    body {
                      events
                      balanceChange {
                        magnitude
                        sgn
                      }
                    }
                  }
                }
            }
            pooledUserCommands(hashes: "$hash") {
              hash
            }
          }`.replace("$hash", hash).replace("$hash", hash)

        let res = await axios.post(this.url, {
            query: query
        })

        let data = res.data.data

        let zkAppCommands = data.pooledZkappCommands as any[]
        let userCommands = data.pooledUserCommands as any[]

        let ret = {
            pending: false,
            type: ""
        }

        if(zkAppCommands.length > 0){

            let aus = zkAppCommands[0].zkappCommand.accountUpdates
            let balancechange = aus.map(x => Number.parseInt(x.body.balanceChange.magnitude) * (x.body.balanceChange.sgn === "Positive" ? 1 : -1)).reduce((a, b) => a + b)
            let events = aus.map(x => x.body.events as any[]).filter(x => x.length > 0)
            let event = events[events.length - 1]
            // if(event && event[0].length){ //if it is string[][]
            //     event = event[0]
            // }
            // if(!event){
            //     console.log("Event null:")
                console.log(aus)
            // }
            let type = this.getTransactionTypeByEventData(
                event, balancechange
            )
            ret.pending = true
            ret.type = type

        }else if(userCommands.length > 0){
            ret.pending = true
            ret.type = "DEPOSIT"
        }

        return ret

    }

}