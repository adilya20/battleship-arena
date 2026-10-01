import '../App.css'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Player = {
  id: string
  username: string
  rating: number
  wins: number
  losses: number
}

function Leaderboard() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  const loadLeaderboard = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/auth'
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, rating, wins, losses')
      .order('rating', { ascending: false })

    if (error) {
      console.error('Ошибка загрузки рейтинга:', error.message)
      setLoading(false)
      return
    }

    setPlayers(data || [])
    setLoading(false)
  }

  return (
    <main className="app">
      <nav>
        <button onClick={() => (window.location.href = '/')}>
          🏠 Главная
        </button>

        <button onClick={() => (window.location.href = '/profile')}>
          👤 Профиль
        </button>

        <button onClick={() => (window.location.href = '/stats')}>
          📊 Статистика
        </button>
      </nav>

      <section className="game-container">
        <h1>🏆 LEADERBOARD</h1>

        <p className="subtitle">
          Рейтинг капитанов Battleship Arena
        </p>

        {loading ? (
          <p>Загрузка рейтинга...</p>
        ) : players.length === 0 ? (
          <p>Пока нет игроков.</p>
        ) : (
          <div className="leaderboard">
            {players.map((player, index) => (
              <div className="leaderboard-row" key={player.id}>
                <div className="leaderboard-place">
                  {index === 0
                    ? '🥇'
                    : index === 1
                    ? '🥈'
                    : index === 2
                    ? '🥉'
                    : `${index + 1}.`}
                </div>

                <div className="leaderboard-player">
                  <strong>{player.username}</strong>
                  <span>
                    {player.wins} побед · {player.losses} поражений
                  </span>
                </div>

                <div className="leaderboard-rating">
                  ⭐ {player.rating}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default Leaderboard