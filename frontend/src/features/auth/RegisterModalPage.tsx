import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { RegistrationWizardModal } from '@/features/auth/RegistrationWizardModal'
import { PublicHomePage } from '@/features/public/PublicHomePage'

export function RegisterModalPage() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    setIsOpen(true)
  }, [])

  const closeModal = () => {
    setIsOpen(false)
    navigate('/', { replace: true })
  }

  return (
    <>
      <PublicHomePage />
      <RegistrationWizardModal isOpen={isOpen} onClose={closeModal} />
    </>
  )
}
