import { withBackgrounds } from '@storybook/addon-ondevice-backgrounds'
import type { Meta, StoryObj } from '@storybook/react'
import { View } from 'react-native'

import TransactionHistory from '@/.storybook/mock/transactions.json'
import UTXOHistory from '@/.storybook/mock/utxo.json'
import { storybookBackgrounds } from '@/.storybook/utils/backgrounds'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'

import SSHistoryChart from './SSHistoryChart'

const meta = {
  title: 'SSHistoryChart',
  component: SSHistoryChart,
  args: {
    transactions: [],
    utxos: []
  },
  argTypes: {
    transactions: {
      control: 'object',
      description: 'Transactions'
    },
    utxos: {
      control: 'object',
      description: 'Utxos'
    }
  },
  decorators: [
    (Story) => (
      <View
        style={{
          flex: 1
        }}
      >
        <Story />
      </View>
    ),
    withBackgrounds
  ],
  parameters: {
    backgrounds: storybookBackgrounds
  }
} satisfies Meta<typeof SSHistoryChart>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithData: Story = {
  args: {
    transactions: TransactionHistory as any as Transaction[],
    utxos: UTXOHistory as any as Utxo[]
  }
}
