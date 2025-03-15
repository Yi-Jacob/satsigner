import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSLabelInput from '@/components/SSLabelInput'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type AddrSearchParams } from '@/types/navigation/searchParams'

function AddressLabel() {
  const { id: accountId, addr } = useLocalSearchParams<AddrSearchParams>()

  const [address, setAddrLabel] = useAccountsStore((state) => [
    state.accounts
      .find((account: Account) => account.id === accountId)
      ?.addresses.find((address: Address) => address.address === addr),
    state.setAddrLabel
  ])

  function updateLabel(label: string) {
    setAddrLabel(accountId!, addr!, label)
    router.back()
  }

  if (!address || !addr) return <Redirect href="/" />

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('address.label.title')}</SSText>
          )
        }}
      />
      <SSVStack gap="none" style={{ padding: 20 }}>
        <SSVStack gap="none">
          <SSVStack>
            <SSText uppercase weight="bold">
              {t('bitcoin.address')}
            </SSText>
            <SSAddressDisplay address={addr} />
          </SSVStack>
        </SSVStack>
        <SSLabelInput label={address.label} onUpdateLabel={updateLabel} />
      </SSVStack>
    </ScrollView>
  )
}

export default AddressLabel
