import { type Descriptor, type Wallet } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getWalletData, getWalletFromDescriptor, syncWallet } from '@/api/bdk'
import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import { Esplora } from '@/api/esplora'
import { PIN_KEY } from '@/config/auth'
import { getBlockchainConfig } from '@/config/servers'
import { getItem } from '@/storage/encrypted'
import mmkvStorage from '@/storage/mmkv'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Label } from '@/utils/bip329'
import { aesDecrypt } from '@/utils/crypto'
import { formatTimestamp } from '@/utils/format'
import {
  parseAddressDescriptorToAddress,
  parseHexToBytes as hexToBytes
} from '@/utils/parse'
import { getUtxoOutpoint } from '@/utils/utxo'

import { useBlockchainStore } from './blockchain'

type AccountsState = {
  accounts: Account[]
  tags: string[]
}

type AccountsAction = {
  hasAccountWithName: (name: string) => boolean
  loadWalletFromDescriptor: (
    externalDescriptor: Descriptor,
    internalDescriptor: Descriptor | null | undefined
  ) => Promise<Wallet>
  syncWallet: (wallet: Wallet | null, account: Account) => Promise<Account>
  addAccount: (account: Account) => Promise<void>
  updateAccount: (account: Account) => Promise<void>
  updateAccountName: (name: string, newName: string) => void
  deleteAccount: (name: string) => void
  deleteAccounts: () => void
  getTags: () => string[]
  setTags: (tags: string[]) => void
  setTxLabel: (account: string, txid: string, label: string) => void
  setUtxoLabel: (
    account: string,
    txid: string,
    vout: number,
    label: string
  ) => void
  importLabels: (account: string, labels: Label[]) => void
  decryptSeed: (account: string) => Promise<string>
}

const useAccountsStore = create<AccountsState & AccountsAction>()(
  persist(
    (set, get) => ({
      accounts: [],
      tags: [],
      hasAccountWithName: (name) => {
        return !!get().accounts.find((account) => account.name === name)
      },
      loadWalletFromDescriptor: async (
        externalDescriptor,
        internalDescriptor
      ) => {
        const { network } = useBlockchainStore.getState()

        const wallet = getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network as Network
        )
        return wallet
      },
      syncWallet: async (wallet, account) => {
        // TODO: refactor this HUGE function, break it down
        const { backend, network, retries, stopGap, timeout, url } =
          useBlockchainStore.getState()
        const opts = { retries, stopGap, timeout }

        // make backup of the labels
        const labelsDictionary: Record<string, string> = {}
        account.transactions.forEach((tx) => {
          const txRef = tx.id
          labelsDictionary[txRef] = tx.label || ''
        })
        account.utxos.forEach((utxo) => {
          const utxoRef = getUtxoOutpoint(utxo)
          labelsDictionary[utxoRef] = utxo.label
        })

        let transactions: Transaction[] = []
        let utxos: Utxo[] = []
        let summary: Account['summary']

        if (!account.externalDescriptor) {
          throw new Error('No external descriptor')
        }

        if (account.watchOnly === 'address') {
          const addrDescriptor = account.externalDescriptor
          const address = parseAddressDescriptorToAddress(addrDescriptor)
          let confirmed = 0
          let unconfirmed = 0

          if (backend === 'esplora') {
            const esploraClient = new Esplora(url)
            const esploraTxs = await esploraClient.getAddressTx(address)
            const esploraUtxos = await esploraClient.getAddressUtxos(address)

            const txDictionary: Record<string, number> = {}

            for (let index = 0; index < esploraTxs.length; index++) {
              const t = esploraTxs[index]
              const vin: Transaction['vin'] = []
              const vout: Transaction['vout'] = []
              let sent = 0
              let received = 0

              t.vin.forEach((input) => {
                vin.push({
                  previousOutput: {
                    txid: input.txid,
                    vout: input.vout
                  },
                  sequence: input.sequence,
                  scriptSig: hexToBytes(input.scriptsig),
                  witness: input.witness.map(hexToBytes)
                })
                if (input.prevout.scriptpubkey_address === address) {
                  sent += input.prevout.value
                }
              })

              t.vout.forEach((out) => {
                vout.push({
                  value: out.value,
                  address: out.scriptpubkey_address,
                  script: hexToBytes(out.scriptpubkey)
                })
                if (out.scriptpubkey_address === address) {
                  received += out.value
                }
              })

              const raw = await esploraClient.getTxHex(t.txid)

              const tx = {
                address,
                blockHeight: t.status.block_height,
                fee: t.fee,
                id: t.txid,
                label: '',
                locktime: t.locktime,
                lockTimeEnabled: t.locktime > 0,
                prices: {},
                raw: hexToBytes(raw),
                received,
                sent,
                size: t.size,
                timestamp: new Date(t.status.block_time * 1000),
                type: sent > 0 ? 'send' : 'receive',
                version: t.version,
                vin,
                vout,
                weight: t.weight
              } as Transaction

              txDictionary[tx.id] = index
              transactions.push(tx)
            }

            utxos = esploraUtxos.map((u) => {
              if (u.status.confirmed) confirmed += u.value
              else unconfirmed += u.value

              let script: number[] | undefined
              if (txDictionary[u.txid] !== undefined) {
                const index = txDictionary[u.txid]
                const tx = esploraTxs[index]
                script = hexToBytes(tx.vout[u.vout].scriptpubkey)
              }

              return {
                txid: u.txid,
                vout: u.vout,
                value: u.value,
                label: '',
                addressTo: address,
                keychain: 'external',
                script,
                timestamp: u.status.block_time
                  ? new Date(u.status.block_time * 1000)
                  : undefined
              }
            })
          } else {
            const port = url.replace(/.*:/, '')
            const protocol = url.replace(/:\/\/.*/, '')
            const host = url
              .replace(`${protocol}://`, '')
              .replace(`:${port}`, '')

            if (
              !host.match(/^[a-z][a-z.]+$/i) ||
              !port.match(/^[0-9]+$/) ||
              (protocol !== 'ssl' && protocol !== 'tls' && protocol !== 'tcp')
            ) {
              throw new Error('Invalid backend URL')
            }

            const electrumClient = new ElectrumClient({
              host,
              port: Number(port),
              protocol,
              network
            })

            await electrumClient.init()
            const addrInfo = await electrumClient.getAddressInfo(address)
            electrumClient.close()
            transactions = addrInfo.transactions
            utxos = addrInfo.utxos
            confirmed = addrInfo.balance.confirmed
            unconfirmed = addrInfo.balance.unconfirmed
          }

          summary = {
            numberOfAddresses: 1,
            numberOfTransactions: transactions.length,
            numberOfUtxos: utxos.length,
            satsInMempool: unconfirmed,
            balance: confirmed
          }
        } else {
          if (!wallet) throw new Error('Got null wallet to sync')

          await syncWallet(
            wallet,
            backend,
            getBlockchainConfig(backend, url, opts)
          )

          const walletData = await getWalletData(wallet, network as Network)
          transactions = walletData.transactions
          utxos = walletData.utxos
          summary = walletData.summary
        }

        // backup utxo labels
        for (const index in utxos) {
          const utxoRef = getUtxoOutpoint(utxos[index])
          utxos[index].label = labelsDictionary[utxoRef] || ''
        }

        // backup transaction labels
        for (const index in transactions) {
          const txRef = transactions[index].id
          transactions[index].label = labelsDictionary[txRef] || ''
        }

        // extract timestamps
        const timestamps = transactions
          .filter((transaction) => transaction.timestamp)
          .map((transaction) => formatTimestamp(transaction.timestamp!))

        // fetch prices for the timestamps
        const oracle = new MempoolOracle()
        const prices = await oracle.getPricesAt('USD', timestamps)

        transactions.forEach((_, index) => {
          transactions[index].prices = { USD: prices[index] }
        })

        return { ...account, transactions, utxos, summary }
      },
      addAccount: async (account) => {
        set(
          produce((state: AccountsState) => {
            state.accounts.push(account)
          })
        )
      },
      updateAccount: async (account) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (_account) => _account.name === account.name
            )
            if (index !== -1) state.accounts[index] = account
          })
        )
      },
      updateAccountName: (name, newName) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.name === name
            )
            if (index !== -1) state.accounts[index].name = newName
          })
        )
      },
      deleteAccount: (name: string) => {
        set(
          produce((state: AccountsState) => {
            const index = state.accounts.findIndex(
              (account) => account.name === name
            )
            if (index !== -1) {
              state.accounts.splice(index, 1)
            }
          })
        )
      },
      deleteAccounts: () => {
        set(() => ({ accounts: [] }))
      },
      getTags: () => {
        return get().tags
      },
      setTags: (tags: string[]) => {
        set({ tags })
      },
      setTxLabel: (accountName, txid, label) => {
        const account = get().accounts.find(
          (account) => account.name === accountName
        )
        if (!account) return

        const txIndex = account.transactions.findIndex((tx) => tx.id === txid)
        if (txIndex === -1) return

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.name === accountName
            )
            state.accounts[index].transactions[txIndex].label = label
          })
        )
      },
      setUtxoLabel: (accountName, txid, vout, label) => {
        const account = get().accounts.find(
          (account) => account.name === accountName
        )
        if (!account) return

        const utxoIndex = account.utxos.findIndex((u) => {
          return u.txid === txid && u.vout === vout
        })
        if (utxoIndex === -1) return

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.name === accountName
            )
            state.accounts[index].utxos[utxoIndex].label = label
          })
        )
      },
      importLabels: (accountName: string, labels: Label[]) => {
        const account = get().accounts.find(
          (account) => account.name === accountName
        )

        if (!account) return

        const transactionMap: Record<string, number> = {}
        const utxoMap: Record<string, number> = {}

        account.transactions.forEach((tx, index) => {
          transactionMap[tx.id] = index
        })
        account.utxos.forEach((utxo, index) => {
          utxoMap[getUtxoOutpoint(utxo)] = index
        })

        set(
          produce((state) => {
            const index = state.accounts.findIndex(
              (account: Account) => account.name === accountName
            )
            labels.forEach((labelObj) => {
              const label = labelObj.label

              if (labelObj.type === 'tx') {
                if (!transactionMap[labelObj.ref]) return
                const txIndex = transactionMap[labelObj.ref]
                state.accounts[index].transactions[txIndex].label = label
              }
              if (labelObj.type === 'output') {
                if (!utxoMap[labelObj.ref]) return
                const utxoIndex = utxoMap[labelObj.ref]
                state.accounts[index].utxos[utxoIndex].label = label
              }
            })
          })
        )
      },
      async decryptSeed(accountName) {
        const account = get().accounts.find(
          (_account) => _account.name === accountName
        )
        if (!account || !account.seedWords) return ''
        const savedPin = await getItem(PIN_KEY)
        if (!savedPin) return ''
        return aesDecrypt(account.seedWords, savedPin)
      }
    }),
    {
      name: 'satsigner-accounts',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAccountsStore }
