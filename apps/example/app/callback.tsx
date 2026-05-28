import { useRouter } from 'expo-router'
import { useEffect } from 'react'

export default function AuthCallback() {
  const router = useRouter()
  useEffect(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [router])
  return null
}
