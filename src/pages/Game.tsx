import '../App.css'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Ship = {
  id: string
  name: string
  size: number
}

const fleet: Ship[] = [
  { id: 'battleship', name: 'Линкор', size: 4 },
  { id: 'cruiser', name: 'Крейсер', size: 3 },
  { id: 'destroyer', name: 'Эсминец', size: 2 },
  { id: 'boat', name: 'Катер', size: 1 },
]

function Game() {
  const [roomId, setRoomId] = useState<string | null>(null)
  const [onlineMode, setOnlineMode] = useState(false)

  const [difficulty, setDifficulty] = useState<
    'easy' | 'medium' | 'hard'
  >('medium')

  const [gameStarted, setGameStarted] = useState(false)
  const [selectedShip, setSelectedShip] = useState<string | null>(null)

  const [placedShips, setPlacedShips] = useState<
    Record<string, number[]>
  >({})

  const [isVertical, setIsVertical] = useState(false)

  const [hoveredCell, setHoveredCell] = useState<number | null>(null)
  const [previewCells, setPreviewCells] = useState<number[]>([])
  const [previewValid, setPreviewValid] = useState(true)

  const [shots, setShots] = useState<number[]>([])
  const [computerShots, setComputerShots] = useState<number[]>([])
  const [onlineHits, setOnlineHits] = useState<number[]>([])

  const [isComputerThinking, setIsComputerThinking] = useState(false)

  const [message, setMessage] = useState(
    'Сначала расставь свой флот'
  )

  const [winner, setWinner] = useState<
    'player' | 'computer' | null
  >(null)

  const [computerShips, setComputerShips] = useState<number[]>([])

  // ==========================================
  // ОНЛАЙН-ХОД
  // ==========================================

  const [myTurn, setMyTurn] = useState(true)

  // Не даём отправить несколько pending-выстрелов подряд
  const pendingShotRef = useRef(false)

  // ==========================================
  // AI REFS
  // ==========================================

  const computerShotsRef = useRef<number[]>([])
  const computerHitsRef = useRef<number[]>([])

  const computerDirectionRef =
    useRef<'horizontal' | 'vertical' | null>(null)

  const resultSavedRef = useRef(false)

  // ==========================================
  // ВСЕ КЛЕТКИ НАШИХ КОРАБЛЕЙ
  // ==========================================

  const allPlayerShipCells = Object.values(placedShips).flat()

  // ==========================================
  // ПОЛУЧАЕМ ROOM ИЗ URL
  // ==========================================

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    )

    const room = params.get('room')

    if (room) {
      setRoomId(room)
      setOnlineMode(true)
    }
  }, [])

  // ==========================================
  // СОХРАНЕНИЕ КОРАБЛЕЙ ОНЛАЙН
  // ==========================================

  useEffect(() => {
    if (!roomId || !onlineMode) {
      return
    }

    const savedShips = localStorage.getItem(
      `battleship-ships-${roomId}`
    )

    if (!savedShips) {
      return
    }

    try {
      const parsedShips = JSON.parse(savedShips)

      if (
        parsedShips &&
        typeof parsedShips === 'object'
      ) {
        setPlacedShips(parsedShips)
      }
    } catch {
      localStorage.removeItem(
        `battleship-ships-${roomId}`
      )
    }
  }, [roomId, onlineMode])

  useEffect(() => {
    if (!roomId || !onlineMode) {
      return
    }

    localStorage.setItem(
      `battleship-ships-${roomId}`,
      JSON.stringify(placedShips)
    )
  }, [placedShips, roomId, onlineMode])

  // ==========================================
  // ОПРЕДЕЛЯЕМ, КТО ХОДИТ ПЕРВЫМ
  // HOST ХОДИТ ПЕРВЫМ
  // ==========================================

  useEffect(() => {
    if (!roomId || !onlineMode) {
      return
    }

    const loadRoomTurn = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return
      }

      const { data: room, error } = await supabase
        .from('rooms')
        .select('host_id, guest_id')
        .eq('id', roomId)
        .single()

      if (error || !room) {
        return
      }

      setMyTurn(room.host_id === user.id)
    }

    loadRoomTurn()
  }, [roomId, onlineMode])

  // ==========================================
  // СОХРАНЕНИЕ РЕЗУЛЬТАТА
  // ==========================================

  const saveGameResult = async (
    result: 'win' | 'loss'
  ) => {
    if (resultSavedRef.current) {
      return
    }

    resultSavedRef.current = true

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      resultSavedRef.current = false
      return
    }

    const gameDifficulty = onlineMode
      ? 'multiplayer'
      : difficulty

    const { error } = await supabase
      .from('games')
      .insert({
        player_id: user.id,
        difficulty: gameDifficulty,
        result,
      })

    if (error) {
      console.error(
        'Ошибка сохранения игры:',
        error.message
      )

      resultSavedRef.current = false
      return
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('wins, losses, rating')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return
    }

    if (result === 'win') {
      await supabase
        .from('profiles')
        .update({
          wins: profile.wins + 1,
          rating: profile.rating + 20,
        })
        .eq('id', user.id)
    } else {
      await supabase
        .from('profiles')
        .update({
          losses: profile.losses + 1,
          rating: Math.max(
            0,
            profile.rating - 10
          ),
        })
        .eq('id', user.id)
    }
  }

  // ==========================================
  // ОНЛАЙН REALTIME
  // ==========================================

  useEffect(() => {
    if (!roomId || !onlineMode) {
      return
    }

    const channel = supabase
      .channel(`online-game-${roomId}`)

      // ========================================
      // ПОЛУЧАЕМ ВЫСТРЕЛ СОПЕРНИКА
      // ========================================

      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_moves',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const move = payload.new as {
            id: string
            room_id: string
            player_id: string
            target_id: string
            row: number
            col: number
            result: string
          }

          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) {
            return
          }

          // Это наш собственный выстрел
          if (move.player_id === user.id) {
            return
          }

          // Этот выстрел направлен не в нас
          if (move.target_id !== user.id) {
            return
          }

          const index =
            move.row * 10 + move.col

          const playerShipCells =
            Object.values(placedShips).flat()

          const hit =
            playerShipCells.includes(index)

          const result = hit
            ? 'hit'
            : 'miss'

          const { error } = await supabase
            .from('room_moves')
            .update({
              result,
            })
            .eq('id', move.id)

          if (error) {
            console.error(
              'Ошибка обработки выстрела:',
              error.message
            )
            return
          }

          setComputerShots((previous) => {
            if (previous.includes(index)) {
              return previous
            }

            return [
              ...previous,
              index,
            ]
          })

          // ======================================
          // СОПЕРНИК ПОПАЛ
          // ======================================

          if (hit) {
            const currentShots =
              computerShotsRef.current

            if (!currentShots.includes(index)) {
              computerShotsRef.current = [
                ...currentShots,
                index,
              ]
            }

            const totalHits =
              computerShotsRef.current.filter(
                (cell) =>
                  playerShipCells.includes(cell)
              ).length

            if (
              totalHits >=
              playerShipCells.length
            ) {
              setWinner('computer')

              setMyTurn(false)

              setMessage(
                '💀 ПОРАЖЕНИЕ! Соперник уничтожил весь твой флот!'
              )

              saveGameResult('loss')
            } else {
              // При попадании соперник ходит ещё раз
              setMyTurn(false)

              setMessage(
                '💥 Соперник попал! Теперь его ход'
              )
            }
          } else {
            // При промахе соперника ход переходит к нам
            setMyTurn(true)

            setMessage(
              '💧 Соперник промахнулся! Твой ход'
            )
          }
        }
      )

      // ========================================
      // ПОЛУЧАЕМ РЕЗУЛЬТАТ НАШЕГО ВЫСТРЕЛА
      // ========================================

      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_moves',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const move = payload.new as {
            id: string
            player_id: string
            row: number
            col: number
            result: string
          }

          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) {
            return
          }

          // Обрабатываем только наш выстрел
          if (move.player_id !== user.id) {
            return
          }

          // Результат ещё не готов
          if (move.result === 'pending') {
            return
          }

          const index =
            move.row * 10 + move.col

          pendingShotRef.current = false

          setShots((previous) => {
            if (previous.includes(index)) {
              return previous
            }

            return [
              ...previous,
              index,
            ]
          })

          // ======================================
          // ПОПАДАНИЕ
          // ======================================

          if (move.result === 'hit') {
            setOnlineHits((previous) => {
              if (previous.includes(index)) {
                return previous
              }

              const newHits = [
                ...previous,
                index,
              ]

              if (newHits.length >= 10) {
                setWinner('player')
                setMyTurn(false)

                setMessage(
                  '🏆 ПОБЕДА! Ты уничтожил весь флот соперника!'
                )

                saveGameResult('win')
              }

              return newHits
            })

            if (onlineHits.length + 1 < 10) {
              // При попадании мы ходим ещё раз
              setMyTurn(true)

              setMessage(
                '💥 Попадание! Стреляй ещё раз'
              )
            }
          }

          // ======================================
          // ПРОМАХ
          // ======================================

          if (move.result === 'miss') {
            setMyTurn(false)

            setMessage(
              '💧 Промах! Теперь ход соперника'
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [
    roomId,
    onlineMode,
    placedShips,
  ])

  // ==========================================
  // РАССТАНОВКА КОРАБЛЕЙ
  // ==========================================

  const canPlaceShip = (
    startIndex: number,
    size: number,
    vertical: boolean,
    occupiedCells: number[]
  ) => {
    const row = Math.floor(startIndex / 10)
    const column = startIndex % 10

    const cells: number[] = []

    for (let i = 0; i < size; i++) {
      let cell: number

      if (vertical) {
        if (row + i >= 10) {
          return null
        }

        cell =
          startIndex + i * 10
      } else {
        if (column + i >= 10) {
          return null
        }

        cell = startIndex + i
      }

      cells.push(cell)
    }

    for (const cell of cells) {
      if (occupiedCells.includes(cell)) {
        return null
      }

      const cellRow =
        Math.floor(cell / 10)

      const cellColumn =
        cell % 10

      for (const occupied of occupiedCells) {
        const occupiedRow =
          Math.floor(occupied / 10)

        const occupiedColumn =
          occupied % 10

        const rowDifference =
          Math.abs(
            cellRow - occupiedRow
          )

        const columnDifference =
          Math.abs(
            cellColumn - occupiedColumn
          )

        if (
          rowDifference <= 1 &&
          columnDifference <= 1
        ) {
          return null
        }
      }
    }

    return cells
  }

  const calculateShipCells = (
    startIndex: number,
    size: number,
    vertical: boolean
  ) => {
    const row =
      Math.floor(startIndex / 10)

    const column =
      startIndex % 10

    const cells: number[] = []

    for (let i = 0; i < size; i++) {
      let cell: number

      if (vertical) {
        if (row + i >= 10) {
          return null
        }

        cell =
          startIndex + i * 10
      } else {
        if (column + i >= 10) {
          return null
        }

        cell =
          startIndex + i
      }

      cells.push(cell)
    }

    return cells
  }

  const generateComputerFleet = () => {
    const ships: number[] = []

    for (const ship of fleet) {
      let placed = false

      while (!placed) {
        const startIndex =
          Math.floor(
            Math.random() * 100
          )

        const vertical =
          Math.random() < 0.5

        const cells =
          canPlaceShip(
            startIndex,
            ship.size,
            vertical,
            ships
          )

        if (cells) {
          ships.push(...cells)
          placed = true
        }
      }
    }

    return ships
  }

  const isTouchingExistingShip = (
    cell: number,
    currentShipCells: number[]
  ) => {
    const row =
      Math.floor(cell / 10)

    const column =
      cell % 10

    for (
      const existingCell of allPlayerShipCells
    ) {
      if (
        currentShipCells.includes(
          existingCell
        )
      ) {
        continue
      }

      const existingRow =
        Math.floor(
          existingCell / 10
        )

      const existingColumn =
        existingCell % 10

      const rowDifference =
        Math.abs(
          row - existingRow
        )

      const columnDifference =
        Math.abs(
          column - existingColumn
        )

      if (
        rowDifference <= 1 &&
        columnDifference <= 1
      ) {
        return true
      }
    }

    return false
  }

  const checkPlacement = (
    startIndex: number,
    ship: Ship
  ) => {
    const cells =
      calculateShipCells(
        startIndex,
        ship.size,
        isVertical
      )

    if (!cells) {
      return {
        cells: [],
        valid: false,
      }
    }

    const hasOverlap =
      cells.some((cell) =>
        allPlayerShipCells.includes(
          cell
        )
      )

    if (hasOverlap) {
      return {
        cells,
        valid: false,
      }
    }

    const touchesAnotherShip =
      cells.some((cell) =>
        isTouchingExistingShip(
          cell,
          cells
        )
      )

    if (touchesAnotherShip) {
      return {
        cells,
        valid: false,
      }
    }

    return {
      cells,
      valid: true,
    }
  }

  const updatePreview = (
    index: number
  ) => {
    if (
      gameStarted ||
      winner ||
      !selectedShip
    ) {
      return
    }

    const ship =
      fleet.find(
        (item) =>
          item.id === selectedShip
      )

    if (!ship) {
      return
    }

    const result =
      checkPlacement(
        index,
        ship
      )

    setHoveredCell(index)
    setPreviewCells(result.cells)
    setPreviewValid(result.valid)
  }

  const clearPreview = () => {
    if (!selectedShip) {
      return
    }

    setHoveredCell(null)
    setPreviewCells([])
  }

  const placeShip = (
    index: number
  ) => {
    if (
      gameStarted ||
      winner ||
      !selectedShip
    ) {
      return
    }

    const ship =
      fleet.find(
        (item) =>
          item.id === selectedShip
      )

    if (!ship) {
      return
    }

    const result =
      checkPlacement(
        index,
        ship
      )

    if (!result.valid) {
      setMessage(
        '❌ Корабли не могут касаться друг друга'
      )
      return
    }

    setPlacedShips(
      (previous) => ({
        ...previous,
        [ship.id]:
          result.cells,
      })
    )

    setSelectedShip(null)
    setHoveredCell(null)
    setPreviewCells([])
    setPreviewValid(true)

    setMessage(
      `✅ ${ship.name} установлен! Выбери следующий корабль.`
    )
  }

  const rotateShip = () => {
    if (
      gameStarted ||
      winner
    ) {
      return
    }

    setIsVertical(
      (previous) => !previous
    )

    if (
      hoveredCell !== null &&
      selectedShip
    ) {
      const ship =
        fleet.find(
          (item) =>
            item.id === selectedShip
        )

      if (ship) {
        const newVertical =
          !isVertical

        const cells =
          calculateShipCells(
            hoveredCell,
            ship.size,
            newVertical
          )

        if (!cells) {
          setPreviewCells([])
          setPreviewValid(false)
          return
        }

        const hasOverlap =
          cells.some((cell) =>
            allPlayerShipCells.includes(
              cell
            )
          )

        const touchesAnotherShip =
          cells.some((cell) =>
            isTouchingExistingShip(
              cell,
              cells
            )
          )

        setPreviewCells(cells)

        setPreviewValid(
          !hasOverlap &&
          !touchesAnotherShip
        )
      }
    }

    setMessage(
      !isVertical
        ? '↕ Вертикальное положение'
        : '↔ Горизонтальное положение'
    )
  }

  const selectShip = (
    ship: Ship
  ) => {
    if (
      gameStarted ||
      winner ||
      placedShips[ship.id]
    ) {
      return
    }

    setSelectedShip(
      ship.id
    )

    setMessage(
      `Выбран ${ship.name}. Наведи мышку на поле.`
    )
  }

  // ==========================================
  // ОТПРАВКА ОНЛАЙН-ВЫСТРЕЛА
  // ==========================================

  const sendOnlineShot = async (
    index: number
  ) => {
    if (!roomId) {
      return
    }

    if (pendingShotRef.current) {
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return
    }

    const row =
      Math.floor(index / 10)

    const col =
      index % 10

    const {
      data: room,
      error: roomError,
    } = await supabase
      .from('rooms')
      .select(
        'host_id, guest_id'
      )
      .eq('id', roomId)
      .single()

    if (
      roomError ||
      !room
    ) {
      console.error(
        'Ошибка загрузки комнаты:',
        roomError?.message
      )
      return
    }

    const targetId =
      room.host_id === user.id
        ? room.guest_id
        : room.host_id

    if (!targetId) {
      setMessage(
        '⏳ Сначала дождись подключения соперника'
      )
      return
    }

    pendingShotRef.current = true

    const {
      error,
    } = await supabase
      .from('room_moves')
      .insert({
        room_id: roomId,
        player_id: user.id,
        target_id: targetId,
        row,
        col,
        result: 'pending',
      })

    if (error) {
      pendingShotRef.current = false

      console.error(
        'Ошибка отправки онлайн хода:',
        error.message
      )

      setMessage(
        '❌ Не удалось отправить выстрел'
      )
    }
  }

  // ==========================================
  // ХОД КОМПЬЮТЕРА
  // ==========================================

  const makeComputerMove = () => {
    if (difficulty === 'easy') {
      const availableCells =
        Array.from(
          { length: 100 },
          (_, i) => i
        ).filter(
          (cell) =>
            !computerShotsRef.current.includes(
              cell
            )
        )

      if (
        availableCells.length === 0
      ) {
        setIsComputerThinking(false)
        return
      }

      const selectedCell =
        availableCells[
          Math.floor(
            Math.random() *
              availableCells.length
          )
        ]

      const newComputerShots = [
        ...computerShotsRef.current,
        selectedCell,
      ]

      computerShotsRef.current =
        newComputerShots

      setComputerShots(
        newComputerShots
      )

      if (
        allPlayerShipCells.includes(
          selectedCell
        )
      ) {
        computerHitsRef.current = [
          ...computerHitsRef.current,
          selectedCell,
        ]

        const playerHits =
          newComputerShots.filter(
            (cell) =>
              allPlayerShipCells.includes(
                cell
              )
          ).length

        if (
          playerHits ===
          allPlayerShipCells.length
        ) {
          setWinner('computer')

          saveGameResult('loss')

          setMessage(
            '🤖 Компьютер уничтожил весь твой флот!'
          )
        } else {
          setMessage(
            '🤖 Компьютер попал! Твой ход'
          )
        }
      } else {
        setMessage(
          '🤖 Компьютер промахнулся! Твой ход'
        )
      }

      setIsComputerThinking(false)
      return
    }

    const currentComputerShots =
      computerShotsRef.current

    const availableCells =
      Array.from(
        { length: 100 },
        (_, i) => i
      ).filter(
        (cell) =>
          !currentComputerShots.includes(
            cell
          )
      )

    if (
      availableCells.length === 0
    ) {
      setIsComputerThinking(false)
      return
    }

    const scores: number[] =
      Array(100).fill(0)

    const missedCells =
      currentComputerShots.filter(
        (cell) =>
          !allPlayerShipCells.includes(
            cell
          )
      )

    const hitCells =
      computerHitsRef.current

    if (difficulty === 'hard') {
      for (const ship of fleet) {
        for (
          let start = 0;
          start < 100;
          start++
        ) {
          for (const vertical of [
            false,
            true,
          ]) {
            const cells =
              calculateShipCells(
                start,
                ship.size,
                vertical
              )

            if (!cells) {
              continue
            }

            const containsMiss =
              cells.some(
                (cell) =>
                  missedCells.includes(
                    cell
                  )
              )

            if (containsMiss) {
              continue
            }

            const containsHit =
              cells.some(
                (cell) =>
                  hitCells.includes(
                    cell
                  )
              )

            for (const cell of cells) {
              if (
                currentComputerShots.includes(
                  cell
                )
              ) {
                continue
              }

              scores[cell] +=
                containsHit
                  ? 5
                  : 1
            }
          }
        }
      }

      if (hitCells.length > 0) {
        const lastHit =
          hitCells[
            hitCells.length - 1
          ]

        const row =
          Math.floor(
            lastHit / 10
          )

        const column =
          lastHit % 10

        let nearbyCells: number[] =
          []

        const horizontalHits =
          hitCells.filter(
            (cell) =>
              Math.floor(
                cell / 10
              ) === row
          )

        const verticalHits =
          hitCells.filter(
            (cell) =>
              cell % 10 === column
          )

        if (
          horizontalHits.length >=
          2
        ) {
          computerDirectionRef.current =
            'horizontal'
        } else if (
          verticalHits.length >=
          2
        ) {
          computerDirectionRef.current =
            'vertical'
        }

        if (
          computerDirectionRef.current ===
          'horizontal'
        ) {
          nearbyCells = [
            lastHit - 1,
            lastHit + 1,
          ]
        } else if (
          computerDirectionRef.current ===
          'vertical'
        ) {
          nearbyCells = [
            lastHit - 10,
            lastHit + 10,
          ]
        } else {
          nearbyCells = [
            lastHit - 10,
            lastHit + 10,
            lastHit - 1,
            lastHit + 1,
          ]
        }

        nearbyCells =
          nearbyCells.filter(
            (cell) => {
              if (
                cell < 0 ||
                cell >= 100
              ) {
                return false
              }

              const cellRow =
                Math.floor(
                  cell / 10
                )

              const cellColumn =
                cell % 10

              if (
                Math.abs(
                  cellRow - row
                ) +
                  Math.abs(
                    cellColumn -
                      column
                  ) !== 1
              ) {
                return false
              }

              return !currentComputerShots.includes(
                cell
              )
            }
          )

        for (
          const cell of nearbyCells
        ) {
          scores[cell] += 20
        }
      }
    }

    if (
      difficulty === 'medium' &&
      hitCells.length > 0
    ) {
      const lastHit =
        hitCells[
          hitCells.length - 1
        ]

      const row =
        Math.floor(
          lastHit / 10
        )

      const column =
        lastHit % 10

      let targetCells: number[] =
        []

      if (
        computerDirectionRef.current ===
        'horizontal'
      ) {
        targetCells = [
          lastHit - 1,
          lastHit + 1,
        ]
      } else if (
        computerDirectionRef.current ===
        'vertical'
      ) {
        targetCells = [
          lastHit - 10,
          lastHit + 10,
        ]
      } else {
        targetCells = [
          lastHit - 10,
          lastHit + 10,
          lastHit - 1,
          lastHit + 1,
        ]
      }

      targetCells =
        targetCells.filter(
          (cell) => {
            if (
              cell < 0 ||
              cell >= 100
            ) {
              return false
            }

            const cellRow =
              Math.floor(
                cell / 10
              )

            const cellColumn =
              cell % 10

            if (
              Math.abs(
                cellRow - row
              ) +
                Math.abs(
                  cellColumn -
                    column
                ) !== 1
            ) {
              return false
            }

            return !currentComputerShots.includes(
              cell
            )
          }
        )

      for (
        const cell of targetCells
      ) {
        scores[cell] += 10
      }
    }

    let bestScore = -1
    let bestCells: number[] = []

    for (
      const cell of availableCells
    ) {
      if (
        scores[cell] >
        bestScore
      ) {
        bestScore =
          scores[cell]

        bestCells = [cell]
      } else if (
        scores[cell] ===
        bestScore
      ) {
        bestCells.push(cell)
      }
    }

    const selectedCell =
      bestCells.length > 0
        ? bestCells[
            Math.floor(
              Math.random() *
                bestCells.length
            )
          ]
        : availableCells[
            Math.floor(
              Math.random() *
                availableCells.length
            )
          ]

    const newComputerShots = [
      ...computerShotsRef.current,
      selectedCell,
    ]

    computerShotsRef.current =
      newComputerShots

    setComputerShots(
      newComputerShots
    )

    if (
      allPlayerShipCells.includes(
        selectedCell
      )
    ) {
      const newHits = [
        ...computerHitsRef.current,
        selectedCell,
      ]

      computerHitsRef.current =
        newHits

      if (newHits.length >= 2) {
        const last =
          newHits[
            newHits.length - 1
          ]

        const previous =
          newHits[
            newHits.length - 2
          ]

        if (
          Math.floor(last / 10) ===
          Math.floor(previous / 10)
        ) {
          computerDirectionRef.current =
            'horizontal'
        } else if (
          last % 10 ===
          previous % 10
        ) {
          computerDirectionRef.current =
            'vertical'
        }
      }

      const playerHits =
        newComputerShots.filter(
          (cell) =>
            allPlayerShipCells.includes(
              cell
            )
        ).length

      if (
        playerHits ===
        allPlayerShipCells.length
      ) {
        setWinner('computer')

        saveGameResult('loss')

        setMessage(
          '🤖 Компьютер уничтожил весь твой флот!'
        )
      } else {
        setMessage(
          '🤖 Компьютер попал! Твой ход'
        )
      }
    } else {
      setMessage(
        '🤖 Компьютер промахнулся! Твой ход'
      )
    }

    setIsComputerThinking(false)
  }

  // ==========================================
  // АТАКА
  // ==========================================

  const handleAttack = (
    index: number
  ) => {
    if (
      !gameStarted ||
      winner ||
      isComputerThinking
    ) {
      return
    }

    if (shots.includes(index)) {
      return
    }

    // ========================================
    // ОНЛАЙН
    // ========================================

    if (onlineMode) {
      if (!myTurn) {
        setMessage(
          '⏳ Сейчас ход соперника'
        )
        return
      }

      if (pendingShotRef.current) {
        return
      }

      sendOnlineShot(index)
      return
    }

    // ========================================
    // ПРОТИВ КОМПЬЮТЕРА
    // ========================================

    const newShots = [
      ...shots,
      index,
    ]

    setShots(newShots)

    if (
      computerShips.includes(index)
    ) {
      const playerHits =
        newShots.filter(
          (cell) =>
            computerShips.includes(
              cell
            )
        ).length

      if (
        playerHits ===
        computerShips.length
      ) {
        setWinner('player')

        saveGameResult('win')

        setMessage(
          '🏆 ПОБЕДА! Ты уничтожил весь флот противника!'
        )
      } else {
        setMessage(
          '💥 Попадание! Твой ход'
        )
      }
    } else {
      setIsComputerThinking(true)

      setMessage(
        '💧 Промах! Компьютер думает...'
      )

      setTimeout(() => {
        makeComputerMove()
      }, 700)
    }
  }

  // ==========================================
  // СБРОС ИГРЫ
  // ==========================================

  const resetGame = () => {
    setGameStarted(false)
    setSelectedShip(null)
    setPlacedShips({})
    setIsVertical(false)
    setHoveredCell(null)
    setPreviewCells([])
    setPreviewValid(true)
    setShots([])
    setComputerShots([])
    setComputerShips([])
    setOnlineHits([])
    setMessage(
      'Сначала расставь свой флот'
    )
    setWinner(null)
    setIsComputerThinking(false)
    setMyTurn(true)

    resultSavedRef.current = false
    pendingShotRef.current = false

    computerShotsRef.current = []
    computerHitsRef.current = []
    computerDirectionRef.current =
      null

    if (roomId && onlineMode) {
      localStorage.removeItem(
        `battleship-ships-${roomId}`
      )
    }
  }

  // ==========================================
  // ПРОВЕРКА ФЛОТА
  // ==========================================

  const allShipsPlaced =
    fleet.every(
      (ship) =>
        placedShips[ship.id]
    )

  // ==========================================
  // START
  // ==========================================

  const startGame = async () => {
    if (!allShipsPlaced) {
      setMessage(
        '❗ Сначала установи все корабли'
      )
      return
    }

    if (!onlineMode) {
      const newComputerFleet =
        generateComputerFleet()

      setComputerShips(
        newComputerFleet
      )

      computerShotsRef.current = []
      computerHitsRef.current = []
      computerDirectionRef.current =
        null

      setComputerShots([])
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setMessage(
          '❌ Необходимо войти в аккаунт'
        )
        return
      }

      const {
        data: room,
        error,
      } = await supabase
        .from('rooms')
        .select(
          'host_id, guest_id'
        )
        .eq('id', roomId)
        .single()

      if (
        error ||
        !room
      ) {
        setMessage(
          '❌ Не удалось загрузить комнату'
        )
        return
      }

      if (!room.guest_id) {
        setMessage(
          '⏳ Дождись подключения второго игрока'
        )
        return
      }

      setMyTurn(
        room.host_id === user.id
      )
    }

    resultSavedRef.current = false
    pendingShotRef.current = false

    setGameStarted(true)

    if (onlineMode) {
      setMessage(
        myTurn
          ? '🌐 Онлайн-бой начался! Твой ход'
          : '🌐 Онлайн-бой начался! Ход соперника'
      )
    } else {
      setMessage(
        'Твой ход'
      )
    }
  }

  // ==========================================
  // JSX
  // ==========================================

  return (
    <div className="game-page">
      <header className="header">
        <div className="logo">
          ⚓ BATTLESHIP ARENA
        </div>

        <div className="game-status">
          {onlineMode
            ? '🌐 ОНЛАЙН-БОЙ'
            : 'ИГРА ПРОТИВ КОМПЬЮТЕРА'}
        </div>
      </header>

      <main className="game-content">
        <div className="game-title">
          <p className="eyebrow">
            {winner
              ? 'ИГРА ОКОНЧЕНА'
              : gameStarted
                ? 'БОЕВОЙ РЕЖИМ'
                : 'ПОДГОТОВКА К БОЮ'}
          </p>

          <h1>
            {winner === 'player'
              ? '🏆 ПОБЕДА!'
              : winner === 'computer'
                ? '💀 ПОРАЖЕНИЕ'
                : gameStarted
                  ? onlineMode
                    ? myTurn
                      ? 'ТВОЙ ХОД'
                      : 'ХОД СОПЕРНИКА'
                    : 'АТАКУЙ ПРОТИВНИКА'
                  : 'РАССТАВЬ СВОЙ ФЛОТ'}
          </h1>

          <p>
            {winner
              ? message
              : gameStarted
                ? message
                : 'Выбери корабль и наведи мышку на поле.'}
          </p>
        </div>

        {/* ======================================
            СЛОЖНОСТЬ AI
        ====================================== */}

        {!onlineMode &&
          !gameStarted &&
          !winner && (
            <div className="difficulty-panel">
              <h2>
                🤖 СЛОЖНОСТЬ AI
              </h2>

              <div className="difficulty-list">
                <button
                  className={
                    difficulty === 'easy'
                      ? 'difficulty-button difficulty-selected'
                      : 'difficulty-button'
                  }
                  onClick={() =>
                    setDifficulty(
                      'easy'
                    )
                  }
                >
                  🟢

                  <span>
                    Легко

                    <small>
                      Случайные выстрелы
                    </small>
                  </span>
                </button>

                <button
                  className={
                    difficulty === 'medium'
                      ? 'difficulty-button difficulty-selected'
                      : 'difficulty-button'
                  }
                  onClick={() =>
                    setDifficulty(
                      'medium'
                    )
                  }
                >
                  🟡

                  <span>
                    Средне

                    <small>
                      Hunt & Target
                    </small>
                  </span>
                </button>

                <button
                  className={
                    difficulty === 'hard'
                      ? 'difficulty-button difficulty-selected'
                      : 'difficulty-button'
                  }
                  onClick={() =>
                    setDifficulty(
                      'hard'
                    )
                  }
                >
                  🔴

                  <span>
                    Сложно

                    <small>
                      Продвинутый AI
                    </small>
                  </span>
                </button>
              </div>
            </div>
          )}

        {/* ======================================
            ФЛОТ
        ====================================== */}

        {!gameStarted &&
          !winner && (
            <div className="fleet-panel">
              <h2>
                🚢 ТВОЙ ФЛОТ
              </h2>

              <button
                className="rotate-button"
                onClick={
                  rotateShip
                }
              >
                {isVertical
                  ? '↕ ВЕРТИКАЛЬНО'
                  : '↔ ГОРИЗОНТАЛЬНО'}
              </button>

              <div className="fleet-list">
                {fleet.map(
                  (ship) => {
                    const isPlaced =
                      Boolean(
                        placedShips[
                          ship.id
                        ]
                      )

                    const isSelected =
                      selectedShip ===
                      ship.id

                    return (
                      <button
                        key={
                          ship.id
                        }
                        className={`fleet-ship ${
                          isSelected
                            ? 'fleet-ship-selected'
                            : ''
                        } ${
                          isPlaced
                            ? 'fleet-ship-placed'
                            : ''
                        }`}
                        onClick={() =>
                          selectShip(
                            ship
                          )
                        }
                        disabled={
                          isPlaced
                        }
                      >
                        <span>
                          🚢
                        </span>

                        <span>
                          {
                            ship.name
                          }

                          <small>
                            {
                              ship.size
                            }{' '}
                            клеток
                          </small>
                        </span>

                        <span>
                          {isPlaced
                            ? '✅'
                            : '➜'}
                        </span>
                      </button>
                    )
                  }
                )}
              </div>
            </div>
          )}

        {/* ======================================
            ДВА ПОЛЯ
        ====================================== */}

        <div className="boards-wrapper">
          {/* ====================================
              НАШЕ ПОЛЕ
          ==================================== */}

          <div className="game-board-container">
            <div className="board-title">
              ВАШ ФЛОТ
            </div>

            <div className="board">
              {Array.from(
                { length: 100 },
                (_, index) => {
                  const isShip =
                    allPlayerShipCells.includes(
                      index
                    )

                  const isShot =
                    computerShots.includes(
                      index
                    )

                  const isPreview =
                    previewCells.includes(
                      index
                    )

                  const isValidPreview =
                    isPreview &&
                    previewValid

                  const isInvalidPreview =
                    isPreview &&
                    !previewValid

                  return (
                    <div
                      className={`cell ${
                        isShip
                          ? 'cell-ship'
                          : ''
                      } ${
                        isShot
                          ? 'cell-shot'
                          : ''
                      } ${
                        isValidPreview
                          ? 'cell-preview-valid'
                          : ''
                      } ${
                        isInvalidPreview
                          ? 'cell-preview-invalid'
                          : ''
                      }`}
                      key={
                        index
                      }
                      onMouseEnter={() =>
                        updatePreview(
                          index
                        )
                      }
                      onMouseLeave={
                        clearPreview
                      }
                      onClick={() =>
                        placeShip(
                          index
                        )
                      }
                    />
                  )
                }
              )}
            </div>
          </div>

          {/* ====================================
              ПОЛЕ СОПЕРНИКА
          ==================================== */}

          <div className="game-board-container">
            <div className="board-title">
              ФЛОТ ПРОТИВНИКА
            </div>

            <div className="board">
              {Array.from(
                { length: 100 },
                (_, index) => {
                  const isShot =
                    shots.includes(
                      index
                    )

                  const isHit =
                    isShot &&
                    (
                      onlineMode
                        ? onlineHits.includes(
                            index
                          )
                        : computerShips.includes(
                            index
                          )
                    )

                  return (
                    <div
                      className={`cell ${
                        isShot
                          ? 'cell-shot'
                          : ''
                      } ${
                        isHit
                          ? 'cell-hit'
                          : ''
                      }`}
                      key={
                        index
                      }
                      onClick={() =>
                        handleAttack(
                          index
                        )
                      }
                    />
                  )
                }
              )}
            </div>
          </div>
        </div>

        {/* ======================================
            КНОПКА СТАРТА
        ====================================== */}

        {!gameStarted &&
          !winner && (
            <button
              className="primary-button start-button"
              disabled={
                !allShipsPlaced
              }
              onClick={
                startGame
              }
            >
              ⚔️ НАЧАТЬ ИГРУ
            </button>
          )}

        {/* ======================================
            ИНФОРМАЦИЯ ВО ВРЕМЯ ИГРЫ
        ====================================== */}

        {gameStarted &&
          !winner && (
            <p className="click-info">
              Твоих выстрелов:{' '}
              {shots.length}

              {' | '}

              {onlineMode
                ? myTurn
                  ? 'Твой ход'
                  : 'Ход соперника'
                : `Выстрелов компьютера: ${computerShots.length}`}
            </p>
          )}

        {/* ======================================
            НОВАЯ ИГРА
        ====================================== */}

        {winner && (
          <button
            className="primary-button start-button"
            onClick={
              resetGame
            }
          >
            🔄 НОВАЯ ИГРА
          </button>
        )}
      </main>
    </div>
  )
}

export default Game