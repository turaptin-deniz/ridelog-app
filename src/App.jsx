import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import './design-system.css'
import Login from './pages/Login'
import Map from './pages/Map'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import Messages from './pages/Messages'
import Discover from './pages/Discover'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [activePage, setActivePage] = useState('map')
  const [showSettings, setShowSettings] = useState(false)
  const [showLanguage, setShowLanguage] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('de')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  // Apply theme to <html> so all CSS variables switch globally
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  }, [darkMode])

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

  // Navigate to another user's profile from anywhere
  const navigateToProfile = (userId) => {
    setActivePage('profil')
  }

  const renderPage = () => {
    // When user is searching, show Discover regardless of activePage
    if (searchQuery.trim().length > 0) {
      return <Discover darkMode={darkMode} searchQuery={searchQuery} onSelectUser={navigateToProfile} />
    }
    switch(activePage) {
      case 'map': return <Map darkMode={darkMode} onSelectRider={navigateToProfile} />
      case 'feed': return <Feed darkMode={darkMode} />
      case 'messages': return <Messages darkMode={darkMode} />
      case 'profil': return <Profile darkMode={darkMode} setDarkMode={setDarkMode} />
      case 'discover': return <Discover darkMode={darkMode} onSelectUser={navigateToProfile} />
      default: return <Map darkMode={darkMode} onSelectRider={navigateToProfile} />
    }
  }

  // 4 main nav items + center plus button
  const NAV_LEFT = [
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
  ]

  const NAV_RIGHT = [
    { id: 'messages', label: 'Chats', icon: (active) => (
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

  const NavBtn = ({ item }) => (
    <button
      key={item.id}
      onClick={() => { setActivePage(item.id); setSearchQuery('') }}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-3) 0 var(--space-2)', background: 'transparent', border: 'none',
        cursor: 'pointer',
        color: activePage === item.id && !searchQuery ? t.accent : t.muted,
        gap: 'var(--space-1)', position: 'relative',
        transition: 'color var(--transition-fast)'
      }}
    >
      {activePage === item.id && !searchQuery && (
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '24px', height: '2px', background: t.accent, borderRadius: '0 0 2px 2px'
        }} />
      )}
      {item.icon(activePage === item.id && !searchQuery)}
      <span style={{
        fontSize: 'var(--font-size-xs)',
        fontWeight: activePage === item.id && !searchQuery ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
        fontFamily: "var(--font-family-primary)"
      }}>
        {item.label}
      </span>
    </button>
  )

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
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          background: t.surface, flexShrink: 0
        }}>
          {/* Logo */}
          <div style={{
            width: '36px', height: '36px',
            background: `linear-gradient(135deg, ${t.accent} 0%, var(--color-accent-secondary) 100%)`,
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(255, 107, 53, 0.25)',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="5.5" cy="17.5" r="3" stroke="white" strokeWidth="1.8"/>
              <circle cx="18.5" cy="17.5" r="3" stroke="white" strokeWidth="1.8"/>
              <path d="M5.5 17.5L8 10L12 9L15 6H18L19.5 9L21 11L18.5 17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 10L12 11L15 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Search Field (center, takes flex) */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            background: t.bg, border: `1px solid ${searchFocused ? t.accent : t.border}`,
            borderRadius: 'var(--radius-full)',
            padding: '6px 12px',
            transition: 'border-color var(--transition-fast)'
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={searchFocused ? t.accent : t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'stroke var(--transition-fast)' }}>
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Entdecken..."
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                color: t.text, fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family-primary)', outline: 'none',
                padding: '2px 0'
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{
                background: 'transparent', border: 'none', color: t.muted,
                cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'transparent', border: 'none', color: t.muted,
              cursor: 'pointer', padding: 'var(--space-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={e => e.currentTarget.style.color = t.accent}
            onMouseLeave={e => e.currentTarget.style.color = t.muted}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>

          {/* Notification Bell */}
          <button style={{
            background: 'transparent', border: 'none', color: t.muted,
            cursor: 'pointer', padding: 'var(--space-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color var(--transition-fast)'
          }}
          onMouseEnter={e => e.currentTarget.style.color = t.accent}
          onMouseLeave={e => e.currentTarget.style.color = t.muted}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="animate-fadeIn">
          {renderPage()}
        </div>

        {/* Bottom Navigation with center Plus */}
        <div style={{
          display: 'flex', borderTop: `1px solid ${t.border}`,
          background: t.surface, flexShrink: 0, paddingBottom: 'var(--space-1)',
          alignItems: 'center',
          position: 'relative', zIndex: 1500, overflow: 'visible'
        }}>
          {NAV_LEFT.map(item => <NavBtn key={item.id} item={item} />)}

          {/* Center Plus Button */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 1600 }}>
            <button
              onClick={() => {
                // Trigger create action on current page
                window.dispatchEvent(new CustomEvent('ridelog:plus-click', { detail: { page: activePage } }))
              }}
              style={{
                width: '52px', height: '52px',
                background: `linear-gradient(135deg, ${t.accent} 0%, #ff5a1f 100%)`,
                border: 'none', borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(255,107,53,0.45)',
                transform: 'translateY(-12px)',
                transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
                position: 'relative', zIndex: 1700
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-14px) scale(1.05)'
                e.currentTarget.style.boxShadow = '0 6px 22px rgba(255,107,53,0.6)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(-12px) scale(1)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,107,53,0.45)'
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>

          {NAV_RIGHT.map(item => <NavBtn key={item.id} item={item} />)}
        </div>

        {/* Settings Modal (centered) */}
        {showSettings && (
          <div
            onClick={() => setShowSettings(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2000, padding: 'var(--space-4)', backdropFilter: 'blur(4px)'
            }}
            className="animate-fadeIn"
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: t.surface, borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)', width: '100%', maxWidth: '380px',
                border: `1px solid ${t.border}`,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
              }}
              className="animate-scaleIn"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                <h3 style={{
                  color: t.text, fontSize: 'var(--font-size-xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  fontFamily: "var(--font-family-condensed)", margin: 0
                }}>
                  Einstellungen
                </h3>
                <button onClick={() => setShowSettings(false)} style={{
                  background: 'none', border: 'none', color: t.muted,
                  cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1
                }}>×</button>
              </div>

              {/* Theme Toggle — segmented switch */}
              <div style={{
                position: 'relative',
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                background: t.bg,
                border: `1px solid ${t.border}`,
                borderRadius: 'var(--radius-full)',
                padding: '4px',
                marginBottom: 'var(--space-2)',
                height: '44px',
                overflow: 'hidden'
              }}>
                {/* Sliding indicator */}
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  left: darkMode ? 'calc(50% + 0px)' : '4px',
                  width: 'calc(50% - 4px)',
                  height: 'calc(100% - 8px)',
                  background: `linear-gradient(135deg, ${t.accent} 0%, #ff5a1f 100%)`,
                  borderRadius: 'var(--radius-full)',
                  boxShadow: '0 2px 10px rgba(255, 107, 53, 0.35)',
                  transition: 'left 280ms cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 1
                }} />

                {/* Light Mode option */}
                <button
                  onClick={() => setDarkMode(false)}
                  style={{
                    position: 'relative', zIndex: 2,
                    background: 'transparent', border: 'none',
                    color: !darkMode ? '#ffffff' : t.text,
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    fontFamily: 'var(--font-family-primary)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '6px',
                    transition: 'color 280ms cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4"/>
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                  </svg>
                  Light
                </button>

                {/* Dark Mode option */}
                <button
                  onClick={() => setDarkMode(true)}
                  style={{
                    position: 'relative', zIndex: 2,
                    background: 'transparent', border: 'none',
                    color: darkMode ? '#ffffff' : t.text,
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    fontFamily: 'var(--font-family-primary)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '6px',
                    transition: 'color 280ms cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                  Dark
                </button>
              </div>

              {/* Other settings */}
              {[
                { label: 'Privatsphäre', icon: '🔒', action: () => {} },
                { label: 'Sprache', icon: '🌍', action: () => setShowLanguage(true) },
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{
                  width: '100%', background: t.bg, border: `1px solid ${t.border}`,
                  color: t.text, borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)', cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)',
                  fontFamily: "var(--font-family-primary)", textAlign: 'left',
                  marginBottom: 'var(--space-2)', transition: 'all var(--transition-fast)',
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = t.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}

              <button onClick={() => supabase.auth.signOut()} style={{
                width: '100%', background: 'transparent', border: '1px solid #f87171',
                color: '#f87171', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)', cursor: 'pointer',
                fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)',
                fontFamily: "var(--font-family-primary)", marginTop: 'var(--space-2)',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                Abmelden
              </button>
            </div>
          </div>
        )}

        {/* Language Modal (centered) */}
        {showLanguage && (
          <div
            onClick={() => setShowLanguage(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2100, padding: 'var(--space-4)', backdropFilter: 'blur(4px)'
            }}
            className="animate-fadeIn"
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: t.surface, borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)', width: '100%', maxWidth: '360px',
                border: `1px solid ${t.border}`,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
              }}
              className="animate-scaleIn"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                <h3 style={{
                  color: t.text, fontSize: 'var(--font-size-xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  fontFamily: "var(--font-family-condensed)", margin: 0
                }}>Sprache</h3>
                <button onClick={() => setShowLanguage(false)} style={{
                  background: 'none', border: 'none', color: t.muted,
                  cursor: 'pointer', fontSize: '22px', padding: 0, lineHeight: 1
                }}>×</button>
              </div>
              {[
                { label: 'Deutsch', flag: '🇩🇪', id: 'de' },
                { label: 'Englisch', flag: '🇬🇧', id: 'en' },
                { label: 'Französisch', flag: '🇫🇷', id: 'fr' },
                { label: 'Spanisch', flag: '🇪🇸', id: 'es' },
              ].map(lang => (
                <button key={lang.id} onClick={() => { setSelectedLanguage(lang.id); setShowLanguage(false) }} style={{
                  width: '100%',
                  background: selectedLanguage === lang.id ? 'rgba(255,107,53,0.12)' : t.bg,
                  border: `1px solid ${selectedLanguage === lang.id ? t.accent : t.border}`,
                  color: t.text, borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)', cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)',
                  fontFamily: "var(--font-family-primary)", textAlign: 'left',
                  marginBottom: 'var(--space-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all var(--transition-fast)'
                }}>
                  <span>{lang.flag} {lang.label}</span>
                  {selectedLanguage === lang.id && <span style={{ color: t.accent, fontSize: '16px' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App
