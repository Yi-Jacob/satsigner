import {
  validateAddress,
  validateDerivationPath,
  validateDescriptor,
  validateExtendedKey,
  validateFingerprint
} from '@/utils/validation'

describe('Validates addresses', () => {
  const validAddresses = [
    // BITCOIN MAINNET ADDRESSES
    '1HQQLXjYGesJunxE5fwFxHbG9Ks53nyZr9', // P2PKH (Pay to Public Key Hash):
    '3J6RG5DypZBgzxefCmbrNuxCHr9nfPmcbF', // P2SH (Pay to Script Hash):
    'bc1qmj3dcj45tugree3f87mrxvc5aqm4hkz4vhskgj', // P2WPKH (Pay to Witness Public Key Hash):
    'bc1pptev7vzxjvlpnazg6zk4l9j3qw6990kwfmz43ppyms79525qzf8q604wxw', // P2TR (Pay to Taproot):
    // BITCOIN TESTNET ADDRESSES
    'mwvMdapX5gJZguRqoEudnCob1KTmxSxP9p', // P2PKH:
    '2N9edKpA1S1h3CkHCsuDizrwTWCMxPsB1Qr', // P2SH:
    'tb1qmj3dcj45tugree3f87mrxvc5aqm4hkz4x3t9np', // P2WPKH:
    'tb1pptev7vzxjvlpnazg6zk4l9j3qw6990kwfmz43ppyms79525qzf8qd8rpup' // P2TR:
  ]

  const invalidAddresses = [
    'bc1p11111111111111111111111111111111111111',
    'bc5p5cyxnuxmeuwuvkwfem96l8z2f8g8g8g8g8g8g8'
  ]

  it('Recognizes valid addresses', () => {
    for (const address of validAddresses) {
      expect(validateAddress(address)).toBe(true)
    }
  })

  it('Recognizes invalid addresses', () => {
    for (const address of invalidAddresses) {
      expect(validateAddress(address)).toBe(false)
    }
  })
})

describe('Validates derivation paths', () => {
  const validDerivationPaths = [
    "m/44'/0'/0'/0",
    "m/84'/0'/0'/0",
    "m/86'/0'/0'/0",
    'm/44h/0h/0h/0',
    'm/84h/0h/0h/0',
    'm/86h/0h/0h/0',
    'm/1/2/3/4/5/6/7/8/9',
    "m/1'/2'/3'/4'/5'/6'/7'/8'/9'",
    'm/1/256',
    'm/1',
    "M/44'/0'/0'/0",
    "M/84'/0'/0'/0",
    "M/86'/0'/0'/0",
    'M/44h/0h/0h/0',
    'M/84h/0h/0h/0',
    'M/86h/0h/0h/0',
    'M/1/2/3/4/5/6/7/8/9',
    "M/1'/2'/3'/4'/5'/6'/7'/8'/9'",
    'M/1/256',
    'M/1',
    '1/2'
  ]
  const invalidDerivationPaths = ["m/44'/0'/0'/0/", 'm/44h/0h/0h/0/', 'm/a/b/c']

  it('Recgonizes valid derivation paths', () => {
    for (const path of validDerivationPaths) {
      expect(validateDerivationPath(path)).toBe(true)
    }
  })

  it('Recgonizes invalid derivation paths', () => {
    for (const path of invalidDerivationPaths) {
      expect(validateDerivationPath(path)).toBe(false)
    }
  })
})

describe('Validates master fingerprints', () => {
  const validFingerprints = [
    'a0b1c2d3',
    '0dfe45ff',
    '12345678',
    'abcdefde',
    'b1e3d434'
  ]
  const invalidFingerprints = [
    'abcdefga',
    'imnopqab',
    '12g56789',
    '0123uu',
    'aaa',
    '1234'
  ]

  it('Recgonizes valid fingerprints', () => {
    for (const fingerprint of validFingerprints) {
      expect(validateFingerprint(fingerprint)).toBe(true)
    }
  })

  it('Recgonizes invalid fingerprints', () => {
    for (const fingerprint of invalidFingerprints) {
      expect(validateFingerprint(fingerprint)).toBe(false)
    }
  })
})

describe('Validates descriptors', () => {
  const validDescriptors = [
    'pk(0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798)',
    'pkh(02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5)',
    'wpkh(02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9)',
    'sh(03fff97bd5755eeea420453a14355235d382f6472f8568a18b2f057a1460297556)',
    'wsh([e6807791/44h/1h/0h]tpubDDAfvogaaAxaFJ6c15ht7Tq6ZmiqFYfrSmZsHu7tHXBgnjMZSHAeHSwhvjARNA6Qybon4ksPksjRbPDVp7yXA1KjTjSd5x18KHqbppnXP1s/0/*)',
    'pk(0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798)#12345678',
    `wpkh([60c6c741/84'/1'/0']tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/0/*)#rqc6v9pp`
  ]

  const invalidDescriptors = [
    'p2pk(0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798)',
    'p2pkh(02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5)',
    'bc1qmj3dcj45tugree3f87mrxvc5aqm4hkz4vhskgj'
  ]

  it('Recgonizes valid descriptors', () => {
    for (const descriptor of validDescriptors) {
      expect(validateDescriptor(descriptor)).toBe(true)
    }
  })

  it('Recgonizes invalid descriptors', () => {
    for (const descriptor of invalidDescriptors) {
      expect(validateDescriptor(descriptor)).toBe(false)
    }
  })
})

describe('Validates extended keys', () => {
  const validExtendedKeys = [
    'xprvA3aefawL5RncTfcTBQCcD54pyyjJEe9FnNDHUh4tKFEQ7oZbxcKRETqLTJ4axsBwYzBBmqBYZYhM2a1pyZZKme265kU87bSezSS9kjN3huL',
    'xpub69M34K123tT7uiHGKBGrMe4KNnKuedu3hQFDhzovR938S3V5E5x7bv58sfej8rQ7hZLtXbTdDkjLpn5crdRKm3uphmEY24q28rMYT7qyXEr',
    'yprvALKcEo52JyxDRqdCgNnZ2x2P2UYcGPCpFWSGoatm9w7K8eeFFXjhVbnFGhxwchqiFC7qrMzz65MtHTFZb8pk5VRHVzBgfaqQh9UdkmSCh2v',
    'ypub6V5HorTR9bEwjVHAuAsjuhZapV766WDUPjz2KX93c74wSQde7Y9HMEqZJpjKA67rF7bkuZshe8ovTCcy27KMuyBkC3kpPt38HHVdGxV5Rbg',
    'zprvAWgYBBk7JR8GkkTuJFcj1jDuRv4WNw9cJruyifb4B2A6WSrbo114tiRTasQz1BoE3fBiB9PCNu82BPe1LeRCwFxE4wNj6ZSMMDkZLzxrLEX',
    'zpub6meLgZBh2ond7rC77f8jHxKUgd8bChCimrCQgEpiEC2NGzWZTbTsdq2cszuAJ1KwUgv8no6cweqrGHWDQ1Mi92H3tq1f7nhFJiBSkRFPNKR'
  ]

  it('Recognizes valid extended keys', () => {
    for (const key of validExtendedKeys) {
      expect(validateExtendedKey(key)).toBe(true)
    }
  })
})
