import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import './design-system.css'
import Login from './pages/Login'
import Map from './pages/Map'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import Messages from './pages/Messages'
import Discover from './pages/Discover'

const NAV_ITEMS = [
  { id: 'map', label: 'Karte', icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
      <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
    </svg>
  )},
  { id: 'feed', label: 'Feed', icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  )},
  { id: 'discover', label: 'Entdecken', icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )},
  { id: 'messages', label: 'Nachrichten', icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )},
  { id: 'profil', label: 'Profil', icon: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )},
]


function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [activePage, setActivePage] = useState('map')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  const t = {
    bg: 'var(--color-bg-primary)',
    surface: 'var(--color-surface)',
    border: 'var(--color-border-base)',
    text: 'var(--color-text-primary)',
    muted: 'var(--color-text-muted)',
    accent: 'var(--color-accent-primary)',
  }

  if (loading) return (
    <div style={{ background: 'var(--color-bg-primary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="40" height="40" viewBox="0 0 40 40" className="animate-spin">
        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20"/>
      </svg>
    </div>
  )

  if (!session) return <Login onLogin={() => {}} darkMode={darkMode} setDarkMode={setDarkMode} />

  const renderPage = () => {
    switch(activePage) {
      case 'map': return <Map darkMode={darkMode} />
      case 'feed': return <Feed darkMode={darkMode} />
      case 'messages': return <Messages darkMode={darkMode} />
      case 'profil': return <Profile darkMode={darkMode} setDarkMode={setDarkMode} />
      case 'discover': return <Discover darkMode={darkMode} />
      default: return <Map darkMode={darkMode} />
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--color-bg-secondary)', minHeight: '100vh' }}>
      <div style={{
        width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column',
        minHeight: '100vh', background: t.bg, position: 'relative',
        boxShadow: '0 0 60px rgba(0,0,0,0.4)'
      }}>

        {/* Header */}
        <div style={{
          padding: 'var(--space-3) var(--space-4)', borderBottom: `1px solid ${t.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: t.surface, flexShrink: 0
        }}>
          {/* Motorrad Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: '40px', height: '40px',
              background: `linear-gradient(135deg, ${t.accent} 0%, var(--color-accent-secondary) 100%)`,
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(255, 107, 53, 0.2)'
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="5.5" cy="17.5" r="3" stroke="white" strokeWidth="1.8"/>
                <circle cx="18.5" cy="17.5" r="3" stroke="white" strokeWidth="1.8"/>
                <path d="M5.5 17.5L8 10L12 9L15 6H18L19.5 9L21 11L18.5 17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 10L12 11L15 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-bold)',
              color: t.text,
              fontFamily: "var(--font-family-condensed)",
              letterSpacing: '-0.02em'
            }}>
              ride<span style={{ color: t.accent }}>log</span>
            </span>
          </div>

          {/* Notification Bell */}
          <button style={{
            background: 'transparent', border: 'none', color: t.muted,
            cursor: 'pointer', padding: 'var(--space-2)', transition: 'all var(--transition-fast)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="animate-fadeIn">
          {renderPage()}
        </div>

        {/* Bottom Navigation */}
        <div style={{
          display: 'flex', borderTop: `1px solid ${t.border}`,
          background: t.surface, flexShrink: 0, paddingBottom: 'var(--space-1)'
        }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 'var(--space-3) 0 var(--space-2)', background: 'transparent', border: 'none',
                cursor: 'pointer',
                color: activePage === item.id ? t.accent : t.muted,
                gap: 'var(--space-1)', position: 'relative',
                transition: 'color var(--transition-fast)'
              }}
            >
              {activePage === item.id && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '24px', height: '2px', background: t.accent, borderRadius: '0 0 2px 2px'
                }} />
              )}
              {item.icon(activePage === item.id)}
              <span style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: activePage === item.id ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
                fontFamily: "var(--font-family-primary)"
              }}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App