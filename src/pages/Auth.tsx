import { useState } from 'react'
import { supabase } from '../lib/supabase'

function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async () => {
    setMessage('')
    setLoading(true)

    if (!email || !password) {
      setMessage('Введите email и пароль')
      setLoading(false)
      return
    }

    if (!isLogin && !username) {
      setMessage('Введите имя игрока')
      setLoading(false)
      return
    }

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage(error.message)
      } else {
        window.location.href = '/'
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      if (data.user) {
  setMessage(
    'Регистрация успешна! Теперь войдите в аккаунт.'
  )
  setIsLogin(true)
  setPassword('')
}
    }

    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo">⚓ BATTLESHIP ARENA</div>

        <h1>{isLogin ? 'ВХОД' : 'РЕГИСТРАЦИЯ'}</h1>

        {!isLogin && (
          <input
            type="text"
            placeholder="Имя игрока"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="primary-button"
          onClick={handleAuth}
          disabled={loading}
        >
          {loading
            ? 'Загрузка...'
            : isLogin
              ? 'Войти'
              : 'Создать аккаунт'}
        </button>

        {message && <p className="auth-message">{message}</p>}

        <button
          className="auth-switch"
          onClick={() => {
            setIsLogin(!isLogin)
            setMessage('')
          }}
        >
          {isLogin
            ? 'Нет аккаунта? Зарегистрироваться'
            : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </div>
  )
}

export default Auth