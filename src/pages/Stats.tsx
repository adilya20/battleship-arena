import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Profile = {
  username: string
  rating: number
  wins: number
  losses: number
}

function Stats() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
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
      console.error('Ошибка загрузки статистики:', error.message)
    } else {
      setProfile(data)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-card">
          <div className="logo">⚓ BATTLESHIP ARENA</div>
          <h1>ЗАГРУЗКА...</h1>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <div className="profile-card">
          <div className="logo">⚓ BATTLESHIP ARENA</div>
          <h1>СТАТИСТИКА НЕ НАЙДЕНА</h1>
        </div>
      </div>
    )
  }

  const totalGames = profile.wins + profile.losses

  const winRate =
    totalGames > 0
      ? Math.round((profile.wins / totalGames) * 100)
      : 0

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="logo">⚓ BATTLESHIP ARENA</div>

        <h1>СТАТИСТИКА</h1>

        <p className="description">
          Игрок: <strong>{profile.username}</strong>
        </p>

        <div className="profile-stats">
          <div className="stat-card">
            <span>⭐</span>
            <strong>{profile.rating}</strong>
            <small>Рейтинг</small>
          </div>

          <div className="stat-card">
            <span>🏆</span>
            <strong>{profile.wins}</strong>
            <small>Победы</small>
          </div>

          <div className="stat-card">
            <span>💥</span>
            <strong>{profile.losses}</strong>
            <small>Поражения</small>
          </div>

          <div className="stat-card">
            <span>🎮</span>
            <strong>{totalGames}</strong>
            <small>Всего игр</small>
          </div>

          <div className="stat-card">
            <span>📈</span>
            <strong>{winRate}%</strong>
            <small>Процент побед</small>
          </div>
        </div>

        <button
          className="secondary-button"
          onClick={() => {
            window.location.href = '/'
          }}
        >
          ← На главную
        </button>
      </div>
    </div>
  )
}

export default Stats