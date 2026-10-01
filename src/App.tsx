import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Game from './pages/Game'
import Auth from './pages/Auth'
import Profile from './pages/Profile'
import History from './pages/History'
import Stats from './pages/Stats'
import Trainer from './pages/Trainer'
import Multiplayer from './pages/Multiplayer'
import Leaderboard from './pages/Leaderboard'

function Home() {
  return (
    <div className="app">
      <header className="header">
        <div className="logo">⚓ BATTLESHIP ARENA</div>

        <nav>
          <button>Главная</button>

          <button
            onClick={() => {
              window.location.href = '/stats'
            }}
          >
            📊 Статистика
          </button>

          <button
            onClick={() => {
              window.location.href = '/leaderboard'
            }}
          >
            🏆 Лидерборд
          </button>

          <button
            onClick={() => {
              window.location.href = '/trainer'
            }}
          >
            🧠 Тренер
          </button>

          <button
            onClick={() => {
              window.location.href = '/history'
            }}
          >
            📜 История
          </button>

          <button
            onClick={() => {
              window.location.href = '/profile'
            }}
          >
            👤 Профиль
          </button>
        </nav>
      </header>

      <main className="hero">
        <div className="hero-content">
          <p className="eyebrow">МОРСКОЙ БОЙ</p>

          <h1>
            КОМАНДУЙ
            <br />
            СВОИМ ФЛОТОМ
          </h1>

          <p className="description">
            Расставь свои корабли, разработай стратегию,
            уничтожь флот противника и стань настоящим
            командиром.
          </p>

          <div className="buttons">
            <button
              className="primary-button"
              onClick={() => {
                window.location.href = '/game'
              }}
            >
              ⚔️ Играть против компьютера
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                window.location.href = '/multiplayer'
              }}
            >
              🌐 Мультиплеер
            </button>
          </div>
        </div>

        <div className="hero-board">
          <div className="board-title">ВАШ ФЛОТ</div>

          <div className="board">
            {Array.from({ length: 100 }).map((_, index) => (
              <div className="cell" key={index}></div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/history" element={<History />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/trainer" element={<Trainer />} />
        <Route path="/multiplayer" element={<Multiplayer />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App