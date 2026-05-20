import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './pages/Login'
import Map from './pages/Map'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import Messages from './pages/Messages'
import Badges from './pages/Badges'
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

  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111111', border: '#1f1f1f',
    text: '#ffffff', muted: '#555555', accent: '#6C63FF',
  } : {
    bg: '#f5f5f5', surface: '#ffffff', border: '#e5e5e5',
    text: '#0a0a0a', muted: '#888888', accent: '#6C63FF',
  }

  if (loading) return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#6C63FF" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20">
          <animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="1s" repeatCount="indefinite"/>
        </circle>
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
      case 'map': return <Live darkMode={darkMode} />
      case 'discover': return <Discover darkMode={darkMode} />
      default: return <Map darkMode={darkMode} />
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', background: darkMode ? '#000' : '#ccc', minHeight: '100vh' }}>
      <div style={{
        width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column',
        minHeight: '100vh', background: t.bg, position: 'relative',
        boxShadow: '0 0 60px rgba(0,0,0,0.8)'
      }}>

        {/* Header */}
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid ${t.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: t.surface, flexShrink: 0
        }}>
          {/* Motorrad Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', background: '#6C63FF',
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="5.5" cy="17.5" r="3" stroke="white" strokeWidth="1.8"/>
                <circle cx="18.5" cy="17.5" r="3" stroke="white" strokeWidth="1.8"/>
                <path d="M5.5 17.5L8 10L12 9L15 6H18L19.5 9L21 11L18.5 17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 10L12 11L15 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: '1.2rem', fontWeight: '700', color: t.text, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px' }}>
              RIDE<span style={{ color: '#6C63FF' }}>LOG</span>
            </span>
          </div>

          {/* Notification Bell */}
          <button style={{
            background: 'transparent', border: 'none', color: t.muted,
            cursor: 'pointer', padding: '4px'
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
          background: t.surface, flexShrink: 0, paddingBottom: '4px'
        }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className="nav-btn"
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '10px 0 6px', background: 'transparent', border: 'none',
                cursor: 'pointer',
                color: activePage === item.id ? '#6C63FF' : t.muted,
                gap: '3px', position: 'relative'
              }}
            >
              {activePage === item.id && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '24px', height: '2px', background: '#6C63FF', borderRadius: '0 0 2px 2px'
                }} />
              )}
              {item.icon(activePage === item.id)}
              <span style={{
                fontSize: '10px',
                fontWeight: activePage === item.id ? '700' : '400',
                fontFamily: "'Barlow', sans-serif"
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