import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function Multiplayer() {
  const [roomCode, setRoomCode] = useState('')
  const [roomId, setRoomId] = useState('')
  const [roomStatus, setRoomStatus] = useState('waiting')
  const [moves, setMoves] = useState<any[]>([])

  // Слушаем изменение статуса комнаты
  useEffect(() => {
    if (!roomCode) return

    const channel = supabase
      .channel(`room-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          setRoomStatus(payload.new.status)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomCode])

  // Слушаем новые ходы
  useEffect(() => {
    if (!roomId) return

    const channel = supabase
      .channel(`moves-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_moves',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMoves((previous) => [
            ...previous,
            payload.new,
          ])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  // Создание комнаты
  const createRoom = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/auth'
      return
    }

    const code = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()

    const {
      data: room,
      error,
    } = await supabase
      .from('rooms')
      .insert({
        code,
        host_id: user.id,
        status: 'waiting',
      })
      .select()
      .single()

    if (error) {
      console.error(
        'Ошибка создания комнаты:',
        error.message
      )
      return
    }

    setRoomId(room.id)
    setRoomCode(code)
    setRoomStatus('waiting')
    setMoves([])
  }

  // Подключение к комнате
  const joinRoom = async () => {
    const code =
      roomCode.trim().toUpperCase()

    if (!code) {
      alert('Введите код комнаты')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/auth'
      return
    }

    const {
      data: room,
      error,
    } = await supabase
      .from('rooms')
      .select(
        'id, host_id, guest_id, status'
      )
      .eq('code', code)
      .single()

    if (
      error ||
      !room
    ) {
      alert('Комната не найдена')
      return
    }

    if (
      room.host_id === user.id
    ) {
      setRoomId(room.id)
      setRoomCode(code)
      setRoomStatus(room.status)
      return
    }

    if (
      room.status !== 'waiting'
    ) {
      alert(
        'Эта комната уже занята'
      )
      return
    }

    const {
      error: updateError,
    } = await supabase
      .from('rooms')
      .update({
        guest_id: user.id,
        status: 'playing',
      })
      .eq('id', room.id)

    if (updateError) {
      console.error(
        'Ошибка подключения:',
        updateError.message
      )
      return
    }

    setRoomId(room.id)
    setRoomCode(code)
    setRoomStatus('playing')
    setMoves([])

    alert(
      '⚔️ Вы подключились к комнате!'
    )
  }

  return (
    <div className="game-page">
      <header className="header">
        <div className="logo">
          ⚓ BATTLESHIP ARENA
        </div>

        <div className="game-status">
          🌐 МУЛЬТИПЛЕЕР
        </div>
      </header>

      <main className="game-content">
        <div className="game-title">
          <p className="eyebrow">
            ONLINE MODE
          </p>

          <h1>
            МУЛЬТИПЛЕЕР
          </h1>

          <p>
            Создай комнату и пригласи
            соперника по коду.
          </p>
        </div>

        <div className="fleet-panel">
          <h2>
            🌐 ОНЛАЙН-КОМНАТА
          </h2>

          <button
            className="primary-button"
            onClick={createRoom}
          >
            ➕ СОЗДАТЬ КОМНАТУ
          </button>

          <div
            style={{
              marginTop: '20px',
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <input
              value={roomCode}
              onChange={(event) =>
                setRoomCode(
                  event.target.value
                )
              }
              placeholder="КОД КОМНАТЫ"
              maxLength={6}
              style={{
                flex: 1,
                minWidth: '180px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: '#0f172a',
                color: 'white',
                fontSize: '16px',
              }}
            />

            <button
              className="secondary-button"
              onClick={joinRoom}
            >
              ⚔️ ПОДКЛЮЧИТЬСЯ
            </button>
          </div>
        </div>

        {roomCode && (
          <div className="fleet-panel">
            <h2>
              🔑 КОД КОМНАТЫ
            </h2>

            <div
              style={{
                fontSize: '36px',
                fontWeight: 'bold',
                letterSpacing: '8px',
                textAlign: 'center',
                margin: '20px 0',
              }}
            >
              {roomCode}
            </div>

            <p
              style={{
                textAlign: 'center',
              }}
            >
              {roomStatus ===
              'waiting'
                ? '⏳ Ждём соперника...'
                : '⚔️ Соперник подключился!'}
            </p>

            {roomStatus ===
              'playing' && (
              <button
                className="primary-button"
                onClick={() => {
                  window.location.href =
                    `/game?room=${roomId}`
                }}
              >
                ⚔️ НАЧАТЬ БОЙ
              </button>
            )}
          </div>
        )}

        {moves.length > 0 && (
          <div className="fleet-panel">
            <h2>
              📡 ONLINE-СИНХРОНИЗАЦИЯ
            </h2>

            <p>
              Получено ходов:{' '}
              {moves.length}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default Multiplayer