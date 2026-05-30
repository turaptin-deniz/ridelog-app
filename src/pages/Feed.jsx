import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import RouteDetail from '../components/RouteDetail'

const isVideoUrl = url => url && /\.(mp4|mov|webm)/i.test(url)

function formatTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Gerade'
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

// ── PostCard ─────────────────────────────────────────────────────────────────
function PostCard({ post, t, onLike, onComment, onRepost, onProfileClick }) {
  const [slideIdx, setSlideIdx] = useState(0)
  const photos = post.photos || []
  const hasMedia = photos.length > 0
  const displayName = post.profiles?.display_name || post.profiles?.username || '??'

  const ActionBtn = ({ onClick, active, activeColor, children, count }) => (
    <button
      onClick={onClick}
      className="btn-press"
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '5px',
        color: active ? activeColor : t.muted,
        fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '600',
        padding: '7px 10px', borderRadius: '50px', transition: 'all 0.15s',
        minWidth: '44px'
      }}
    >
      {children}
      {count > 0 && <span style={{ fontSize: '13px', lineHeight: 1 }}>{count}</span>}
    </button>
  )

  return (
    <div style={{ borderBottom: `1px solid ${t.border}`, padding: '14px 16px 10px' }} className="animate-fadeIn">
      <div style={{ display: 'flex', gap: '12px' }}>

        {/* ── Avatar ── */}
        <div style={{ flexShrink: 0 }}>
          <div
            onClick={() => onProfileClick?.(post.profiles?.id)}
            style={{
              width: '46px', height: '46px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', fontWeight: '800', color: 'white',
              overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
              fontFamily: "'Barlow Condensed', sans-serif"
            }}
          >
            {post.profiles?.avatar_url
              ? <img src={post.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : displayName.slice(0, 2).toUpperCase()}
          </div>
        </div>

        {/* ── Content column ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Header: Displayname · @handle · Zeit · ··· */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '5px', flexWrap: 'wrap' }}>
            <span
              onClick={() => onProfileClick?.(post.profiles?.id)}
              style={{ fontWeight: '700', fontSize: '15px', color: t.text, fontFamily: "'Barlow', sans-serif", cursor: 'pointer', lineHeight: 1.2 }}
            >
              {displayName}
            </span>
            <span style={{ color: t.muted, fontSize: '13px', fontFamily: "'Barlow', sans-serif" }}>
              @{post.profiles?.username}
            </span>
            <span style={{ color: t.muted, fontSize: '13px' }}>·</span>
            <span style={{ color: t.muted, fontSize: '13px', fontFamily: "'Barlow', sans-serif" }}>
              {formatTime(post.created_at)}
            </span>
            <button style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '17px', marginLeft: 'auto', padding: '0 4px', lineHeight: 1 }}>···</button>
          </div>

          {/* Text-Content */}
          {post.content && (
            <p style={{
              fontSize: '15px', lineHeight: '1.55', color: t.text,
              fontFamily: "'Barlow', sans-serif",
              marginBottom: hasMedia ? '12px' : '0',
              wordBreak: 'break-word'
            }}>
              {post.content}
            </p>
          )}

          {/* Media carousel */}
          {hasMedia && (
            <div style={{ position: 'relative', background: '#000', borderRadius: '14px', overflow: 'hidden', marginTop: post.content ? '12px' : '4px' }}>
              {isVideoUrl(photos[slideIdx])
                ? <video src={photos[slideIdx]} controls style={{ width: '100%', maxHeight: '380px', objectFit: 'cover', display: 'block' }} />
                : <img src={photos[slideIdx]} alt="" style={{ width: '100%', maxHeight: '380px', objectFit: 'cover', display: 'block' }} />
              }
              {photos.length > 1 && slideIdx > 0 && (
                <button onClick={() => setSlideIdx(i => i - 1)} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
              )}
              {photos.length > 1 && slideIdx < photos.length - 1 && (
                <button onClick={() => setSlideIdx(i => i + 1)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              )}
              {photos.length > 1 && (
                <>
                  <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px', alignItems: 'center' }}>
                    {photos.map((_, i) => (
                      <div key={i} onClick={() => setSlideIdx(i)} style={{ height: '5px', width: i === slideIdx ? '16px' : '5px', borderRadius: '3px', background: i === slideIdx ? 'white' : 'rgba(255,255,255,0.45)', transition: 'width 0.2s ease', cursor: 'pointer' }} />
                    ))}
                  </div>
                  <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, color: 'white', fontFamily: "'Barlow', sans-serif" }}>
                    {slideIdx + 1} / {photos.length}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Action Bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', marginLeft: '-10px', gap: '0' }}>
            {/* Kommentar */}
            <ActionBtn onClick={() => onComment(post)} count={post.comment_count}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </ActionBtn>

            {/* Repost */}
            <ActionBtn onClick={() => onRepost(post)} active={post.reposted} activeColor="#22c55e" count={post.repost_count}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </ActionBtn>

            {/* Like */}
            <ActionBtn onClick={() => onLike(post)} active={post.liked} activeColor="#f43f5e" count={post.like_count}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={post.liked ? '#f43f5e' : 'none'} stroke={post.liked ? '#f43f5e' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </ActionBtn>

            {/* Teilen */}
            <button className="btn-press" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: t.muted, padding: '7px 10px', borderRadius: '50px', marginLeft: 'auto' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Feed ─────────────────────────────────────────────────────────────────────
export default function Feed({ darkMode, onSelectUser }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const [posts, setPosts]                   = useState([])
  const [loading, setLoading]               = useState(true)
  const [showCreate, setShowCreate]         = useState(false)
  const [newPost, setNewPost]               = useState({ content: '' })
  const [selectedFile, setSelectedFile]     = useState(null)
  const [preview, setPreview]               = useState(null)
  const [uploading, setUploading]           = useState(false)
  const [activeTab, setActiveTab]           = useState('foryou')
  const [nearbyMeetups, setNearbyMeetups]   = useState([])
  const [loadingMeetups, setLoadingMeetups] = useState(false)
  const [userLocation, setUserLocation]     = useState(null)
  const [locationError, setLocationError]   = useState('')
  const [selectedMeetup, setSelectedMeetup] = useState(null)
  const [currentUser, setCurrentUser]       = useState(null)

  // ── Comments bottom sheet ─────────────────────────────────────────────────
  const [activeComments, setActiveComments] = useState(null) // post object
  const [comments, setComments]             = useState([])
  const [newComment, setNewComment]         = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [sheetVisible, setSheetVisible]     = useState(false) // for slide-in animation

  const fileRef        = useRef()
  const commentsEndRef = useRef()
  const commentInputRef = useRef()

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    loadPosts(user.id)
  }

  const distanceKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371, toRad = d => d * Math.PI / 180
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(a))
  }

  const loadMeetups = async (location) => {
    setLoadingMeetups(true)
    let collected = []
    try {
      const { data, error } = await supabase.from('meetups').select('*, profiles(username, avatar_url)').gte('meetup_at', new Date().toISOString())
      if (!error && data) {
        collected = collected.concat(data.map(m => ({ id: m.id, source: 'meetups', title: m.title, meetup_at: m.meetup_at, location: m.location, lat: m.lat, lng: m.lng, description: m.description, max_participants: m.max_participants, stops: m.waypoints || [{ address: m.location, lat: m.lat, lng: m.lng }], profile: m.profiles, owner_id: m.user_id })))
      }
    } catch { /* table missing */ }
    const { data: routeRows } = await supabase.from('routes').select('*, profiles(username, avatar_url)').like('title', '[MEETUP]%')
    if (routeRows) {
      collected = collected.concat(routeRows.map(r => {
        const wps = r.waypoints || [], meetupWp = wps.find(w => w.type === 'meetup') || wps[0] || {}
        return { id: r.id, source: 'routes', title: r.title.replace(/^\[MEETUP\]\s*/, ''), meetup_at: meetupWp.meetup_at, location: meetupWp.address, lat: meetupWp.lat, lng: meetupWp.lng, description: meetupWp.description, max_participants: meetupWp.max_participants, stops: wps, profile: r.profiles, owner_id: r.user_id }
      }).filter(m => m.meetup_at && new Date(m.meetup_at) >= new Date()))
    }
    if (location && collected.length) {
      collected = collected.filter(m => typeof m.lat === 'number' && typeof m.lng === 'number').map(m => ({ ...m, distance: distanceKm(location.lat, location.lng, m.lat, m.lng) })).sort((a, b) => a.distance - b.distance)
    } else {
      collected.sort((a, b) => new Date(a.meetup_at) - new Date(b.meetup_at))
    }
    setNearbyMeetups(collected)
    setLoadingMeetups(false)
  }

  const requestLocation = () => {
    setLocationError('')
    if (!navigator.geolocation) { setLocationError('Geolokation nicht verfügbar.'); loadMeetups(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => { const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setUserLocation(loc); loadMeetups(loc) },
      () => { setLocationError('Kein Standort — Touren nach Datum sortiert.'); loadMeetups(null) },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    )
  }

  useEffect(() => { init() }, [])
  useEffect(() => {
    if (commentsEndRef.current) commentsEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [comments])
  useEffect(() => {
    if (activeTab === 'nearby' && nearbyMeetups.length === 0 && !loadingMeetups) {
      if (userLocation) loadMeetups(userLocation); else requestLocation()
    }
  }, [activeTab])

  const loadPosts = async (userId) => {
    const { data } = await supabase.from('posts').select('*, profiles(id, username, avatar_url)').order('created_at', { ascending: false })
    if (data) {
      const withMeta = await Promise.all(data.map(async (post) => {
        const [{ data: like }, { data: repost }, { count: likeCount }, { count: commentCount }, { count: repostCount }] = await Promise.all([
          supabase.from('likes').select('id').eq('user_id', userId).eq('post_id', post.id).single(),
          supabase.from('reposts').select('id').eq('user_id', userId).eq('post_id', post.id).single(),
          supabase.from('likes').select('id', { count: 'exact' }).eq('post_id', post.id),
          supabase.from('comments').select('id', { count: 'exact' }).eq('post_id', post.id),
          supabase.from('reposts').select('id', { count: 'exact' }).eq('post_id', post.id),
        ])
        return { ...post, liked: !!like, reposted: !!repost, like_count: likeCount || 0, comment_count: commentCount || 0, repost_count: repostCount || 0 }
      }))
      setPosts(withMeta)
    }
    setLoading(false)
  }

  const toggleLike = async (post) => {
    if (!currentUser) return
    if (post.liked) {
      await supabase.from('likes').delete().eq('user_id', currentUser.id).eq('post_id', post.id)
    } else {
      await supabase.from('likes').insert({ user_id: currentUser.id, post_id: post.id })
      // Notify post author (not self)
      if (post.profiles?.id && post.profiles.id !== currentUser.id) {
        supabase.from('notifications').insert({ recipient_id: post.profiles.id, sender_id: currentUser.id, type: 'like', post_id: post.id }).then(() => {})
      }
    }
    setPosts(posts.map(p => p.id === post.id ? { ...p, liked: !p.liked, like_count: p.like_count + (p.liked ? -1 : 1) } : p))
  }

  const toggleRepost = async (post) => {
    if (!currentUser) return
    if (post.reposted) { await supabase.from('reposts').delete().eq('user_id', currentUser.id).eq('post_id', post.id) }
    else { await supabase.from('reposts').insert({ user_id: currentUser.id, post_id: post.id }) }
    setPosts(posts.map(p => p.id === post.id ? { ...p, reposted: !p.reposted, repost_count: p.repost_count + (p.reposted ? -1 : 1) } : p))
    window.dispatchEvent(new CustomEvent('ridelog:repost-changed'))
  }

  // ── Open comment sheet ────────────────────────────────────────────────────
  const openComments = async (post) => {
    setActiveComments(post)
    setSheetVisible(false)
    setLoadingComments(true)
    setComments([])
    setNewComment('')
    // Animate in after a tick
    requestAnimationFrame(() => requestAnimationFrame(() => setSheetVisible(true)))
    const { data } = await supabase.from('comments')
      .select('*, profiles(id, username, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setLoadingComments(false)
  }

  const closeComments = () => {
    setSheetVisible(false)
    setTimeout(() => { setActiveComments(null); setComments([]) }, 280)
  }

  const sendComment = async () => {
    if (!newComment.trim() || !activeComments) return
    const { data } = await supabase.from('comments').insert({
      user_id: currentUser.id, post_id: activeComments.id, content: newComment.trim()
    }).select('*, profiles(id, username, avatar_url)').single()
    if (data) {
      setComments(prev => [...prev, data])
      setPosts(posts.map(p => p.id === activeComments.id ? { ...p, comment_count: p.comment_count + 1 } : p))
      setNewComment('')
      // Notify post author (not self)
      if (activeComments.profiles?.id && activeComments.profiles.id !== currentUser.id) {
        supabase.from('notifications').insert({ recipient_id: activeComments.profiles.id, sender_id: currentUser.id, type: 'comment', post_id: activeComments.id }).then(() => {})
      }
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const createPost = async () => {
    if (!newPost.content && !selectedFile) return
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    let mediaUrl = null
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const bucket = selectedFile.type.startsWith('video') ? 'videos' : 'post-images'
      const { error } = await supabase.storage.from(bucket).upload(path, selectedFile)
      if (!error) { const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path); mediaUrl = urlData.publicUrl }
    }
    await supabase.from('posts').insert({ user_id: user.id, content: newPost.content, photos: mediaUrl ? [mediaUrl] : [] })
    setNewPost({ content: '' }); setSelectedFile(null); setPreview(null); setShowCreate(false); setUploading(false)
    loadPosts(user.id)
  }

  const filteredPosts = activeTab === 'foryou' ? posts : posts.filter(p => p.profiles?.id !== currentUser?.id)

  return (
    <div style={{ flex: 1, background: t.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
        {[{ id: 'foryou', label: 'Für dich' }, { id: 'following', label: 'Folge ich' }, { id: 'nearby', label: 'In der Nähe' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '14px 8px', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
            color: activeTab === tab.id ? 'var(--color-accent-primary)' : t.muted,
            cursor: 'pointer', fontSize: '13px', fontWeight: '700',
            fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'nearby' && (
          <NearbyMeetups t={t} loading={loadingMeetups} meetups={nearbyMeetups} userLocation={userLocation} locationError={locationError} onRetry={requestLocation} onSelect={setSelectedMeetup} />
        )}
        {selectedMeetup && <RouteDetail row={selectedMeetup} currentUser={currentUser} t={t} onClose={() => setSelectedMeetup(null)} />}

        {activeTab !== 'nearby' && (
          <>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
                <p style={{ color: '#3b82f6' }}>Laden...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: '40px', marginBottom: '12px' }}>🏍️</p>
                <p style={{ color: t.muted, fontSize: '14px', marginBottom: '8px' }}>Noch keine Posts</p>
                <p style={{ color: t.muted, fontSize: '13px' }}>Sei der Erste und teile deine Tour!</p>
              </div>
            ) : filteredPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                t={t}
                onLike={toggleLike}
                onComment={openComments}
                onRepost={toggleRepost}
                onProfileClick={onSelectUser}
              />
            ))}
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          KOMMENTARE — Instagram-Style Bottom Sheet
          ════════════════════════════════════════════════════════════════════ */}
      {activeComments && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeComments}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 2400,
              transition: 'opacity 0.28s ease',
              opacity: sheetVisible ? 1 : 0,
            }}
          />

          {/* Sheet */}
          <div
            style={{
              position: 'fixed', bottom: 0, left: '50%',
              transform: `translateX(-50%) translateY(${sheetVisible ? '0' : '100%'})`,
              width: '100%', maxWidth: '480px',
              height: '88vh',
              background: t.surface,
              borderRadius: '20px 20px 0 0',
              zIndex: 2500,
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
              transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
              willChange: 'transform',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: t.border }} />
            </div>

            {/* Header */}
            <div style={{ padding: '0 16px 12px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h3 style={{ color: t.text, fontSize: '16px', fontWeight: '800', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.04em', margin: 0 }}>
                KOMMENTARE
              </h3>
              <button onClick={closeComments} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', color: t.muted, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Original post preview */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '10px', alignItems: 'flex-start', flexShrink: 0, background: t.bg }}>
              <div
                onClick={() => { closeComments(); onSelectUser?.(activeComments.profiles?.id) }}
                style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '12px', flexShrink: 0, overflow: 'hidden', cursor: 'pointer' }}
              >
                {activeComments.profiles?.avatar_url
                  ? <img src={activeComments.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : activeComments.profiles?.username?.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  onClick={() => { closeComments(); onSelectUser?.(activeComments.profiles?.id) }}
                  style={{ fontWeight: '700', fontSize: '13px', color: t.text, cursor: 'pointer', fontFamily: "'Barlow', sans-serif" }}
                >
                  @{activeComments.profiles?.username}
                </span>
                {activeComments.content && (
                  <span style={{ fontSize: '13px', color: t.muted, fontFamily: "'Barlow', sans-serif", marginLeft: '6px' }}>
                    {activeComments.content.length > 80 ? activeComments.content.slice(0, 80) + '…' : activeComments.content}
                  </span>
                )}
              </div>
            </div>

            {/* Comments list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px' }}>
              {loadingComments ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ color: '#3b82f6', fontSize: '13px' }}>Laden...</p>
                </div>
              ) : comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: '32px', marginBottom: '8px' }}>💬</p>
                  <p style={{ color: t.muted, fontSize: '14px', fontWeight: '600', fontFamily: "'Barlow', sans-serif" }}>Noch keine Kommentare</p>
                  <p style={{ color: t.muted, fontSize: '12px', marginTop: '4px' }}>Schreib den ersten Kommentar!</p>
                </div>
              ) : comments.map((comment, idx) => (
                <div key={comment.id} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }} className="animate-fadeIn">
                  <div
                    onClick={() => { closeComments(); onSelectUser?.(comment.profiles?.id) }}
                    style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '11px', flexShrink: 0, overflow: 'hidden', cursor: 'pointer', alignSelf: 'flex-start' }}
                  >
                    {comment.profiles?.avatar_url
                      ? <img src={comment.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      : comment.profiles?.username?.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '14px', padding: '10px 13px' }}>
                      <p
                        onClick={() => { closeComments(); onSelectUser?.(comment.profiles?.id) }}
                        style={{ fontWeight: '700', fontSize: '12px', color: '#3b82f6', marginBottom: '3px', cursor: 'pointer', display: 'inline-block', fontFamily: "'Barlow', sans-serif" }}
                      >
                        @{comment.profiles?.username}
                      </p>
                      <p style={{ fontSize: '13px', color: t.text, lineHeight: '1.5', fontFamily: "'Barlow', sans-serif" }}>{comment.content}</p>
                    </div>
                    <p style={{ color: t.muted, fontSize: '11px', marginTop: '4px', marginLeft: '4px' }}>{formatTime(comment.created_at)}</p>
                  </div>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>

            {/* Comment input — fixed at bottom */}
            <div style={{ padding: '10px 16px 24px', borderTop: `1px solid ${t.border}`, background: t.surface, display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
              {/* Current user avatar */}
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                {currentUser?.email?.slice(0, 2).toUpperCase()}
              </div>
              <input
                ref={commentInputRef}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendComment()}
                placeholder="Kommentar hinzufügen…"
                style={{
                  flex: 1, background: t.bg, border: `1px solid ${t.border}`,
                  borderRadius: '20px', padding: '10px 16px', color: t.text,
                  fontSize: '13px', fontFamily: "'Barlow', sans-serif", outline: 'none',
                  transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = t.border}
              />
              <button
                onClick={sendComment}
                disabled={!newComment.trim()}
                style={{
                  background: newComment.trim() ? '#3b82f6' : t.border,
                  border: 'none', borderRadius: '50%', width: '38px', height: '38px',
                  cursor: newComment.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  transition: 'background 0.15s'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create Post Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} className="animate-fadeIn">
          <div style={{ background: t.surface, borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px', maxHeight: '85vh', overflowY: 'auto' }} className="animate-scaleIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: t.text, fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>NEUER POST</h3>
              <button onClick={() => { setShowCreate(false); setPreview(null); setSelectedFile(null) }} style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.muted, cursor: 'pointer', fontSize: '16px', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            {preview && (
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                {selectedFile?.type.startsWith('video')
                  ? <video src={preview} controls style={{ width: '100%', borderRadius: '10px', maxHeight: '220px', objectFit: 'cover' }} />
                  : <img src={preview} style={{ width: '100%', borderRadius: '10px', maxHeight: '220px', objectFit: 'cover' }} alt="" />}
                <button onClick={() => { setPreview(null); setSelectedFile(null) }} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' }}>✕</button>
              </div>
            )}
            {!preview && (
              <div onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${t.border}`, borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                <p style={{ color: t.muted, fontSize: '13px', fontWeight: '600', fontFamily: "'Barlow', sans-serif" }}>Foto oder Video hochladen</p>
                <p style={{ color: t.muted, fontSize: '11px', marginTop: '4px' }}>Tippe hier zum Auswählen</p>
              </div>
            )}
            <textarea value={newPost.content} onChange={e => setNewPost({...newPost, content: e.target.value})} placeholder="Was willst du teilen? 🏍️" rows={3} style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '12px', color: t.text, fontSize: '14px', resize: 'none', boxSizing: 'border-box', marginBottom: '16px', fontFamily: "'Barlow', sans-serif", lineHeight: '1.5', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowCreate(false); setPreview(null); setSelectedFile(null) }} style={{ flex: 1, background: 'transparent', border: `1px solid ${t.border}`, color: t.muted, borderRadius: '8px', padding: '12px', cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '600' }}>Abbrechen</button>
              <button onClick={createPost} disabled={uploading} className="btn-press" style={{ flex: 2, background: '#3b82f6', border: 'none', color: 'white', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontSize: '14px', fontFamily: "'Barlow', sans-serif", fontWeight: '700' }}>{uploading ? 'Hochladen...' : 'Posten'}</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileSelect} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Nearby Meetups ────────────────────────────────────────────────────────────
function NearbyMeetups({ t, loading, meetups, userLocation, locationError, onRetry, onSelect }) {
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
      <p style={{ color: 'var(--color-accent-primary)', fontFamily: "'Barlow', sans-serif" }}>Suche Touren in deiner Nähe…</p>
    </div>
  )
  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '12px', background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '12px', color: t.muted, fontFamily: "'Barlow', sans-serif" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={userLocation ? 'var(--color-accent-primary)' : t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <span style={{ flex: 1 }}>{userLocation ? 'Sortiert nach Distanz zu deinem Standort' : (locationError || 'Standort nicht freigegeben')}</span>
        {!userLocation && <button onClick={onRetry} style={{ background: 'var(--color-accent-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>Standort</button>}
      </div>
      {meetups.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <p style={{ color: t.muted, fontSize: '14px', marginBottom: '4px', fontFamily: "'Barlow', sans-serif" }}>Noch keine Touren in der Nähe</p>
          <p style={{ color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif" }}>Plane selbst eine über den Plus-Button!</p>
        </div>
      ) : meetups.map(m => <MeetupCard key={m.id} m={m} t={t} onClick={() => onSelect(m)} />)}
    </div>
  )
}

function MeetupCard({ m, t, onClick }) {
  const date = new Date(m.meetup_at)
  const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })
  const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const stopCount = m.stops?.length || 1
  return (
    <div onClick={onClick} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '14px', marginBottom: '10px', transition: 'all 0.15s', cursor: 'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = 'translateY(0)' }}
      className="animate-fadeIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px', color: t.text, margin: 0, lineHeight: 1.2, flex: 1 }}>{m.title}</h4>
        {typeof m.distance === 'number' && <span style={{ flexShrink: 0, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '50px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, color: 'var(--color-accent-primary)', fontFamily: "'Barlow', sans-serif" }}>{m.distance < 1 ? '<1 km' : `${Math.round(m.distance)} km`}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span style={{ fontWeight: 600, color: t.text }}>{dateStr}</span><span>·</span><span>{timeStr}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: m.description ? '8px' : '10px', color: t.muted, fontSize: '12px', fontFamily: "'Barlow', sans-serif" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style={{ flex: 1 }}>{m.location}</span>
        {stopCount > 1 && <span style={{ flexShrink: 0, background: 'rgba(0,217,255,0.12)', border: '1px solid rgba(0,217,255,0.25)', borderRadius: '50px', padding: '1px 7px', fontSize: '10px', fontWeight: 700, color: 'var(--color-accent-secondary)' }}>+{stopCount - 1} Stopps</span>}
      </div>
      {m.description && <p style={{ color: t.text, fontSize: '13px', lineHeight: 1.5, marginBottom: '10px', fontFamily: "'Barlow', sans-serif" }}>{m.description}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-accent-primary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 700 }}>
            {m.profile?.avatar_url ? <img src={m.profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : (m.profile?.username?.slice(0,2).toUpperCase() || '??')}
          </div>
          <span style={{ color: t.muted, fontSize: '11px', fontFamily: "'Barlow', sans-serif" }}>@{m.profile?.username || 'jemand'}</span>
          {m.max_participants && <span style={{ color: t.muted, fontSize: '11px', fontFamily: "'Barlow', sans-serif" }}>· max {m.max_participants}</span>}
        </div>
        <button onClick={e => { e.stopPropagation(); onClick?.() }} style={{ background: 'var(--color-accent-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>Details</button>
      </div>
    </div>
  )
}
