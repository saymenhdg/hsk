import { useEffect, useMemo, useState } from 'react'
import { decks } from '../../data.js'
import './App.css'

const STORAGE_KEY = 'hsk-combined-status'
const SELECT_KEY = 'hsk-custom-select'
const THEME_KEY = 'hsk-theme'

function useStatuses() {
  const [statuses, setStatuses] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses))
  }, [statuses])

  return [statuses, setStatuses]
}

function App() {
  const [level, setLevel] = useState('hsk1')
  const [deckType, setDeckType] = useState('words')
  const [filterMode, setFilterMode] = useState('all') // 'all' or 'review'
  const [filterSelection, setFilterSelection] = useState('all') // 'all' or 'selection'
  const [index, setIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [statuses, setStatuses] = useStatuses()
  const [showDone, setShowDone] = useState(false)
  const [shuffledDeck, setShuffledDeck] = useState(null)
  const [selected, setSelected] = useState(() => {
    try {
      const raw = localStorage.getItem(SELECT_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })
  const [showSelect, setShowSelect] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')
  const isDark = theme === 'dark'

  useEffect(() => {
    localStorage.setItem(SELECT_KEY, JSON.stringify(selected))
  }, [selected])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
    document.body.classList.toggle('dark-mode', isDark)
  }, [theme, isDark])

  const source = useMemo(() => decks[level][deckType], [level, deckType])
  const selectionKey = `${level}:${deckType}`
  const selectionMap = selected[selectionKey] || {}

  const filtered = useMemo(() => {
    if (deckType === 'words' && filterSelection === 'selection') {
      return source.filter((item) => selectionMap[item.char])
    }
    if (filterMode === 'review') {
      return source.filter((item) => statuses[`${level}:${deckType}:${item.char}`] !== 'known')
    }
    return [...source]
  }, [source, filterMode, statuses, level, deckType, filterSelection, selectionMap])

  const deck = useMemo(() => {
    if (shuffledDeck && shuffledDeck.length === filtered.length) {
      const allowed = new Set(filtered.map((i) => i.char))
      const aligned = shuffledDeck.filter((item) => allowed.has(item.char))
      if (aligned.length === filtered.length) return aligned
    }
    return filtered
  }, [filtered, shuffledDeck])

  useEffect(() => {
    setIndex(0)
    setIsFlipped(false)
    setShuffledDeck(null)
  }, [level, deckType, filterMode, filterSelection, selected])

  useEffect(() => {
    document.body.classList.toggle('sentence-mode', deckType === 'sentences')
  }, [deckType])

  useEffect(() => {
    function onKey(e) {
      if (['Space', 'Enter'].includes(e.code)) {
        e.preventDefault()
        flip()
      } else if (e.code === 'ArrowRight') {
        next()
      } else if (e.code === 'ArrowLeft') {
        prev()
      } else if (e.code === 'KeyS') {
        speak()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const current = deck[index]
  const total = deck.length
  const knownCount = decks[level][deckType].filter(
    (item) => statuses[`${level}:${deckType}:${item.char}`] === 'known'
  ).length

  function mark(status) {
    if (!current) return
    setStatuses((prev) => ({
      ...prev,
      [`${level}:${deckType}:${current.char}`]: status,
    }))
    if (status === 'known' && filterMode === 'review') {
      const nextLen = total - 1
      setIndex((i) => Math.min(i, Math.max(nextLen - 1, 0)))
    }
  }

  const flip = () => setIsFlipped((f) => !f)

  function next() {
    if (!total) return
    if (index < total - 1) setIndex((i) => i + 1)
    else setShowDone(true)
  }

  function prev() {
    if (index > 0) setIndex((i) => i - 1)
  }

  function shuffle() {
    const arr = [...deck]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    setShuffledDeck(arr)
    setIndex(0)
  }

  function speak() {
    if (!current) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(current.char)
    u.lang = 'zh-CN'
    u.rate = deckType === 'sentences' ? 0.85 : 0.8
    window.speechSynthesis.speak(u)
  }

  const selectionCount = Object.keys(selectionMap).length

  function toggleSelect(char) {
    setSelected((prev) => {
      const currentMap = prev[selectionKey] || {}
      const nextMap = { ...currentMap }
      if (nextMap[char]) {
        delete nextMap[char]
      } else {
        if (Object.keys(currentMap).length >= 20) return prev
        nextMap[char] = true
      }
      return { ...prev, [selectionKey]: nextMap }
    })
  }

  function clearSelection() {
    setSelected((prev) => ({ ...prev, [selectionKey]: {} }))
    if (filterSelection === 'selection') setFilterSelection('all')
  }

  const progressPct = total ? ((index + 1) / total) * 100 : 0
  const status =
    current && (statuses[`${level}:${deckType}:${current.char}`] === 'known' ? 'known' : 'review')

  const surface = isDark
    ? 'bg-slate-800 text-slate-100 border-slate-700'
    : 'bg-white text-slate-700 border-slate-200'
  const mutedText = isDark ? 'text-slate-300' : 'text-slate-500'
  const headerText = isDark ? 'text-slate-100' : 'text-slate-800'
  const subHeaderText = isDark ? 'text-slate-300' : 'text-slate-500'
  const progressTrack = isDark ? 'bg-slate-700' : 'bg-slate-200'

  const cardSizing =
    deckType === 'sentences' ? 'max-w-lg lg:max-w-xl h-[22rem] lg:h-[22rem]' : 'max-w-md h-96'
  const frontSize =
    deckType === 'sentences'
      ? 'text-4xl lg:text-5xl leading-snug px-4 lg:px-8 text-center'
      : 'text-8xl lg:text-9xl'
  const pinyinSize =
    deckType === 'sentences' ? 'text-xl lg:text-2xl px-4 lg:px-8' : 'text-3xl px-4'
  const englishSize =
    deckType === 'sentences'
      ? 'text-base lg:text-lg text-center px-6 lg:px-10 leading-relaxed'
      : 'text-xl text-center px-6 font-medium leading-relaxed'

  return (
    <div
      className={`min-h-screen w-full flex justify-center px-2 sm:px-4 py-8 ${
        isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <button
        onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        aria-label="Toggle theme"
        className={`fixed bottom-4 right-4 h-9 w-9 rounded-full border flex items-center justify-center transition-opacity duration-200 ${
          isDark
            ? 'bg-slate-800 border-slate-700 text-slate-200 hover:opacity-80'
            : 'bg-white border-slate-200 text-slate-500 hover:opacity-80'
        } opacity-40 hover:opacity-80 shadow-sm`}
      >
        {isDark ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M17.293 13.293a8 8 0 01-10.586-10.586 1 1 0 00-1.357-1.357 10 10 0 1013.3 13.3 1 1 0 00-1.357-1.357z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 15a5 5 0 100-10 5 5 0 000 10z" />
            <path fillRule="evenodd" d="M10 1a1 1 0 011 1v1a1 1 0 11-2 0V2a1 1 0 011-1zm0 15a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm9-6a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM4 10a1 1 0 01-1 1H2a1 1 0 110-2h1a1 1 0 011 1zm11.657-5.657a1 1 0 010 1.414L15.243 7.17a1 1 0 11-1.414-1.414l.414-.414a1 1 0 011.414 0zM6.171 13.829a1 1 0 010 1.414l-.414.414a1 1 0 11-1.414-1.414l.414-.414a1 1 0 011.414 0zm0-6.657L5.757 6.17A1 1 0 114.343 4.757l.414-.414a1 1 0 111.414 1.414zm8.486 8.486l-.414.414a1 1 0 11-1.414-1.414l.414-.414a1 1 0 111.414 1.414z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      <div className="w-full max-w-5xl">
        <header className="w-full flex flex-col items-center text-center mb-6 gap-4">
          <div className="space-y-1">
            <h1 className={`text-3xl font-bold ${headerText}`}>HSK Flashcard Master</h1>
            <p className={`text-sm ${subHeaderText}`}>HSK1 &amp; HSK2 • Vocabulary &amp; Sentences</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {['hsk1', 'hsk2'].map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLevel(l)
                  setFilterMode('all')
                  setFilterSelection('all')
                  setIsFlipped(false)
                }}
                className={`px-3 py-2 text-sm font-semibold rounded-lg border transition ${
                  l === level
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : isDark
                      ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {deckType === 'words' && (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  setFilterSelection((f) => (f === 'selection' ? 'all' : 'selection'))
                  setFilterMode('all')
                  setIndex(0)
                }}
                className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border transition ${
                  filterSelection === 'selection'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : isDark
                      ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                }`}
              >
                {filterSelection === 'selection' ? 'Studying Custom List' : 'Study Custom List'}
              </button>
              <button
                onClick={() => setShowSelect(true)}
                className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border transition ${
                  isDark
                    ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Edit Custom List ({selectionCount})
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap justify-center">
            {[
              { value: 'words', label: 'Vocabulary' },
              { value: 'sentences', label: 'Sentences' },
            ].map((deckOption) => (
              <button
                key={deckOption.value}
                onClick={() => {
                  setDeckType(deckOption.value)
                  setFilterMode('all')
                  setFilterSelection('all')
                  setShowSelect(false)
                  setIsFlipped(false)
                }}
                className={`px-3 py-2 text-sm font-semibold rounded-lg border transition ${
                  deckType === deckOption.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : isDark
                      ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {deckOption.label}
              </button>
            ))}
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)] items-start justify-center">
          <main
            className={`w-full mx-auto perspective-1000 relative group cursor-pointer no-select ${cardSizing}`}
            onClick={(e) => {
              if (e.target.closest('#audioBtn')) return
              if (!current) return
              flip()
            }}
            aria-live="polite"
          >
            <div
              className={`card-inner w-full h-full relative transition-all duration-500 transform-style-3d shadow-xl rounded-3xl ${isFlipped ? 'rotate-y-180' : ''}`}
            >
              <div
                className={`absolute inset-0 w-full h-full rounded-3xl flex flex-col items-center justify-center backface-hidden border-2 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-white text-slate-800'
                }`}
              >
                <div className={`absolute top-4 right-4 text-xs font-bold tracking-widest uppercase ${subHeaderText}`}>
                  Hanzi
                </div>
                <div
                  className={`chinese-font ${frontSize} font-medium mb-4 ${headerText}`}
                >
                  {current ? current.char : 'Add Words'}
                </div>
                <p className={`${mutedText} text-sm mt-4 font-medium animate-pulse`}>
                  {current ? 'Tap to flip' : 'Click "Edit Custom List"'}
                </p>
              </div>

              <div className="absolute inset-0 w-full h-full bg-indigo-600 rounded-3xl flex flex-col items-center justify-center backface-hidden rotate-y-180 text-white border-2 border-indigo-600">
                <div className="absolute top-4 right-4 text-xs font-bold text-indigo-300 tracking-widest uppercase">
                  Meaning
                </div>
                <div className="chinese-font text-4xl mb-2 opacity-60">{current ? current.char : ''}</div>
                <div className={`${pinyinSize} font-bold mb-4 text-indigo-100 font-mono text-center`}>
                  {current ? current.pinyin : ''}
                </div>
                <div className="w-16 h-1 bg-indigo-400 rounded-full mb-4" />
                <div className={englishSize}>
                  {current ? current.en : 'Your custom list is empty. Please select words to study.'}
                </div>
                {current && (
                  <button
                    id="audioBtn"
                    onClick={(e) => {
                      e.stopPropagation()
                      speak()
                    }}
                    className="mt-8 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors flex items-center justify-center backdrop-blur-sm"
                    title="Play Audio"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </main>

          <div className="w-full max-w-md md:max-w-full mx-auto md:mx-0">
            <div className="flex justify-between text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">
              <span>Progress</span>
              <span>{Math.min(index + 1, total)} / {total}</span>
            </div>
            <div className={`w-full ${progressTrack} rounded-full h-2 mb-4 overflow-hidden`}>
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className={`flex items-center justify-between text-xs ${mutedText} mb-3`}>
              <span
                className={`px-3 py-1 rounded-full font-semibold ${
                  status === 'known' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {status === 'known' ? 'Known' : 'Needs review'}
              </span>
              <span className="font-semibold">Known {knownCount} / {source.length}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <button
                className={`font-bold py-2 px-3 rounded-xl shadow-sm border active:scale-95 transition-all ${
                  isDark
                    ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => mark('review')}
              >
                Mark review
              </button>
              <button className="bg-emerald-100 text-emerald-700 font-bold py-2 px-3 rounded-xl border border-emerald-200 hover:bg-emerald-200/70 active:scale-95 transition-all" onClick={() => mark('known')}>
                Mark known
              </button>
              <button
                onClick={() => {
                  setFilterMode((f) => (f === 'review' ? 'all' : 'review'))
                  setFilterSelection('all')
                  setIndex(0)
                }}
                className={`font-bold py-2 px-3 rounded-xl border transition ${
                  filterMode === 'review'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : isDark
                      ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                }`}
              >
                {filterMode === 'review' ? 'Studying Review' : 'Study Review'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={prev}
                disabled={index === 0}
                className={`flex-1 font-bold py-3 px-4 rounded-xl shadow-sm border active:scale-95 transition-all flex justify-center items-center gap-2 ${
                  isDark
                    ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                } ${index === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Prev
              </button>
              <button
                onClick={shuffle}
                className={`p-3 rounded-xl active:scale-95 transition-all shadow-sm border ${
                  isDark
                    ? 'bg-slate-800 text-indigo-200 border-slate-700 hover:bg-slate-700'
                    : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'
                }`}
                title="Shuffle Deck"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={next}
                className="flex-1 bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex justify-center items-center gap-2"
              >
                Next
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {showDone && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
            <div
              className={`rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center ${
                isDark ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-800'
              }`}
            >
              <h3 className="text-2xl font-bold mb-2">Deck complete</h3>
              <p className="mb-6 text-sm leading-relaxed">
                {filterSelection === 'selection'
                  ? `You finished your custom list of ${deck.length} words.`
                  : `Known: ${knownCount} / Total: ${source.length}.`}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setIndex(0)
                    setShowDone(false)
                  }}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition"
                >
                  Restart this deck
                </button>
                <button
                  onClick={() => {
                    setFilterMode('all')
                    setFilterSelection('all')
                    setIndex(0)
                    setShowDone(false)
                  }}
                  className="w-full bg-white text-slate-600 py-2 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition"
                >
                  Return to full library
                </button>
              </div>
            </div>
          </div>
        )}

        {showSelect && deckType === 'words' && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div
              className={`rounded-2xl p-6 w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] ${
                isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                  <h3 className="text-xl font-bold">Select Words (Max 20)</h3>
                  <p className={`text-sm ${mutedText}`}>Create a focused study list.</p>
                </div>
                <span
                  className={`text-sm font-bold ${
                    selectionCount >= 20 ? 'text-amber-600' : 'text-indigo-600'
                  }`}
                >
                  {selectionCount} / 20
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 overflow-y-auto pr-1 flex-grow">
                {source.map((item) => {
                  const active = !!selectionMap[item.char]
                  return (
                    <button
                      key={item.char}
                      onClick={() => toggleSelect(item.char)}
                      className={`text-left rounded-xl border p-3 transition focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                        active
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-800 ring-1 ring-indigo-200'
                          : isDark
                            ? 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="chinese-font text-xl">{item.char}</span>
                        {active && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px]">
                            ✓
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{item.pinyin}</div>
                      <div className="text-[11px] text-slate-500 truncate">{item.en}</div>
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2 flex-shrink-0 pt-4 border-t border-slate-100">
                <button
                  onClick={clearSelection}
                  className={`px-3 py-2 rounded-lg border font-semibold text-sm ${
                    isDark
                      ? 'border-slate-700 text-slate-100 hover:bg-slate-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowSelect(false)}
                  className={`px-3 py-2 rounded-lg border font-semibold text-sm ${
                    isDark
                      ? 'border-slate-700 text-slate-100 hover:bg-slate-800'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectionCount > 0) {
                      setFilterSelection('selection')
                      setFilterMode('all')
                      setIndex(0)
                      setIsFlipped(false)
                      setShuffledDeck(null)
                      setShowSelect(false)
                    } else {
                      alert('Please select at least one word to study.')
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-sm shadow-md shadow-indigo-200"
                >
                  Study These Words
                </button>
              </div>
              {selectionCount >= 20 && (
                <p className="text-xs text-amber-600 mt-2 font-medium">
                  Limit reached: unselect a word to add a new one.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
