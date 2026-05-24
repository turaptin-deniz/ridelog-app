import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Discover({ darkMode, searchQuery: externalQuery, onSelectUser }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [localQuery, setLocalQuery] = useState('')
  const searchQuery = externalQuery !== undefined ? externalQuery : localQuery
  const setSearchQuery = externalQuery !== undefined ? () => {} : setLocalQuery
  const [currentUser, setCurrentUser] = useState(null)
  const [followStates, setFollowStates] = useState({})

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    loadUsers(user.id)
    loadRoutes()
  }

  useEffect(() => { init() }, [])

  const loadUsers = async (userId) => {
    const { data } = await supabase.from('profiles')
      .select('*, followers:follows!follows_following_id_fkey(count), following:follows!follows_follower_id_fkey(count)')
      .neq('id', userId)
      .limit(20)

    if (data) {
      setUsers(data)
      const states = {}
      await Promise.all(data.map(async user => {
        const { data: follow } = await supabase.from('follows')
          .select('id').eq('follower_id', userId).eq('following_id', user.id).single()
        states[user.id] = !!follow
      }))
      setFollowStates(states)
    }
    setLoading(false)
  }

  const loadRoutes = async () => {
    const { data } = await supabase.from('routes')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setRoutes(data)
  }

  const toggleFollow = async (userId) => {
    if (!currentUser) return
    const isFollowing = followStates[userId]
    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', currentUser.id).eq('following_id', userId)
    } else {
      await supabase.from('follows').insert({
        follower_id: currentUser.id, following_id: userId
      })
    }
    setFollowStates(prev => ({ ...prev, [userId]: !isFollowing }))
  }

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredRoutes = routes.filter(r =>
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.region?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const LEAGUES = [
    { id: 'bronze', label: 'Bronze', icon: '🥉', color: '#cd7f32', min: 0 },
    { id: 'silver', label: 'Silber', icon: '🥈', color: '#c0c0c0', min: 500 },
    { id: 'gold', label: 'Gold', icon: '🥇', color: '#ffd700', min: 1500 },
    { id: 'platinum', label: 'Platin', icon: '💎', color: '#e5e4e2', min: 3000 },
    { id: 'diamond', label: 'Diamant', icon: '💠', color: '#b9f2ff', min: 6000 },
  ]

  const getLeague = (km) => {
    const sorted = [...LEAGUES].reverse()
    return sorted.find(l => (km || 0) >= l.min) || LEAGUES[0]
  }

  const getDifficultyColor = (diff) => {
    switch(diff) {
      case 'easy': return '#4ade80'
      case 'medium': return '#facc15'
      case 'hard': return '#f97316'
      case 'expert': return '#f43f5e'
      default: return '#6C63FF'
    }
  }

  const getDifficultyLabel = (diff) => {
    switch(diff) {
      case 'easy': return 'Leicht'
      case 'medium': return 'Mittel'
      case 'hard': return 'Schwer'
      case 'expert': return 'Experte'
      default: return diff
    }
  }

  return (
    <div style={{ flex: 1, background: t.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Search Bar — only shown when used standalone (not when controlled by header) */}
      {externalQuery === undefined && (
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'users' ? 'Nutzer suchen...' : 'Routen suchen...'}
            style={{
              width: '100%', background: t.bg, border: `1px solid ${t.border}`,
              borderRadius: '10px', padding: '10px 12px 10px 38px', color: t.text,
              fontSize: '14px', fontFamily: "'Barlow', sans-serif", outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
        {[
          { id: 'users', label: 'Fahrer' },
          { id: 'routes', label: 'Routen' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '12px', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid #6C63FF' : '2px solid transparent',
            color: activeTab === tab.id ? '#6C63FF' : t.muted,
            cursor: 'pointer', fontSize: '14px', fontWeight: '700',
            fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
            <p style={{ color: '#6C63FF' }}>Laden...</p>
          </div>
        ) : activeTab === 'users' ? (
          <>
            {filteredUsers.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <p style={{ color: t.muted, fontSize: '14px' }}>Keine Nutzer gefunden</p>
              </div>
            ) : (
              filteredUsers.map(user => {
                const league = getLeague(user.total_km)
                const isFollowing = followStates[user.id]
                return (
                  <div key={user.id} style={{
                    padding: '14px 16px', borderBottom: `1px solid ${t.border}`,
                    display: 'flex', alignItems: 'center', gap: '12px',
                    cursor: onSelectUser ? 'pointer' : 'default'
                  }}
                  onClick={() => onSelectUser && onSelectUser(user.id)}
                  className="animate-fadeIn">

                    {/* Avatar */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: '50px', height: '50px', borderRadius: '50%',
                        background: '#6C63FF', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: 'white', fontWeight: '700',
                        fontSize: '16px', overflow: 'hidden'
                      }}>
                        {user.avatar_url
                          ? <img src={user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : user.username?.slice(0,2).toUpperCase()}
                      </div>
                      {user.is_online && (
                        <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '12px', height: '12px', borderRadius: '50%', background: '#4ade80', border: `2px solid ${t.bg}` }} />
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <p style={{ fontWeight: '700', fontSize: '14px', color: t.text, fontFamily: "'Barlow', sans-serif" }}>
                          @{user.username}
                        </p>
                        <div style={{
                          background: league.color + '22', border: `1px solid ${league.color}44`,
                          borderRadius: '50px', padding: '1px 6px',
                          display: 'flex', alignItems: 'center', gap: '3px'
                        }}>
                          <span style={{ fontSize: '10px' }}>{league.icon}</span>
                          <span style={{ color: league.color, fontSize: '9px', fontWeight: '700', fontFamily: "'Barlow', sans-serif" }}>
                            {league.label.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {user.location && (
                        <p style={{ color: t.muted, fontSize: '11px', marginBottom: '2px' }}>📍 {user.location}</p>
                      )}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <p style={{ color: t.muted, fontSize: '11px' }}>
                          <span style={{ color: t.text, fontWeight: '700' }}>{Math.round(user.total_km || 0)}</span> km
                        </p>
                        <p style={{ color: t.muted, fontSize: '11px' }}>
                          <span style={{ color: t.text, fontWeight: '700' }}>{user.total_rides || 0}</span> Touren
                        </p>
                      </div>
                    </div>

                    {/* Follow Button */}
                    <button onClick={e => { e.stopPropagation(); toggleFollow(user.id) }} className="btn-press" style={{
                      background: isFollowing ? 'transparent' : '#6C63FF',
                      border: isFollowing ? `1px solid ${t.border}` : 'none',
                      color: isFollowing ? t.muted : 'white',
                      borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
                      fontSize: '12px', fontFamily: "'Barlow', sans-serif",
                      fontWeight: '700', flexShrink: 0, transition: 'all 0.2s'
                    }}>
                      {isFollowing ? 'Gefolgt' : 'Folgen'}
                    </button>
                  </div>
                )
              })
            )}
          </>
        ) : (
          <>
            {filteredRoutes.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <p style={{ color: t.muted, fontSize: '14px' }}>Keine Routen gefunden</p>
              </div>
            ) : (
              filteredRoutes.map(route => (
                <div key={route.id} style={{
                  padding: '14px 16px', borderBottom: `1px solid ${t.border}`
                }} className="animate-fadeIn">

                  {/* Route Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '700', fontSize: '15px', color: t.text, fontFamily: "'Barlow', sans-serif", marginBottom: '4px' }}>{route.title}</p>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {route.region && (
                          <p style={{ color: t.muted, fontSize: '11px' }}>📍 {route.region}</p>
                        )}
                        {route.difficulty && (
                          <div style={{
                            background: getDifficultyColor(route.difficulty) + '22',
                            border: `1px solid ${getDifficultyColor(route.difficulty)}44`,
                            borderRadius: '50px', padding: '1px 8px'
                          }}>
                            <p style={{ color: getDifficultyColor(route.difficulty), fontSize: '10px', fontWeight: '700', fontFamily: "'Barlow', sans-serif" }}>
                              {getDifficultyLabel(route.difficulty).toUpperCase()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Route Stats */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                    {[
                      { icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round">
                          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                        </svg>
                      ), value: `${route.distance_km} km` },
                      route.duration_minutes && { icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                      ), value: `${Math.floor(route.duration_minutes/60)}h ${route.duration_minutes%60}min` },
                      route.surface && { icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        </svg>
                      ), value: route.surface === 'asphalt' ? 'Asphalt' : route.surface === 'gravel' ? 'Schotter' : 'Gemischt' },
                    ].filter(Boolean).map((stat, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {stat.icon}
                        <p style={{ color: t.text, fontSize: '12px', fontFamily: "'Barlow', sans-serif", fontWeight: '600' }}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Author */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: '700', overflow: 'hidden' }}>
                      {route.profiles?.avatar_url
                        ? <img src={route.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : route.profiles?.username?.slice(0,2).toUpperCase()}
                    </div>
                    <p style={{ color: t.muted, fontSize: '11px' }}>von <span style={{ color: '#6C63FF', fontWeight: '700' }}>@{route.profiles?.username}</span></p>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}