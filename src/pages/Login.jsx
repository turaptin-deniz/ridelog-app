import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login({ onLogin, darkMode, setDarkMode }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isRegister, setIsRegister] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
  
    const t = darkMode ? {
      bg: '#0a0a0a', surface: '#111', border: '#222', text: '#fff', muted: '#555'
    } : {
      bg: '#f5f5f5', surface: '#fff', border: '#e0e0e0', text: '#0a0a0a', muted: '#888'
    }
  

    const handleSubmit = async () => {
      setLoading(true)
      setError('')
      if (isRegister) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setError(error.message)
        else setError('Bestätigungs-Email gesendet!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(error.message)
        else onLogin()
      }
      setLoading(false)
    }
  
    return (
      <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: t.text, transition: 'all 0.2s' }}>
        
        {/* Toggle oben rechts */}
        <div style={{ position: 'fixed', top: '16px', right: '16px' }}>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{ background: t.border, border: 'none', borderRadius: '20px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: t.text }}
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
  
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '40px', width: '100%', maxWidth: '400px' }}>
          
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#6C63FF"/>
              <circle cx="16" cy="16" r="7" fill="none" stroke="white" strokeWidth="2"/>
              <circle cx="16" cy="16" r="2.5" fill="white"/>
              <line x1="16" y1="5" x2="16" y2="9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="16" y1="23" x2="16" y2="27" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="5" y1="16" x2="9" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="23" y1="16" x2="27" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '1.4rem', fontWeight: '600', letterSpacing: '-0.5px', color: t.text }}>
              Ride<span style={{ color: '#6C63FF' }}>Log</span>
            </span>
          </div>
  
          <p style={{ color: t.muted, marginBottom: '2rem', fontSize: '14px' }}>
            {isRegister ? 'Konto erstellen' : 'Willkommen zurück'}
          </p>
  
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: t.muted, display: 'block', marginBottom: '6px' }}>EMAIL</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="deine@email.de"
              style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '10px 12px', color: t.text, fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
  
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '12px', color: t.muted, display: 'block', marginBottom: '6px' }}>PASSWORT</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '10px 12px', color: t.text, fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
  
          {error && (
            <p style={{ color: error.includes('gesendet') ? '#4ade80' : '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
          )}
  
          <button onClick={handleSubmit} disabled={loading}
            style={{ width: '100%', background: '#6C63FF', color: 'white', border: 'none', borderRadius: '4px', padding: '12px', fontSize: '14px', cursor: 'pointer', marginBottom: '16px' }}
          >
            {loading ? 'Laden...' : isRegister ? 'Registrieren' : 'Anmelden'}
          </button>
  
          <p style={{ textAlign: 'center', fontSize: '13px', color: t.muted }}>
            {isRegister ? 'Schon ein Konto?' : 'Noch kein Konto?'}{' '}
            <span onClick={() => setIsRegister(!isRegister)} style={{ color: '#6C63FF', cursor: 'pointer' }}>
              {isRegister ? 'Anmelden' : 'Registrieren'}
            </span>
          </p>
        </div>
      </div>
    )
  }