import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Game = {
  id: string
  difficulty: string
  result: string
  created_at: string
}

function History() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/auth'
      return
    }

    const { data, error } = await supabase
      .from('games')
      .select('id, difficulty, result, created_at')
      .eq('player_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Ошибка загрузки истории:', error.message)
    } else {
      setGames(data || [])
    }

    setLoading(false)
  }

  const getDifficultyName = (difficulty: string) => {
    if (difficulty === 'easy') return '🟢 Легко'
    if (difficulty === 'medium') return '🟡 Средне'
    if (difficulty === 'hard') return '🔴 Сложно'
    return difficulty
  }

  const getResultName = (result: string) => {
    if (result === 'win') return '🏆 Победа'
    if (result === 'loss') return '💥 Поражение'
    return result
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

  return (
    <div className="profile-page">
      <div className="profile-card history-card">
        <div className="logo">⚓ BATTLESHIP ARENA</div>

        <h1>ИСТОРИЯ ИГР</h1>

        {games.length === 0 ? (
          <p>У вас пока нет сыгранных матчей.</p>
        ) : (
          <div className="history-list">
            {games.map((game) => (
              <div className="history-item" key={game.id}>
                <div>
                  <strong>{getResultName(game.result)}</strong>
                  <small>{getDifficultyName(game.difficulty)}</small>
                </div>

                <span>
                  {new Date(game.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        )}

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

export default History