import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Game = {
  difficulty: string
  result: string
}

function Trainer() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGames()
  }, [])

  const loadGames = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/auth'
      return
    }

    const { data, error } = await supabase
      .from('games')
      .select('difficulty, result')
      .eq('player_id', user.id)

    if (error) {
      console.error('Ошибка загрузки игр:', error.message)
    } else {
      setGames(data || [])
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-card">
          <div className="logo">⚓ BATTLESHIP ARENA</div>
          <h1>АНАЛИЗ...</h1>
        </div>
      </div>
    )
  }

  const wins = games.filter((game) => game.result === 'win').length
  const losses = games.filter((game) => game.result === 'loss').length
  const total = wins + losses

  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

  const hardGames = games.filter(
    (game) => game.difficulty === 'hard'
  ).length

  const hardWins = games.filter(
    (game) =>
      game.difficulty === 'hard' && game.result === 'win'
  ).length

  const hardWinRate =
    hardGames > 0
      ? Math.round((hardWins / hardGames) * 100)
      : 0

  let recommendation =
    'Сыграй несколько матчей, чтобы Trainer смог проанализировать твою игру.'

  if (total >= 3 && winRate < 50) {
    recommendation =
      'Попробуй сначала тщательно искать корабли противника, а после попадания переключаться в режим Target и проверять соседние клетки.'
  }

  if (total >= 3 && winRate >= 50) {
    recommendation =
      'Хороший результат! Продолжай менять направления атак и не стреляй повторно в уже проверенные клетки.'
  }

  if (hardGames >= 2 && hardWinRate < 50) {
    recommendation =
      'На сложном уровне используй стратегию вероятностей: после нескольких промахов сосредоточь атаки на областях, где ещё могут находиться корабли.'
  }

  if (hardGames >= 2 && hardWinRate >= 50) {
    recommendation =
      'Ты уверенно играешь на сложном уровне. Попробуй улучшать эффективность первых ходов и быстрее переключаться из Hunt в Target после попадания.'
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="logo">⚓ BATTLESHIP ARENA</div>

        <h1>🧠 TRAINER</h1>

        <p className="description">
          Персональный анализ твоих матчей
        </p>

        <div className="profile-stats">
          <div className="stat-card">
            <span>🎮</span>
            <strong>{total}</strong>
            <small>Всего игр</small>
          </div>

          <div className="stat-card">
            <span>🏆</span>
            <strong>{wins}</strong>
            <small>Победы</small>
          </div>

          <div className="stat-card">
            <span>📈</span>
            <strong>{winRate}%</strong>
            <small>Win Rate</small>
          </div>

          <div className="stat-card">
            <span>🔴</span>
            <strong>{hardWinRate}%</strong>
            <small>Win Rate Hard</small>
          </div>
        </div>

        <div className="trainer-advice">
          <h2>💡 Рекомендация</h2>

          <p>{recommendation}</p>
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

export default Trainer