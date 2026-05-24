import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function Messages({ darkMode }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const [view, setView] = useState('list') // 'list' | 'chat' | 'requests'
  const [conversations, setConversations] = useState([])
  const [requests, setRequests] = useState([])
  const [messages, setMessages] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    init()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', user.id)
    loadConversations(user.id)
    loadRequests(user.id)
    setLoading(false)
  }

  const loadConversations = async (userId) => {
    const { data: sent } = await supabase.from('messages').select('*, receiver:profiles!messages_receiver_id_fkey(id, username, avatar_url, is_online)').eq('sender_id', userId).order('created_at', { ascending: false })
    const { data: received } = await supabase.from('messages').select('*, sender:profiles!messages_sender_id_fkey(id, username, avatar_url, is_online)').eq('receiver_id', userId).order('created_at', { ascending: false })

    const allMessages = [...(sent || []), ...(received || [])]
    const convMap = {}

    allMessages.forEach(msg => {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id
      const otherProfile = msg.sender_id === userId ? msg.receiver : msg.sender
      if (!convMap[otherId] || new Date(msg.created_at) > new Date(convMap[otherId].lastMessage.created_at)) {
        convMap[otherId] = { profile: otherProfile, lastMessage: msg, unread: !msg.read && msg.receiver_id === userId }
      }
    })

    setConversations(Object.values(convMap))
  }

  const loadRequests = async (userId) => {
    const { data } = await supabase.from('message_requests')
      .select('*, sender:profiles!message_requests_sender_id_fkey(id, username, avatar_url)')
      .eq('receiver_id', userId)
      .eq('status', 'pending')
    setRequests(data || [])
  }

  const openChat = async (profile) => {
    setActiveChat(profile)
    setView('chat')
    loadMessages(profile.id)
    subscribeToMessages(profile.id)
  }

  const loadMessages = async (otherId) => {
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true })
    setMessages(data || [])

    // Mark as read
    await supabase.from('messages').update({ read: true })
      .eq('receiver_id', currentUser.id)
      .eq('sender_id', otherId)
  }

  const subscribeToMessages = (otherId) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase.channel(`chat-${otherId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new
        if ((msg.sender_id === otherId && msg.receiver_id === currentUser.id) ||
            (msg.sender_id === currentUser.id && msg.receiver_id === otherId)) {
          setMessages(prev => [...prev, msg])
        }
      })
      .subscribe()
    channelRef.current = channel
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return

    // Check if friends (mutual follow)
    const { data: iFollow } = await supabase.from('follows')
      .select('id').eq('follower_id', currentUser.id).eq('following_id', activeChat.id).single()
    const { data: theyFollow } = await supabase.from('follows')
      .select('id').eq('follower_id', activeChat.id).eq('following_id', currentUser.id).single()

    const areFriends = iFollow && theyFollow

    if (!areFriends) {
      // Send message request first
      const { data: existingRequest } = await supabase.from('message_requests')
        .select('id').eq('sender_id', currentUser.id).eq('receiver_id', activeChat.id).single()

      if (!existingRequest) {
        await supabase.from('message_requests').insert({
          sender_id: currentUser.id,
          receiver_id: activeChat.id,
          status: 'pending'
        })
      }
    }

    await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: activeChat.id,
      content: newMessage.trim()
    })

    setNewMessage('')
    loadConversations(currentUser.id)
  }

  const acceptRequest = async (request) => {
    await supabase.from('message_requests').update({ status: 'accepted' }).eq('id', request.id)
    setRequests(requests.filter(r => r.id !== request.id))
    loadConversations(currentUser.id)
  }

  const declineRequest = async (request) => {
    await supabase.from('message_requests').update({ status: 'declined' }).eq('id', request.id)
    setRequests(requests.filter(r => r.id !== request.id))
  }

  const searchUsers = async (query) => {
    setSearchQuery(query)
    if (!query.trim()) { setSearchResults([]); return }
    const { data } = await supabase.from('profiles')
      .select('id, username, avatar_url, is_online')
      .ilike('username', `%${query}%`)
      .neq('id', currentUser.id)
      .limit(10)
    setSearchResults(data || [])
  }

  const formatTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Gerade'
    if (mins < 60) return `${mins}m`
    if (mins < 1440) return `${Math.floor(mins/60)}h`
    return `${Math.floor(mins/1440)}d`
  }

  const inputStyle = {
    width: '100%', background: t.bg, border: `1px solid ${t.border}`,
    borderRadius: '8px', padding: '10px 12px', color: t.text,
    fontSize: '14px', boxSizing: 'border-box', fontFamily: "'Barlow', sans-serif",
    outline: 'none'
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <p style={{ color: '#3b82f6' }}>Laden...</p>
    </div>
  )

  // Chat View
  if (view === 'chat' && activeChat) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg }}>

      {/* Chat Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={() => { setView('list'); setActiveChat(null) }} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '20px', padding: '0' }}>←</button>
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: 'white', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
          {activeChat.avatar_url
            ? <img src={activeChat.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : activeChat.username?.slice(0,2).toUpperCase()}
          {activeChat.is_online && (
            <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '10px', height: '10px', borderRadius: '50%', background: '#4ade80', border: `2px solid ${t.surface}` }} />
          )}
        </div>
        <div>
          <p style={{ fontWeight: '700', fontSize: '14px', color: t.text, fontFamily: "'Barlow', sans-serif" }}>@{activeChat.username}</p>
          <p style={{ fontSize: '11px', color: activeChat.is_online ? '#4ade80' : t.muted }}>
            {activeChat.is_online ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>💬</p>
            <p style={{ color: t.muted, fontSize: '13px' }}>Schreib eine Nachricht!</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUser.id
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '75%', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isMe ? '#3b82f6' : t.surface,
                border: isMe ? 'none' : `1px solid ${t.border}`
              }}>
                <p style={{ color: isMe ? 'white' : t.text, fontSize: '14px', lineHeight: '1.4', fontFamily: "'Barlow', sans-serif" }}>{msg.content}</p>
                <p style={{ color: isMe ? 'rgba(255,255,255,0.6)' : t.muted, fontSize: '10px', marginTop: '4px', textAlign: 'right' }}>{formatTime(msg.created_at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, background: t.surface, display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
        <input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Nachricht schreiben..."
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={sendMessage} disabled={!newMessage.trim()} className="btn-press" style={{
          background: newMessage.trim() ? '#3b82f6' : t.border,
          border: 'none', borderRadius: '50%', width: '40px', height: '40px',
          cursor: newMessage.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  )

  // Requests View
  if (view === 'requests') return (
    <div style={{ flex: 1, background: t.bg, overflowY: 'auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '20px' }}>←</button>
        <h3 style={{ color: t.text, fontSize: '16px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>Nachrichtenanfragen</h3>
      </div>

      {requests.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '32px', marginBottom: '8px' }}>📭</p>
          <p style={{ color: t.muted, fontSize: '13px' }}>Keine Anfragen</p>
        </div>
      ) : (
        requests.map(req => (
          <div key={req.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '16px', flexShrink: 0 }}>
              {req.sender?.username?.slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '700', fontSize: '14px', color: t.text }}>@{req.sender?.username}</p>
              <p style={{ color: t.muted, fontSize: '12px' }}>Möchte dir schreiben</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => acceptRequest(req)} className="btn-press" style={{
                background: '#3b82f6', border: 'none', color: 'white',
                borderRadius: '6px', padding: '8px 12px', cursor: 'pointer',
                fontSize: '12px', fontFamily: "'Barlow', sans-serif", fontWeight: '600'
              }}>✓</button>
              <button onClick={() => declineRequest(req)} className="btn-press" style={{
                background: 'transparent', border: `1px solid #f87171`, color: '#f87171',
                borderRadius: '6px', padding: '8px 12px', cursor: 'pointer',
                fontSize: '12px', fontFamily: "'Barlow', sans-serif", fontWeight: '600'
              }}>✕</button>
            </div>
          </div>
        ))
      )}
    </div>
  )

  // Main List View
  return (
    <div style={{ flex: 1, background: t.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ color: t.text, fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>Nachrichten</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {requests.length > 0 && (
              <button onClick={() => setView('requests')} style={{
                background: '#3b82f622', border: '1px solid #3b82f644', color: '#3b82f6',
                borderRadius: '6px', padding: '6px 10px', cursor: 'pointer',
                fontSize: '12px', fontFamily: "'Barlow', sans-serif", fontWeight: '600'
              }}>📨 {requests.length}</button>
            )}
            <button onClick={() => setShowSearch(!showSearch)} style={{
              background: 'transparent', border: `1px solid ${t.border}`, color: t.muted,
              borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px'
            }}>🔍</button>
          </div>
        </div>

        {/* Search */}
        {showSearch && (
          <div className="animate-slideUp">
            <input
              value={searchQuery}
              onChange={e => searchUsers(e.target.value)}
              placeholder="Nutzer suchen..."
              style={inputStyle}
            />
            {searchResults.length > 0 && (
              <div style={{ marginTop: '8px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                {searchResults.map(user => (
                  <div key={user.id} onClick={() => { openChat(user); setShowSearch(false); setSearchQuery('') }} style={{
                    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                    cursor: 'pointer', borderBottom: `1px solid ${t.border}`
                  }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px', position: 'relative', flexShrink: 0 }}>
                      {user.avatar_url
                        ? <img src={user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        : user.username?.slice(0,2).toUpperCase()}
                      {user.is_online && (
                        <div style={{ position: 'absolute', bottom: '0', right: '0', width: '9px', height: '9px', borderRadius: '50%', background: '#4ade80', border: `2px solid ${t.bg}` }} />
                      )}
                    </div>
                    <div>
                      <p style={{ color: t.text, fontSize: '13px', fontWeight: '600', fontFamily: "'Barlow', sans-serif" }}>@{user.username}</p>
                      <p style={{ color: t.muted, fontSize: '11px' }}>{user.is_online ? '🟢 Online' : 'Offline'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversations */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>💬</p>
            <p style={{ color: t.muted, fontSize: '14px', marginBottom: '8px' }}>Noch keine Nachrichten</p>
            <p style={{ color: t.muted, fontSize: '13px' }}>Suche nach Nutzern um zu schreiben</p>
          </div>
        ) : (
          conversations.map(conv => (
            <div key={conv.profile?.id} onClick={() => openChat(conv.profile)} style={{
              padding: '14px 16px', borderBottom: `1px solid ${t.border}`,
              display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
              background: conv.unread ? '#3b82f60a' : 'transparent',
              transition: 'background 0.15s'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '16px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                {conv.profile?.avatar_url
                  ? <img src={conv.profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : conv.profile?.username?.slice(0,2).toUpperCase()}
                {conv.profile?.is_online && (
                  <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '12px', height: '12px', borderRadius: '50%', background: '#4ade80', border: `2px solid ${t.bg}` }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <p style={{ fontWeight: conv.unread ? '700' : '600', fontSize: '14px', color: t.text, fontFamily: "'Barlow', sans-serif" }}>
                    @{conv.profile?.username}
                  </p>
                  <p style={{ color: t.muted, fontSize: '11px', flexShrink: 0 }}>{formatTime(conv.lastMessage.created_at)}</p>
                </div>
                <p style={{ color: conv.unread ? t.text : t.muted, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: conv.unread ? '600' : '400' }}>
                  {conv.lastMessage.sender_id === currentUser.id ? 'Du: ' : ''}{conv.lastMessage.content}
                </p>
              </div>
              {conv.unread && (
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}