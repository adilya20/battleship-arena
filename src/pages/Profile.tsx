import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type ProfileData = {
  username: string
  rating: number
  wins: number
  losses: number
}

function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/auth'
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('username, rating, wins, losses')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error(error)
    } else {
      setProfile(data)
    }

    setLoading(false)
  }

  if (loading) {
    return <div className="profile-page">Загрузка...</div>
  }

  if (!profile) {
    return <div className="profile-page">Профиль не найден</div>
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="logo">⚓ BATTLESHIP ARENA</div>

        <h1>{profile.username}</h1>

        <div className="profile-stats">
          <div className="stat-card">
            <span>🏆</span>
            <strong>{profile.rating}</strong>
            <small>Рейтинг</small>
          </div>

          <div className="stat-card">
            <span>⚔️</span>
            <strong>{profile.wins}</strong>
            <small>Победы</small>
          </div>

          <div className="stat-card">
            <span>💥</span>
            <strong>{profile.losses}</strong>
            <small>Поражения</small>
          </div>
        </div>

        <button
          className="secondary-button"
          onClick={() => {
            window.location.href = '/'
          }}
        >
          ← На главную
          <button
  className="secondary-button"
  onClick={async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }}
>
  🚪 Выйти
</button>
        </button>
      </div>
    </div>
  )
}

export default Profile