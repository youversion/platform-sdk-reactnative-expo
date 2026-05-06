import { createMMKV } from 'react-native-mmkv'

import { MMKV_INSTANCE_ID } from './constants'

export const mmkvStorage = createMMKV({ id: MMKV_INSTANCE_ID })
