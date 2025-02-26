import { Descriptor, DescriptorPublicKey, type Wallet } from 'bdk-rn'
import { KeychainKind, type Network } from 'bdk-rn/lib/lib/enums'
import { create } from 'zustand'

import {
  extractPubKeyFromDescriptor,
  generateMnemonic,
  getFingerprint,
  getMultiSigWalletFromMnemonic,
  getParticipantInfo,
  getWalletFromMnemonic,
  parseDescriptor
} from '@/api/bdk'
import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { type Account, type MultisigParticipant } from '@/types/models/Account'
import { aesEncrypt } from '@/utils/crypto'

import { useBlockchainStore } from './blockchain'

type AccountBuilderState = {
  name: Account['name']
  type: Account['accountCreationType']
  scriptVersion: NonNullable<Account['scriptVersion']>
  seedWordCount: NonNullable<Account['seedWordCount']>
  seedWords: NonNullable<Account['seedWords']>
  passphrase?: Account['passphrase']
  fingerprint?: Account['fingerprint']
  derivationPath?: Account['derivationPath']
  externalDescriptor?: Account['externalDescriptor']
  internalDescriptor?: Account['internalDescriptor']
  watchOnly?: Account['watchOnly']
  wallet?: Wallet
  policyType?: Account['policyType']
  participants?: Account['participants']
  participantsCount?: Account['participantsCount']
  requiredParticipantsCount?: Account['requiredParticipantsCount']
  participantName?: MultisigParticipant['keyName']
  currentParticipantIndex?: number
  participantCreationType?: MultisigParticipant['creationType']
}

type AccountBuilderAction = {
  clearAccount: () => void
  clearParticipants: () => void
  getAccount: () => Account
  setName: (name: Account['name']) => void
  setExternalDescriptor: (descriptor: string) => Promise<void>
  setInternalDescriptor: (descriptor: string) => Promise<void>
  setDescriptorFromXpub: (xpub: string) => Promise<void>
  setDescriptorFromAddress: (address: string) => void
  setFingerprint: (fingerprint: string) => void
  setWatchOnly: (watchOnlyType: Account['watchOnly']) => void
  setType: (type: Account['accountCreationType']) => void
  setScriptVersion: (
    scriptVersion: NonNullable<Account['scriptVersion']>
  ) => void
  setSeedWordCount: (
    seedWordCount: NonNullable<Account['seedWordCount']>
  ) => void
  setSeedWords: (seedWords: NonNullable<Account['seedWords']>) => void
  setParticipant: (participants: string) => Promise<void>
  setParticipantWithSeedWord: () => Promise<void>
  setParticipantWithDescriptor: (descriptor: string) => Promise<void>
  setParticipantsCount: (
    participantsCount: Account['participantsCount']
  ) => void
  setRequiredParticipantsCount: (
    requiredParticipantsCount: Account['requiredParticipantsCount']
  ) => void
  setParticipantCreationType: (
    type: MultisigParticipant['creationType']
  ) => void
  setParticipantName: (name: MultisigParticipant['keyName']) => void
  generateMnemonic: (
    seedWordCount: NonNullable<Account['seedWordCount']>
  ) => Promise<void>
  setPassphrase: (passphrase: Account['passphrase']) => void
  setPolicyType: (policyType: Account['policyType']) => void
  setCurrentParticipantIndex: (index: number) => void
  updateFingerprint: () => Promise<void>
  loadWallet: () => Promise<Wallet>
  encryptSeed: () => Promise<void>
}

const useAccountBuilderStore = create<
  AccountBuilderState & AccountBuilderAction
>()((set, get) => ({
  name: '',
  type: null,
  scriptVersion: 'P2WPKH',
  seedWordCount: 24,
  policyType: 'single',
  seedWords: '',
  participants: [],
  participantsCount: 0,
  requiredParticipantsCount: 0,
  currentParticipantIndex: -1,
  clearAccount: () => {
    set({
      name: '',
      type: null,
      scriptVersion: 'P2PKH',
      seedWordCount: 24,
      seedWords: '',
      passphrase: undefined,
      fingerprint: undefined,
      derivationPath: undefined,
      externalDescriptor: undefined,
      internalDescriptor: undefined,
      watchOnly: undefined,
      wallet: undefined,
      participants: [],
      policyType: 'single',
      participantsCount: 0,
      requiredParticipantsCount: 0,
      currentParticipantIndex: -1
    })
  },
  clearParticipants: () => {
    set({
      participants: []
    })
  },
  setDescriptorFromXpub: async (xpub) => {
    const { fingerprint, scriptVersion } = get()
    const network = useBlockchainStore.getState().network as Network
    const key = await new DescriptorPublicKey().fromString(xpub)

    let externalDescriptorObj: Descriptor | undefined
    let internalDescriptorObj: Descriptor | undefined

    if (!fingerprint) return

    switch (scriptVersion) {
      case 'P2PKH':
        externalDescriptorObj = await new Descriptor().newBip44Public(
          key,
          fingerprint,
          KeychainKind.External,
          network
        )
        internalDescriptorObj = await new Descriptor().newBip44Public(
          key,
          fingerprint,
          KeychainKind.Internal,
          network
        )
        break
      case 'P2SH-P2WPKH':
        externalDescriptorObj = await new Descriptor().newBip49Public(
          key,
          fingerprint,
          KeychainKind.External,
          network
        )
        internalDescriptorObj = await new Descriptor().newBip49Public(
          key,
          fingerprint,
          KeychainKind.Internal,
          network
        )
        break
      case 'P2WPKH':
        externalDescriptorObj = await new Descriptor().newBip84Public(
          key,
          fingerprint,
          KeychainKind.External,
          network
        )
        internalDescriptorObj = await new Descriptor().newBip84Public(
          key,
          fingerprint,
          KeychainKind.Internal,
          network
        )
        break
      case 'P2TR':
        externalDescriptorObj = await new Descriptor().newBip86Public(
          key,
          fingerprint,
          KeychainKind.External,
          network
        )
        internalDescriptorObj = await new Descriptor().newBip86Public(
          key,
          fingerprint,
          KeychainKind.Internal,
          network
        )
        break
      default:
        throw new Error('invalid script version')
    }

    const externalDescriptor = await externalDescriptorObj.asString()
    const internalDescriptor = await internalDescriptorObj.asString()

    set({
      watchOnly: 'public-key',
      externalDescriptor,
      internalDescriptor
    })
  },
  setDescriptorFromAddress: (address) => {
    set({
      watchOnly: 'address',
      externalDescriptor: `addr(${address})`
    })
  },
  setFingerprint: (fingerprint) => {
    set({ fingerprint })
  },
  getAccount: () => {
    const {
      name,
      type,
      scriptVersion,
      seedWordCount,
      seedWords,
      passphrase,
      fingerprint,
      derivationPath,
      externalDescriptor,
      internalDescriptor,
      watchOnly,
      policyType,
      participants,
      participantsCount,
      requiredParticipantsCount
    } = get()

    return {
      name,
      accountCreationType: type,
      scriptVersion,
      seedWordCount,
      seedWords,
      passphrase,
      fingerprint,
      derivationPath,
      externalDescriptor,
      internalDescriptor,
      watchOnly,
      transactions: [],
      utxos: [],
      summary: {
        balance: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0,
        satsInMempool: 0
      },
      createdAt: new Date(),
      policyType,
      participants,
      participantsCount,
      requiredParticipantsCount
    }
  },
  setName: (name) => {
    set({ name })
  },
  setType: (type) => {
    set({ type })
  },
  setExternalDescriptor: async (externalDescriptor) => {
    const { network } = useBlockchainStore.getState()
    const externalDescriptorObj = await new Descriptor().create(
      externalDescriptor,
      network as Network
    )
    const externalDescriptorWithChecksum =
      await externalDescriptorObj.asString()
    set({
      // TODO: allow creation of signing wallets from descriptors
      // currently only watch-only wallets are created from descriptors
      watchOnly: 'public-key',
      externalDescriptor: externalDescriptorWithChecksum
    })
  },
  setInternalDescriptor: async (internalDescriptor) => {
    const { network } = useBlockchainStore.getState()
    const internalDescriptorObj = await new Descriptor().create(
      internalDescriptor,
      network as Network
    )
    const internalDescriptorWithChecksum =
      await internalDescriptorObj.asString()
    set({
      // TODO: allow creation of signing wallets from descriptors
      // currently only watch-only wallets are created from descriptors
      watchOnly: 'public-key',
      internalDescriptor: internalDescriptorWithChecksum
    })
  },
  setWatchOnly: (watchOnly) => {
    set({ watchOnly })
  },
  setScriptVersion: (scriptVersion) => {
    set({ scriptVersion })
  },
  setSeedWordCount: (seedWordCount) => {
    set({ seedWordCount })
  },
  setSeedWords: (seedWords) => {
    set({ seedWords })
  },
  setCurrentParticipantIndex: (index) => {
    set({ currentParticipantIndex: index })
  },
  generateMnemonic: async (seedWordCount) => {
    const mnemonic = await generateMnemonic(seedWordCount)
    set({ seedWords: mnemonic })
    await get().updateFingerprint()
  },
  setPassphrase: (passphrase) => {
    set({ passphrase })
  },
  setPolicyType: (policyType) => {
    set({ policyType })
  },
  setParticipant: async (participantSeedWords) => {
    const {
      participants,
      currentParticipantIndex: index,
      scriptVersion,
      seedWordCount,
      participantName,
      participantCreationType
    } = get()
    const { network } = useBlockchainStore.getState()
    if (index! >= 0 && index! < get().participantsCount!) {
      const p: MultisigParticipant = {
        seedWords: participantSeedWords,
        createdAt: new Date(),
        scriptVersion,
        seedWordCount,
        keyName: participantName,
        creationType: participantCreationType!
      }
      const { fingerprint, derivationPath, publicKey, privateKey } =
        (await getParticipantInfo(p, network as Network))!
      participants![index!] = {
        ...p,
        fingerprint,
        derivationPath,
        publicKey,
        privateKey,
        creationType: 'importseed'
      }
      set({ participants: [...participants!] })
    }
  },
  setParticipantWithSeedWord: async () => {
    const {
      seedWords,
      participants,
      currentParticipantIndex: index,
      scriptVersion,
      seedWordCount,
      participantName,
      participantCreationType
    } = get()
    const { network } = useBlockchainStore.getState()
    if (index! >= 0 && index! < get().participantsCount!) {
      const p: MultisigParticipant = {
        seedWords,
        createdAt: new Date(),
        scriptVersion,
        seedWordCount,
        keyName: participantName,
        creationType: participantCreationType!
      }
      const { fingerprint, derivationPath, publicKey, privateKey } =
        (await getParticipantInfo(p, network as Network))!
      participants![index!] = {
        ...p,
        fingerprint,
        derivationPath,
        publicKey,
        creationType: 'generate',
        privateKey
      }
      set({ participants: [...participants!] })
    }
  },
  setParticipantWithDescriptor: async (descriptor: string) => {
    try {
      const externalDescriptor = await new Descriptor().create(
        descriptor,
        useBlockchainStore.getState().network as Network
      )
      const { participants, currentParticipantIndex: index } = get()
      const { fingerprint, derivationPath } =
        await parseDescriptor(externalDescriptor)
      const pubKey = await extractPubKeyFromDescriptor(externalDescriptor)
      const p: MultisigParticipant = {
        derivationPath,
        fingerprint,
        createdAt: new Date(),
        creationType: 'importdescriptor',
        publicKey: pubKey
      }
      participants![index!] = p
      set({ participants: [...participants!] })
    } catch {}
  },
  setParticipantsCount: (participantsCount) => {
    set({ participantsCount })
  },
  setRequiredParticipantsCount: (requiredParticipantsCount) => {
    set({ requiredParticipantsCount })
  },
  setParticipantCreationType: (type) => {
    set({ participantCreationType: type })
  },
  setParticipantName: (name) => {
    set({ participantName: name })
  },
  updateFingerprint: async () => {
    const { network } = useBlockchainStore.getState()
    const fingerprint = await getFingerprint(
      get().seedWords,
      get().passphrase,
      network as Network
    )
    set(() => ({ fingerprint }))
  },
  loadWallet: async () => {
    const { network } = useBlockchainStore.getState()
    const policyType = get().policyType
    if (policyType === 'single') {
      const {
        fingerprint,
        derivationPath,
        externalDescriptor,
        internalDescriptor,
        wallet
      } = await getWalletFromMnemonic(
        get().seedWords,
        get().scriptVersion,
        get().passphrase,
        network as Network
      )
      set(() => ({
        fingerprint,
        derivationPath,
        externalDescriptor,
        internalDescriptor,
        wallet
      }))
      return wallet
    } else {
      const result = await getMultiSigWalletFromMnemonic(
        get().participants!,
        network as Network,
        get().participantsCount!,
        get().requiredParticipantsCount!
      )
      set(() => ({
        wallet: result?.wallet!,
        externalDescriptor: result?.externalDescriptor!,
        internalDescriptor: result?.internalDescriptor!
      }))
      return result?.wallet!
    }
  },
  encryptSeed: async () => {
    const savedPin = await getItem(PIN_KEY)
    if (!savedPin) return

    const encryptedSeedWords = await aesEncrypt(
      get().seedWords.replace(/\s+/g, ','),
      savedPin
    )
    set({ seedWords: encryptedSeedWords })
  }
}))

export { useAccountBuilderStore }
