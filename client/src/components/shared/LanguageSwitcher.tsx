import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './LanguageSwitcher.css'

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    setIsOpen(false)
  };

  return (
    <div className="lang-dropdown" ref={dropdownRef}>
      <button
        className="lang-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        lang ▼
      </button>

      {isOpen && (
        <div className="lang-menu">
          <button
            className={`lang-option ${i18n.resolvedLanguage === 'ru' ? 'active' : ''}`}
            onClick={() => changeLanguage('ru')}
          >
            RU
          </button>
          <button
            className={`lang-option ${i18n.resolvedLanguage === 'en' ? 'active' : ''}`}
            onClick={() => changeLanguage('en')}
          >
            EN
          </button>
        </div>
      )}
    </div>
  )
}