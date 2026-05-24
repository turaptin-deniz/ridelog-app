import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login({ onLogin, darkMode, setDarkMode }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setError('✓ Bestätigungs-Email gesendet!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else onLogin()
    }
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--color-bg-primary)',
      padding: 'var(--space-4)',
      fontFamily: 'var(--font-family-primary)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        animation: 'fadeIn 0.5s ease-out'
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-6)',
            boxShadow: '0 0 30px rgba(255, 107, 53, 0.2)'
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5" cy="17" r="3" />
              <circle cx="19" cy="17" r="3" />
              <path d="M5 17L8 9L13 8L16 5H19L21 9L19 17" />
              <path d="M8 9L13 10.5" />
            </svg>
          </div>

          <h1 style={{
            fontSize: 'var(--font-size-3xl)',
            fontFamily: 'var(--font-family-condensed)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--space-2)',
            letterSpacing: '-0.02em'
          }}>
            ride<span style={{ color: 'var(--color-accent-primary)' }}>log</span>
          </h1>

          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            margin: '0'
          }}>
            {isRegister ? 'Erstelle dein Konto' : 'Willkommen zurück'}
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-secondary)'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="deine@email.de"
              className="input"
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-base)',
                borderRadius: 'var(--radius-base)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-base)',
                fontFamily: 'var(--font-family-primary)',
                outline: 'none',
                transition: 'all var(--transition-fast)',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-accent-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border-base)'}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-secondary)'
            }}>
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-base)',
                borderRadius: 'var(--radius-base)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-base)',
                fontFamily: 'var(--font-family-primary)',
                outline: 'none',
                transition: 'all var(--transition-fast)',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-accent-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border-base)'}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            borderRadius: 'var(--radius-base)',
            fontSize: 'var(--font-size-sm)',
            border: `1px solid ${error.includes('✓') ? 'var(--color-success)' : 'var(--color-danger)'}`,
            background: error.includes('✓')
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(239, 68, 68, 0.1)',
            color: error.includes('✓') ? 'var(--color-success)' : 'var(--color-danger)'
          }}>
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            background: loading ? 'opacity: 0.6)' : 'linear-gradient(135deg, var(--color-accent-primary) 0%, #ff5a1f 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-base)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-bold)',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all var(--transition-fast)',
            fontFamily: 'var(--font-family-primary)',
            boxShadow: '0 4px 15px rgba(255, 107, 53, 0.2)'
          }}
          onMouseEnter={e => !loading && (e.target.style.boxShadow = '0 8px 25px rgba(255, 107, 53, 0.35)')}
          onMouseLeave={e => !loading && (e.target.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.2)')}
        >
          {loading ? '...' : isRegister ? 'Registrieren' : 'Anmelden'}
        </button>

        {/* Toggle Register */}
        <div style={{
          textAlign: 'center',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-6)'
        }}>
          {isRegister ? 'Schon ein Konto? ' : 'Noch kein Konto? '}
          <span
            onClick={() => setIsRegister(!isRegister)}
            style={{
              color: 'var(--color-accent-primary)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={e => e.target.style.color = 'var(--color-accent-secondary)'}
            onMouseLeave={e => e.target.style.color = 'var(--color-accent-primary)'}
          >
            {isRegister ? 'Anmelden' : 'Registrieren'}
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setDarkMode && setDarkMode(!darkMode)}
          style={{
            display: 'block',
            margin: '0 auto',
            padding: 'var(--space-2) var(--space-4)',
            background: 'transparent',
            border: '1px solid var(--color-border-base)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            fontFamily: 'var(--font-family-primary)'
          }}
          onMouseEnter={e => {
            e.target.style.borderColor = 'var(--color-accent-primary)'
            e.target.style.color = 'var(--color-accent-primary)'
          }}
          onMouseLeave={e => {
            e.target.style.borderColor = 'var(--color-border-base)'
            e.target.style.color = 'var(--color-text-secondary)'
          }}
        >
          {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
      </div>
    </div>
  )
}
