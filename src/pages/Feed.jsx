import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function Feed({ darkMode }) {
  const t = darkMode ? {
    bg: '#0a0a0a', surface: '#111', border: '#1f1f1f', text: '#fff', muted: '#555'
  } : {
    bg: '#f5f5f5', surface: '#fff', border: '#e5e5e5', text: '#0a0a0a', muted: '#888'
  }

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newPost, setNewPost] = useState({ content: '' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('foryou')
  const [currentUser, setCurrentUser] = useState(null)
  const [activeComments, setActiveComments] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const fileRef = useRef()
  const commentsEndRef = useRef()

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    loadPosts(user.id)
  }

  useEffect(() => { init() }, [])
  useEffect(() => { if (commentsEndRef.current) commentsEndRef.current.scrollIntoView({ behavior: 'smooth' }) }, [comments])

  const loadPosts = async (userId) => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(id, username, avatar_url)')
      .order('created_at', { ascending: false })

    if (data) {
      const postsWithLikes = await Promise.all(data.map(async (post) => {
        const { data: like } = await supabase.from('likes')
          .select('id').eq('user_id', userId).eq('post_id', post.id).single()
        const { data: repost } = await supabase.from('reposts')
          .select('id').eq('user_id', userId).eq('post_id', post.id).single()
        const { count: likeCount } = await supabase.from('likes')
          .select('id', { count: 'exact' }).eq('post_id', post.id)
        const { count: commentCount } = await supabase.from('comments')
          .select('id', { count: 'exact' }).eq('post_id', post.id)
        const { count: repostCount } = await supabase.from('reposts')
          .select('id', { count: 'exact' }).eq('post_id', post.id)
        return {
          ...post,
          liked: !!like,
          reposted: !!repost,
          like_count: likeCount || 0,
          comment_count: commentCount || 0,
          repost_count: repostCount || 0,
        }
      }))
      setPosts(postsWithLikes)
    }
    setLoading(false)
  }

  const toggleLike = async (post) => {
    if (!currentUser) return
    if (post.liked) {
      await supabase.from('likes').delete().eq('user_id', currentUser.id).eq('post_id', post.id)
    } else {
      await supabase.from('likes').insert({ user_id: currentUser.id, post_id: post.id })
    }
    setPosts(posts.map(p => p.id === post.id ? {
      ...p, liked: !p.liked, like_count: p.like_count + (p.liked ? -1 : 1)
    } : p))
  }

  const toggleRepost = async (post) => {
    if (!currentUser) return
    if (post.reposted) {
      await supabase.from('reposts').delete().eq('user_id', currentUser.id).eq('post_id', post.id)
    } else {
      await supabase.from('reposts').insert({ user_id: currentUser.id, post_id: post.id })
    }
    setPosts(posts.map(p => p.id === post.id ? {
      ...p, reposted: !p.reposted, repost_count: p.repost_count + (p.reposted ? -1 : 1)
    } : p))
  }

  const openComments = async (post) => {
    setActiveComments(post)
    setLoadingComments(true)
    const { data } = await supabase.from('comments')
      .select('*, profiles(username, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setLoadingComments(false)
  }

  const sendComment = async () => {
    if (!newComment.trim() || !activeComments) return
    const { data } = await supabase.from('comments').insert({
      user_id: currentUser.id,
      post_id: activeComments.id,
      content: newComment.trim()
    }).select('*, profiles(username, avatar_url)').single()
    if (data) {
      setComments(prev => [...prev, data])
      setPosts(posts.map(p => p.id === activeComments.id ? { ...p, comment_count: p.comment_count + 1 } : p))
      setNewComment('')
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
      if (!error) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
        mediaUrl = urlData.publicUrl
      }
    }

    await supabase.from('posts').insert({
      user_id: user.id,
      content: newPost.content,
      photos: mediaUrl ? [mediaUrl] : [],
    })

    setNewPost({ content: '' })
    setSelectedFile(null)
    setPreview(null)
    setShowCreate(false)
    setUploading(false)
    loadPosts(user.id)
  }

  const formatTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Gerade'
    if (mins < 60) return `${mins}m`
    if (mins < 1440) return `${Math.floor(mins/60)}h`
    return `${Math.floor(mins/1440)}d`
  }

  const filteredPosts = activeTab === 'foryou' ? posts : posts.filter(p => p.profiles?.id !== currentUser?.id)

  // Comments Modal
  if (activeComments) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={() => setActiveComments(null)} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '20px' }}>←</button>
        <h3 style={{ color: t.text, fontSize: '16px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>Kommentare</h3>
      </div>

      {/* Original Post */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, background: t.surface }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px', flexShrink: 0, overflow: 'hidden' }}>
            {activeComments.profiles?.avatar_url
              ? <img src={activeComments.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : activeComments.profiles?.username?.slice(0,2).toUpperCase()}
          </div>
          <div>
            <p style={{ fontWeight: '700', fontSize: '13px', color: t.text }}>@{activeComments.profiles?.username}</p>
            <p style={{ fontSize: '13px', color: t.text, lineHeight: '1.5', marginTop: '2px' }}>{activeComments.content}</p>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loadingComments ? (
          <p style={{ color: t.muted, textAlign: 'center', padding: '20px' }}>Laden...</p>
        ) : comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: '28px', marginBottom: '8px' }}>💬</p>
            <p style={{ color: t.muted, fontSize: '13px' }}>Noch keine Kommentare</p>
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '11px', flexShrink: 0, overflow: 'hidden' }}>
                {comment.profiles?.avatar_url
                  ? <img src={comment.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : comment.profiles?.username?.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '10px 12px' }}>
                  <p style={{ fontWeight: '700', fontSize: '12px', color: '#6C63FF', marginBottom: '4px' }}>@{comment.profiles?.username}</p>
                  <p style={{ fontSize: '13px', color: t.text, lineHeight: '1.5' }}>{comment.content}</p>
                </div>
                <p style={{ color: t.muted, fontSize: '11px', marginTop: '4px', marginLeft: '4px' }}>{formatTime(comment.created_at)}</p>
              </div>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Comment Input */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, background: t.surface, display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
        <input
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendComment()}
          placeholder="Kommentar schreiben..."
          style={{
            flex: 1, background: t.bg, border: `1px solid ${t.border}`,
            borderRadius: '20px', padding: '10px 16px', color: t.text,
            fontSize: '13px', fontFamily: "'Barlow', sans-serif", outline: 'none'
          }}
        />
        <button onClick={sendComment} disabled={!newComment.trim()} style={{
          background: newComment.trim() ? '#6C63FF' : t.border,
          border: 'none', borderRadius: '50%', width: '38px', height: '38px',
          cursor: newComment.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, background: t.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
        {[{ id: 'foryou', label: 'Für dich' }, { id: 'following', label: 'Folge ich' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '14px', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid #6C63FF' : '2px solid transparent',
            color: activeTab === tab.id ? '#6C63FF' : t.muted,
            cursor: 'pointer', fontSize: '14px', fontWeight: '700',
            fontFamily: "'Barlow', sans-serif", transition: 'all 0.15s'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Posts */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
            <p style={{ color: '#6C63FF' }}>Laden...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>🏍️</p>
            <p style={{ color: t.muted, fontSize: '14px', marginBottom: '8px' }}>Noch keine Posts</p>
            <p style={{ color: t.muted, fontSize: '13px' }}>Sei der Erste und teile deine Tour!</p>
          </div>
        ) : (
          filteredPosts.map(post => (
            <div key={post.id} style={{ borderBottom: `1px solid ${t.border}` }} className="animate-fadeIn">

              {/* Post Header */}
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                  {post.profiles?.avatar_url
                    ? <img src={post.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : post.profiles?.username?.slice(0,2).toUpperCase() || '??'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '700', fontSize: '14px', color: t.text, fontFamily: "'Barlow', sans-serif" }}>@{post.profiles?.username}</p>
                  <p style={{ color: t.muted, fontSize: '11px' }}>{formatTime(post.created_at)}</p>
                </div>
                <button style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '18px' }}>···</button>
              </div>

              {/* Media */}
              {post.photos && post.photos.length > 0 && (
                <div style={{ width: '100%', maxHeight: '400px', overflow: 'hidden' }}>
                  {post.photos[0].includes('.mp4') || post.photos[0].includes('.mov') ? (
                    <video src={post.photos[0]} controls style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} />
                  ) : (
                    <img src={post.photos[0]} alt="Post" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} />
                  )}
                </div>
              )}

              {/* Content */}
              {post.content && (
                <div style={{ padding: '10px 16px' }}>
                  <p style={{ fontSize: '14px', lineHeight: '1.5', color: t.text, fontFamily: "'Barlow', sans-serif" }}>{post.content}</p>
                </div>
              )}

              {/* Actions */}
              <div style={{ padding: '8px 16px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>

                {/* Like */}
                <button onClick={() => toggleLike(post)} className="btn-press" style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  color: post.liked ? '#f43f5e' : t.muted,
                  fontSize: '13px', fontFamily: "'Barlow', sans-serif",
                  fontWeight: '600', padding: '8px 12px', borderRadius: '8px',
                  transition: 'all 0.15s'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={post.liked ? '#f43f5e' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  {post.like_count > 0 && post.like_count}
                </button>

                {/* Comment */}
                <button onClick={() => openComments(post)} className="btn-press" style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  color: t.muted, fontSize: '13px', fontFamily: "'Barlow', sans-serif",
                  fontWeight: '600', padding: '8px 12px', borderRadius: '8px',
                  transition: 'all 0.15s'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {post.comment_count > 0 && post.comment_count}
                </button>

                {/* Repost */}
                <button onClick={() => toggleRepost(post)} className="btn-press" style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  color: post.reposted ? '#4ade80' : t.muted,
                  fontSize: '13px', fontFamily: "'Barlow', sans-serif",
                  fontWeight: '600', padding: '8px 12px', borderRadius: '8px',
                  transition: 'all 0.15s'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                  {post.repost_count > 0 && post.repost_count}
                </button>

                {/* Share */}
                <button className="btn-press" style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  color: t.muted, padding: '8px 12px', borderRadius: '8px',
                  marginLeft: 'auto'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Post Button */}
      <button onClick={() => setShowCreate(true)} className="btn-press" style={{
        position: 'absolute', bottom: '70px', right: 'calc(50% - 224px)',
        background: '#6C63FF', border: 'none', borderRadius: '50%',
        width: '52px', height: '52px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(108,99,255,0.5)', zIndex: 100
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Create Post Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          className="animate-fadeIn">
          <div style={{ background: t.surface, borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px', maxHeight: '85vh', overflowY: 'auto' }}
            className="animate-scaleIn">

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: t.text, fontSize: '18px', fontWeight: '700', fontFamily: "'Barlow Condensed', sans-serif" }}>NEUER POST</h3>
              <button onClick={() => { setShowCreate(false); setPreview(null); setSelectedFile(null) }}
                style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.muted, cursor: 'pointer', fontSize: '16px', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {preview && (
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                {selectedFile?.type.startsWith('video') ? (
                  <video src={preview} controls style={{ width: '100%', borderRadius: '10px', maxHeight: '220px', objectFit: 'cover' }} />
                ) : (
                  <img src={preview} style={{ width: '100%', borderRadius: '10px', maxHeight: '220px', objectFit: 'cover' }} />
                )}
                <button onClick={() => { setPreview(null); setSelectedFile(null) }} style={{
                  position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)',
                  border: 'none', color: 'white', borderRadius: '50%', width: '28px', height: '28px',
                  cursor: 'pointer', fontSize: '14px'
                }}>✕</button>
              </div>
            )}

            {!preview && (
              <div onClick={() => fileRef.current.click()} style={{
                border: `2px dashed ${t.border}`, borderRadius: '10px',
                padding: '28px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p style={{ color: t.muted, fontSize: '13px', fontWeight: '600', fontFamily: "'Barlow', sans-serif" }}>Foto oder Video hochladen</p>
                <p style={{ color: t.muted, fontSize: '11px', marginTop: '4px' }}>Tippe hier zum Auswählen</p>
              </div>
            )}

            <textarea
              value={newPost.content}
              onChange={e => setNewPost({...newPost, content: e.target.value})}
              placeholder="Was willst du teilen? 🏍️"
              rows={3}
              style={{
                width: '100%', background: t.bg, border: `1px solid ${t.border}`,
                borderRadius: '8px', padding: '12px', color: t.text, fontSize: '14px',
                resize: 'none', boxSizing: 'border-box', marginBottom: '16px',
                fontFamily: "'Barlow', sans-serif", lineHeight: '1.5', outline: 'none'
              }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowCreate(false); setPreview(null); setSelectedFile(null) }} style={{
                flex: 1, background: 'transparent', border: `1px solid ${t.border}`,
                color: t.muted, borderRadius: '8px', padding: '12px',
                cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: '600'
              }}>Abbrechen</button>
              <button onClick={createPost} disabled={uploading} className="btn-press" style={{
                flex: 2, background: '#6C63FF', border: 'none', color: 'white',
                borderRadius: '8px', padding: '12px', cursor: 'pointer',
                fontSize: '14px', fontFamily: "'Barlow', sans-serif", fontWeight: '700'
              }}>{uploading ? 'Hochladen...' : 'Posten'}</button>
            </div>

            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
              onChange={handleFileSelect} />
          </div>
        </div>
      )}
    </div>
  )
}