import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function Messages({ darkMode }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const [view, setView] = useState('list') // 'list' | 'chat' | 'groupchat' | 'requests'
  const [conversations, setConversations]   = useState([])
  const [groupChats, setGroupChats]         = useState([])
  const [requests, setRequests]             = useState([])
  const [messages, setMessages]             = useState([])
  const [groupMessages, setGroupMessages]   = useState([])
  const [groupMembers, setGroupMembers]     = useState([])
  const [activeChat, setActiveChat]         = useState(null)  // 1:1 profile
  const [activeGroup, setActiveGroup]       = useState(null)  // group chat object
  const [newMessage, setNewMessage]         = useState('')
  const [currentUser, setCurrentUser]       = useState(null)
  const [loading, setLoading]               = useState(true)
  const [searchQuery, setSearchQuery]       = useState('')
  const [searchResults, setSearchResults]   = useState([])
  const [showSearch, setShowSearch]         = useState(false)

  // ── Create-group state ─────────────────────────────────────────────────────
  const [showCreateGroup, setShowCreateGroup]         = useState(false)
  const [newGroupName, setNewGroupName]               = useState('')
  const [groupMemberSearch, setGroupMemberSearch]     = useState('')
  const [groupMemberResults, setGroupMemberResults]   = useState([])
  const [selectedMembers, setSelectedMembers]         = useState([])
  const [creatingGroup, setCreatingGroup]             = useState(false)

  const messagesEndRef = useRef(null)
  const channelRef     = useRef(null)

  useEffect(() => {
    init()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages, groupMessages])

  // ── Init ───────────────────────────────────────────────────────────────────
  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', user.id)
    await Promise.all([
      loadConversations(user.id),
      loadRequests(user.id),
      loadGroupChats(user.id),
    ])
    setLoading(false)
  }

  // ── 1:1 Conversations ──────────────────────────────────────────────────────
  const loadConversations = async (userId) => {
    const { data: sent }     = await supabase.from('messages').select('*, receiver:profiles!messages_receiver_id_fkey(id, username, avatar_url, is_online)').eq('sender_id', userId).order('created_at', { ascending: false })
    const { data: received } = await supabase.from('messages').select('*, sender:profiles!messages_sender_id_fkey(id, username, avatar_url, is_online)').eq('receiver_id', userId).order('created_at', { ascending: false })

    const convMap = {}
    ;[...(sent || []), ...(received || [])].forEach(msg => {
      const otherId      = msg.sender_id === userId ? msg.receiver_id : msg.sender_id
      const otherProfile = msg.sender_id === userId ? msg.receiver   : msg.sender
      if (!convMap[otherId] || new Date(msg.created_at) > new Date(convMap[otherId].lastMessage.created_at)) {
        convMap[otherId] = { profile: otherProfile, lastMessage: msg, unread: !msg.read && msg.receiver_id === userId }
      }
    })
    setConversations(Object.values(convMap))
  }

  const loadRequests = async (userId) => {
    const { data } = await supabase.from('message_requests')
      .select('*, sender:profiles!message_requests_sender_id_fkey(id, username, avatar_url)')
      .eq('receiver_id', userId).eq('status', 'pending')
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
    await supabase.from('messages').update({ read: true }).eq('receiver_id', currentUser.id).eq('sender_id', otherId)
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
      }).subscribe()
    channelRef.current = channel
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return
    const { data: iFollow }    = await supabase.from('follows').select('id').eq('follower_id', currentUser.id).eq('following_id', activeChat.id).single()
    const { data: theyFollow } = await supabase.from('follows').select('id').eq('follower_id', activeChat.id).eq('following_id', currentUser.id).single()

    if (!(iFollow && theyFollow)) {
      const { data: existingReq } = await supabase.from('message_requests').select('id').eq('sender_id', currentUser.id).eq('receiver_id', activeChat.id).single()
      if (!existingReq) await supabase.from('message_requests').insert({ sender_id: currentUser.id, receiver_id: activeChat.id, status: 'pending' })
    }
    await supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: activeChat.id, content: newMessage.trim() })
    setNewMessage('')
    loadConversations(currentUser.id)
    // Notify recipient (graceful — notification table may not exist yet)
    supabase.from('notifications').insert({ recipient_id: activeChat.id, sender_id: currentUser.id, type: 'message' }).then(() => {})
  }

  const acceptRequest = async (req) => {
    await supabase.from('message_requests').update({ status: 'accepted' }).eq('id', req.id)
    setRequests(prev => prev.filter(r => r.id !== req.id))
    loadConversations(currentUser.id)
  }

  const declineRequest = async (req) => {
    await supabase.from('message_requests').update({ status: 'declined' }).eq('id', req.id)
    setRequests(prev => prev.filter(r => r.id !== req.id))
  }

  const searchUsers = async (query) => {
    setSearchQuery(query)
    if (!query.trim()) { setSearchResults([]); return }
    const { data } = await supabase.from('profiles').select('id, username, avatar_url, is_online').ilike('username', `%${query}%`).neq('id', currentUser.id).limit(10)
    setSearchResults(data || [])
  }

  // ── Group Chats ────────────────────────────────────────────────────────────
  const loadGroupChats = async (userId) => {
    try {
      const { data: memberships, error: memErr } = await supabase
        .from('group_members').select('group_id').eq('user_id', userId)
      if (memErr) return // table doesn't exist yet
      if (!memberships?.length) { setGroupChats([]); return }

      const groupIds = memberships.map(m => m.group_id)
      const { data: groups } = await supabase.from('group_chats').select('*').in('id', groupIds)
      if (!groups?.length) { setGroupChats([]); return }

      const enriched = await Promise.all(groups.map(async (g) => {
        const { data: lastMsg } = await supabase
          .from('group_messages')
          .select('*, sender:profiles!group_messages_sender_id_fkey(id, username)')
          .eq('group_id', g.id).order('created_at', { ascending: false }).limit(1).single()
        const { count } = await supabase.from('group_members').select('id', { count: 'exact', head: true }).eq('group_id', g.id)
        return { ...g, lastMessage: lastMsg || null, memberCount: count || 0 }
      }))

      setGroupChats(enriched)
    } catch { /* graceful: tables might not exist */ }
  }

  const openGroupChat = async (group) => {
    setActiveGroup(group)
    setView('groupchat')
    await Promise.all([loadGroupMessages(group.id), loadGroupMembers(group.id)])
    subscribeToGroupMessages(group.id)
  }

  const loadGroupMessages = async (groupId) => {
    try {
      const { data } = await supabase
        .from('group_messages')
        .select('*, sender:profiles!group_messages_sender_id_fkey(id, username, avatar_url)')
        .eq('group_id', groupId).order('created_at', { ascending: true })
      setGroupMessages(data || [])
    } catch { setGroupMessages([]) }
  }

  const loadGroupMembers = async (groupId) => {
    try {
      const { data } = await supabase
        .from('group_members')
        .select('*, profile:profiles!group_members_user_id_fkey(id, username, avatar_url, is_online)')
        .eq('group_id', groupId)
      setGroupMembers(data || [])
    } catch { setGroupMembers([]) }
  }

  const subscribeToGroupMessages = (groupId) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase.channel(`group-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, async (payload) => {
        try {
          const { data: full } = await supabase
            .from('group_messages')
            .select('*, sender:profiles!group_messages_sender_id_fkey(id, username, avatar_url)')
            .eq('id', payload.new.id).single()
          setGroupMessages(prev => {
            const msg = full || payload.new
            return prev.some(m => m.id === msg.id) ? prev : [...prev, msg]
          })
        } catch {
          setGroupMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        }
      }).subscribe()
    channelRef.current = channel
  }

  const sendGroupMessage = async () => {
    if (!newMessage.trim() || !activeGroup) return
    try {
      await supabase.from('group_messages').insert({
        group_id: activeGroup.id, sender_id: currentUser.id, content: newMessage.trim()
      })
      setNewMessage('')
    } catch (e) { console.error('sendGroupMessage:', e) }
  }

  // ── Create Group ───────────────────────────────────────────────────────────
  const searchForGroupMember = async (query) => {
    setGroupMemberSearch(query)
    if (!query.trim()) { setGroupMemberResults([]); return }
    const { data } = await supabase.from('profiles').select('id, username, avatar_url').ilike('username', `%${query}%`).neq('id', currentUser.id).limit(8)
    setGroupMemberResults((data || []).filter(u => !selectedMembers.find(m => m.id === u.id)))
  }

  const addMember = (user) => {
    setSelectedMembers(prev => prev.find(m => m.id === user.id) ? prev : [...prev, user])
    setGroupMemberResults(prev => prev.filter(u => u.id !== user.id))
    setGroupMemberSearch('')
  }

  const removeMember = (userId) => setSelectedMembers(prev => prev.filter(m => m.id !== userId))

  const createGroupChat = async () => {
    if (!newGroupName.trim() || selectedMembers.length === 0 || creatingGroup) return
    setCreatingGroup(true)
    try {
      const { data: group, error } = await supabase
        .from('group_chats')
        .insert({ name: newGroupName.trim(), created_by: currentUser.id })
        .select().single()
      if (error) throw error

      await supabase.from('group_members').insert([
        { group_id: group.id, user_id: currentUser.id },
        ...selectedMembers.map(m => ({ group_id: group.id, user_id: m.id }))
      ])

      const newGroup = { ...group, lastMessage: null, memberCount: selectedMembers.length + 1 }
      setGroupChats(prev => [newGroup, ...prev])

      setShowCreateGroup(false)
      setNewGroupName('')
      setSelectedMembers([])
      setGroupMemberSearch('')
      setGroupMemberResults([])

      openGroupChat(newGroup)
    } catch (e) {
      console.error('createGroupChat:', e)
      alert('Fehler beim Erstellen. Bitte SQL-Schema prüfen (siehe Konsole).')
    }
    setCreatingGroup(false)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)    return 'Gerade'
    if (mins < 60)   return `${mins}m`
    if (mins < 1440) return `${Math.floor(mins / 60)}h`
    return `${Math.floor(mins / 1440)}d`
  }

  const inputStyle = {
    width: '100%', background: t.bg, border: `1px solid ${t.border}`,
    borderRadius: '8px', padding: '10px 12px', color: t.text,
    fontSize: '14px', boxSizing: 'border-box', fontFamily: "'Barlow', sans-serif", outline: 'none'
  }

  const SendBtn = ({ onPress }) => (
    <button onClick={onPress} disabled={!newMessage.trim()} className="btn-press" style={{
      background: newMessage.trim() ? '#3b82f6' : t.border, border: 'none',
      borderRadius: '50%', width: '40px', height: '40px',
      cursor: newMessage.trim() ? 'pointer' : 'default',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    </button>
  )

  // Combined sorted list (DMs + groups)
  const allConversations = [
    ...conversations.map(c  => ({ _type: 'dm',    ...c,  _sortTime: c.lastMessage?.created_at || 0 })),
    ...groupChats.map(g     => ({ _type: 'group', ...g,  _sortTime: g.lastMessage?.created_at || g.created_at || 0 })),
  ].sort((a, b) => new Date(b._sortTime) - new Date(a._sortTime))

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <p style={{ color: '#3b82f6' }}>Laden...</p>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP CHAT VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'groupchat' && activeGroup) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={() => { setView('list'); setActiveGroup(null); setGroupMessages([]) }} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '20px', padding: '0' }}>←</button>

        {/* Group avatar — rounded square with gradient */}
        <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', color: 'white', flexShrink: 0, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em' }}>
          {activeGroup.name?.slice(0, 2).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: '700', fontSize: '14px', color: t.text, fontFamily: "'Barlow', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeGroup.name}</p>
          <p style={{ fontSize: '11px', color: t.muted }}>{activeGroup.memberCount} Mitglieder</p>
        </div>

        {/* Stacked member avatars */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {groupMembers.slice(0, 4).map((m, i) => (
            <div key={m.profile?.id || i} style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#3b82f6', border: `2px solid ${t.surface}`, marginLeft: i > 0 ? '-7px' : '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: 'white', overflow: 'hidden', flexShrink: 0, zIndex: 4 - i }}>
              {m.profile?.avatar_url
                ? <img src={m.profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : m.profile?.username?.slice(0, 1).toUpperCase()}
            </div>
          ))}
          {groupMembers.length > 4 && (
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: t.border, border: `2px solid ${t.surface}`, marginLeft: '-7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700', color: t.muted, flexShrink: 0 }}>
              +{groupMembers.length - 4}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {groupMessages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: '36px', marginBottom: '8px' }}>👥</p>
            <p style={{ color: t.muted, fontSize: '13px' }}>Noch keine Nachrichten — fang an!</p>
          </div>
        )}
        {groupMessages.map((msg, idx) => {
          const isMe      = msg.sender_id === currentUser.id
          const prevMsg   = groupMessages[idx - 1]
          const showName  = !isMe && (prevMsg?.sender_id !== msg.sender_id)
          return (
            <div key={msg.id}>
              {showName && (
                <p style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1', marginLeft: '40px', marginBottom: '2px', fontFamily: "'Barlow', sans-serif" }}>
                  @{msg.sender?.username || '???'}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '6px' }}>
                {/* Sender avatar on left (only for others, only on last msg in chain) */}
                {!isMe && (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'white', overflow: 'hidden', flexShrink: 0, opacity: (groupMessages[idx + 1]?.sender_id !== msg.sender_id) ? 1 : 0 }}>
                    {msg.sender?.avatar_url
                      ? <img src={msg.sender.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      : msg.sender?.username?.slice(0, 1).toUpperCase() || '?'}
                  </div>
                )}
                <div style={{
                  maxWidth: '72%', padding: '10px 14px',
                  borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isMe ? '#3b82f6' : t.surface,
                  border: isMe ? 'none' : `1px solid ${t.border}`
                }}>
                  <p style={{ color: isMe ? 'white' : t.text, fontSize: '14px', lineHeight: '1.4', fontFamily: "'Barlow', sans-serif", wordBreak: 'break-word' }}>{msg.content}</p>
                  <p style={{ color: isMe ? 'rgba(255,255,255,0.55)' : t.muted, fontSize: '10px', marginTop: '4px', textAlign: 'right' }}>{formatTime(msg.created_at)}</p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, background: t.surface, display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendGroupMessage()} placeholder="Nachricht schreiben..." style={{ ...inputStyle, flex: 1 }} />
        <SendBtn onPress={sendGroupMessage} />
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // 1:1 CHAT VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'chat' && activeChat) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={() => { setView('list'); setActiveChat(null) }} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '20px', padding: '0' }}>←</button>
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: 'white', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
          {activeChat.avatar_url ? <img src={activeChat.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : activeChat.username?.slice(0, 2).toUpperCase()}
          {activeChat.is_online && <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '10px', height: '10px', borderRadius: '50%', background: '#4ade80', border: `2px solid ${t.surface}` }} />}
        </div>
        <div>
          <p style={{ fontWeight: '700', fontSize: '14px', color: t.text, fontFamily: "'Barlow', sans-serif" }}>@{activeChat.username}</p>
          <p style={{ fontSize: '11px', color: activeChat.is_online ? '#4ade80' : t.muted }}>{activeChat.is_online ? 'Online' : 'Offline'}</p>
        </div>
      </div>

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
              <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: isMe ? '#3b82f6' : t.surface, border: isMe ? 'none' : `1px solid ${t.border}` }}>
                <p style={{ color: isMe ? 'white' : t.text, fontSize: '14px', lineHeight: '1.4', fontFamily: "'Barlow', sans-serif" }}>{msg.content}</p>
                <p style={{ color: isMe ? 'rgba(255,255,255,0.6)' : t.muted, fontSize: '10px', marginTop: '4px', textAlign: 'right' }}>{formatTime(msg.created_at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, background: t.surface, display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Nachricht schreiben..." style={{ ...inputStyle, flex: 1 }} />
        <SendBtn onPress={sendMessage} />
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // REQUESTS VIEW
  // ══════════════════════════════════════════════════════════════════════════
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
      ) : requests.map(req => (
        <div key={req.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '16px', flexShrink: 0 }}>
            {req.sender?.username?.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: '700', fontSize: '14px', color: t.text }}>@{req.sender?.username}</p>
            <p style={{ color: t.muted, fontSize: '12px' }}>Möchte dir schreiben</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => acceptRequest(req)} className="btn-press" style={{ background: '#3b82f6', border: 'none', color: 'white', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Barlow', sans-serif", fontWeight: '600' }}>✓</button>
            <button onClick={() => declineRequest(req)} className="btn-press" style={{ background: 'transparent', border: '1px solid #f87171', color: '#f87171', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Barlow', sans-serif", fontWeight: '600' }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ flex: 1, background: t.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showSearch ? '12px' : '0' }}>
          <h2 style={{ color: t.text, fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>Nachrichten</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {requests.length > 0 && (
              <button onClick={() => setView('requests')} style={{ background: '#3b82f622', border: '1px solid #3b82f644', color: '#3b82f6', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Barlow', sans-serif", fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                {requests.length}
              </button>
            )}
            {/* Create group button */}
            <button onClick={() => setShowCreateGroup(true)} title="Gruppe erstellen" style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.muted, borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </button>
            {/* Search button */}
            <button onClick={() => setShowSearch(!showSearch)} style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.muted, borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="animate-slideUp">
            <input value={searchQuery} onChange={e => searchUsers(e.target.value)} placeholder="Nutzer suchen..." style={inputStyle} />
            {searchResults.length > 0 && (
              <div style={{ marginTop: '8px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                {searchResults.map(user => (
                  <div key={user.id} onClick={() => { openChat(user); setShowSearch(false); setSearchQuery('') }} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
                      {user.avatar_url ? <img src={user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="" /> : user.username?.slice(0, 2).toUpperCase()}
                      {user.is_online && <div style={{ position: 'absolute', bottom: '0', right: '0', width: '9px', height: '9px', borderRadius: '50%', background: '#4ade80', border: `2px solid ${t.bg}` }} />}
                    </div>
                    <div>
                      <p style={{ color: t.text, fontSize: '13px', fontWeight: '600', fontFamily: "'Barlow', sans-serif" }}>@{user.username}</p>
                      <p style={{ color: t.muted, fontSize: '11px' }}>{user.is_online ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />Online</span> : 'Offline'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversation list (DMs + Groups, sorted by last activity) */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {allConversations.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>💬</p>
            <p style={{ color: t.muted, fontSize: '14px', marginBottom: '8px' }}>Noch keine Nachrichten</p>
            <p style={{ color: t.muted, fontSize: '13px' }}>Suche nach Nutzern oder erstelle eine Gruppe</p>
          </div>
        ) : allConversations.map((item) => {

          // ── Group row ──────────────────────────────────────────────────────
          if (item._type === 'group') return (
            <div key={`group-${item.id}`} onClick={() => openGroupChat(item)} style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'background 0.15s' }}>
              {/* Rounded-square gradient avatar */}
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: '800', color: 'white', flexShrink: 0, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em' }}>
                {item.name?.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', alignItems: 'baseline' }}>
                  <p style={{ fontWeight: '700', fontSize: '14px', color: t.text, fontFamily: "'Barlow', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                    {item.name}
                  </p>
                  <p style={{ color: t.muted, fontSize: '11px', flexShrink: 0 }}>{formatTime(item.lastMessage?.created_at || item.created_at)}</p>
                </div>
                <p style={{ color: t.muted, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.lastMessage
                    ? (item.lastMessage.sender_id === currentUser?.id
                        ? `Du: ${item.lastMessage.content}`
                        : `${item.lastMessage.sender?.username}: ${item.lastMessage.content}`)
                    : `${item.memberCount} Mitglieder`}
                </p>
              </div>
              {/* Group badge */}
              <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#6366f118', border: '1px solid #6366f130', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
            </div>
          )

          // ── DM row ─────────────────────────────────────────────────────────
          const conv = item
          return (
            <div key={`dm-${conv.profile?.id}`} onClick={() => openChat(conv.profile)} style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: conv.unread ? '#3b82f60a' : 'transparent', transition: 'background 0.15s' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '16px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                {conv.profile?.avatar_url ? <img src={conv.profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : conv.profile?.username?.slice(0, 2).toUpperCase()}
                {conv.profile?.is_online && <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '12px', height: '12px', borderRadius: '50%', background: '#4ade80', border: `2px solid ${t.bg}` }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <p style={{ fontWeight: conv.unread ? '700' : '600', fontSize: '14px', color: t.text, fontFamily: "'Barlow', sans-serif" }}>@{conv.profile?.username}</p>
                  <p style={{ color: t.muted, fontSize: '11px', flexShrink: 0 }}>{formatTime(conv.lastMessage.created_at)}</p>
                </div>
                <p style={{ color: conv.unread ? t.text : t.muted, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: conv.unread ? '600' : '400' }}>
                  {conv.lastMessage.sender_id === currentUser.id ? 'Du: ' : ''}{conv.lastMessage.content}
                </p>
              </div>
              {conv.unread && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
            </div>
          )
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          CREATE GROUP BOTTOM SHEET
          ════════════════════════════════════════════════════════════════════ */}
      {showCreateGroup && (
        <div onClick={() => setShowCreateGroup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 3000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', background: t.surface, borderRadius: '20px 20px 0 0', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: t.border }} />
            </div>

            {/* Sheet header */}
            <div style={{ padding: '8px 16px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ color: t.text, fontSize: '20px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em' }}>GRUPPE ERSTELLEN</h3>
                <p style={{ color: t.muted, fontSize: '12px', marginTop: '2px' }}>Gib einen Namen ein und füge Mitglieder hinzu</p>
              </div>
              <button onClick={() => setShowCreateGroup(false)} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: t.muted, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
              {/* Group name */}
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: t.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Gruppenname</label>
              <input
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                placeholder="z.B. Sonntagsfahrer, Alpenrunde…"
                style={{ ...inputStyle, fontSize: '16px', fontWeight: '600', marginBottom: '24px' }}
                autoFocus
              />

              {/* Member picker */}
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: t.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Mitglieder hinzufügen</label>

              {/* Selected member chips */}
              {selectedMembers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {selectedMembers.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#3b82f618', border: '1px solid #3b82f638', borderRadius: '20px', padding: '4px 8px 4px 5px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                        {m.avatar_url ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : m.username?.slice(0, 1).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600', fontFamily: "'Barlow', sans-serif" }}>@{m.username}</span>
                      <button onClick={() => removeMember(m.id)} style={{ background: 'none', border: 'none', color: '#3b82f680', cursor: 'pointer', padding: '0 0 0 2px', fontSize: '15px', lineHeight: 1, display: 'flex', alignItems: 'center' }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Member search input */}
              <input
                value={groupMemberSearch}
                onChange={e => searchForGroupMember(e.target.value)}
                placeholder="Nutzernamen suchen…"
                style={{ ...inputStyle, marginBottom: '8px' }}
              />

              {/* Search results */}
              {groupMemberResults.length > 0 && (
                <div style={{ border: `1px solid ${t.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                  {groupMemberResults.map((user, idx) => (
                    <div key={user.id} onClick={() => addMember(user)} style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderBottom: idx < groupMemberResults.length - 1 ? `1px solid ${t.border}` : 'none', background: 'transparent', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = t.bg}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px', overflow: 'hidden', flexShrink: 0 }}>
                        {user.avatar_url ? <img src={user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="" /> : user.username?.slice(0, 2).toUpperCase()}
                      </div>
                      <p style={{ flex: 1, color: t.text, fontSize: '14px', fontWeight: '600', fontFamily: "'Barlow', sans-serif" }}>@{user.username}</p>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create button */}
            <div style={{ padding: '12px 16px 32px', borderTop: `1px solid ${t.border}` }}>
              <button
                onClick={createGroupChat}
                disabled={!newGroupName.trim() || selectedMembers.length === 0 || creatingGroup}
                style={{
                  width: '100%', padding: '15px',
                  background: (!newGroupName.trim() || selectedMembers.length === 0)
                    ? t.border
                    : 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
                  border: 'none', borderRadius: '12px',
                  color: (!newGroupName.trim() || selectedMembers.length === 0) ? t.muted : 'white',
                  fontSize: '15px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif",
                  letterSpacing: '0.06em', cursor: (!newGroupName.trim() || selectedMembers.length === 0) ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s'
                }}
              >
                {creatingGroup
                  ? 'WIRD ERSTELLT…'
                  : selectedMembers.length > 0
                    ? `GRUPPE ERSTELLEN  ·  ${selectedMembers.length + 1} MITGLIEDER`
                    : 'GRUPPE ERSTELLEN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
