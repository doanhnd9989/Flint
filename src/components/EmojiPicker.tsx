import { useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'

/**
 * A reusable searchable emoji picker. Designed to live inside a `Popover`
 * panel: a search box, category sections, a scrollable grid, and a
 * frequently-used row persisted to localStorage. Calls `onPick(emoji)` when an
 * emoji is chosen — the caller decides what to do (toggle a reaction, etc.).
 *
 * Section labels and the category names follow Linear's picker exactly
 * ("Frequently used", then "Smileys & People", "Animals & Nature", …). Keep the
 * list reasonable (a few dozen per category) — this is a faithful stand-in for
 * Linear's far larger picker, not a full unicode database.
 */

const RECENTS_KEY = 'flint.emoji.recents'
const MAX_RECENTS = 18

/** `[emoji, search keywords]` — Linear matches on the name, not the category. */
type Entry = [string, string]
type Category = { name: string; emojis: Entry[] }

const CATEGORIES: Category[] = [
  {
    name: 'Smileys & People',
    emojis: [
      ['😀', 'grin smile happy'], ['😃', 'smiley happy'], ['😄', 'smile laugh'],
      ['😁', 'beam grin'], ['😆', 'laugh satisfied'], ['😅', 'sweat laugh nervous'],
      ['🤣', 'rofl rolling laugh'], ['😂', 'joy tears laugh'], ['🙂', 'slight smile'],
      ['🙃', 'upside down'], ['😉', 'wink'], ['😊', 'blush smile'],
      ['😇', 'innocent halo angel'], ['🥰', 'love hearts'], ['😍', 'heart eyes love'],
      ['😘', 'kiss'], ['😋', 'yum tasty'], ['😜', 'wink tongue'],
      ['🤪', 'zany goofy'], ['😎', 'cool sunglasses'], ['🤩', 'star struck wow'],
      ['🥳', 'party celebrate'], ['😏', 'smirk'], ['😴', 'sleep zzz'],
      ['😌', 'relieved calm'], ['😔', 'pensive sad'], ['😢', 'cry sad'],
      ['😭', 'sob cry'], ['😤', 'triumph steam angry'], ['😡', 'rage angry mad'],
      ['🤔', 'think hmm'], ['🤨', 'raised eyebrow suspicious'], ['😐', 'neutral'],
      ['😶', 'no mouth speechless'], ['🙄', 'eye roll'], ['😬', 'grimace awkward'],
      ['🤯', 'mind blown explode'], ['😱', 'scream fear'], ['😳', 'flushed embarrassed'],
      ['🥺', 'pleading puppy'], ['😩', 'weary tired'], ['🤗', 'hug'],
      ['😷', 'mask sick'], ['🤒', 'sick fever'], ['🤕', 'hurt injured'],
      ['👍', 'thumbs up yes approve lgtm'], ['👎', 'thumbs down no'], ['👌', 'ok perfect'],
      ['✌️', 'peace victory'], ['🤞', 'fingers crossed luck'], ['🤘', 'rock horns'],
      ['👏', 'clap applause bravo'], ['🙌', 'raised hands praise'], ['🙏', 'pray thanks please'],
      ['🤝', 'handshake deal agree'], ['💪', 'muscle strong'], ['👋', 'wave hello hi bye'],
      ['👊', 'fist bump'], ['🫶', 'heart hands love'], ['👀', 'eyes look watching'],
      ['🧠', 'brain smart'], ['🧑‍💻', 'developer coding'], ['🕵️', 'detective investigate'],
      ['🦸', 'hero superhero'], ['🤷', 'shrug dunno'], ['🤦', 'facepalm'],
      ['🙋', 'raise hand volunteer'], ['🙅', 'no gesture stop'],
    ],
  },
  {
    name: 'Animals & Nature',
    emojis: [
      ['🐶', 'dog puppy'], ['🐱', 'cat kitten'], ['🐭', 'mouse'], ['🐹', 'hamster'],
      ['🐰', 'rabbit bunny'], ['🦊', 'fox'], ['🐻', 'bear'], ['🐼', 'panda'],
      ['🐨', 'koala'], ['🐯', 'tiger'], ['🦁', 'lion'], ['🐮', 'cow'],
      ['🐷', 'pig'], ['🐸', 'frog'], ['🐵', 'monkey'], ['🐔', 'chicken'],
      ['🐧', 'penguin'], ['🐦', 'bird'], ['🦄', 'unicorn'], ['🐝', 'bee'],
      ['🦋', 'butterfly'], ['🐢', 'turtle slow'], ['🐙', 'octopus'], ['🦀', 'crab'],
      ['🌳', 'tree'], ['🌲', 'evergreen pine'], ['🌴', 'palm tree'], ['🌵', 'cactus'],
      ['🌷', 'tulip flower'], ['🌹', 'rose flower'], ['🌻', 'sunflower'], ['🌸', 'blossom flower'],
      ['🍀', 'clover luck'], ['🍁', 'maple leaf autumn'], ['🍄', 'mushroom'], ['⭐', 'star'],
    ],
  },
  {
    name: 'Food & Drink',
    emojis: [
      ['🍎', 'apple'], ['🍊', 'orange tangerine'], ['🍋', 'lemon'], ['🍌', 'banana'],
      ['🍉', 'watermelon'], ['🍇', 'grapes'], ['🍓', 'strawberry'], ['🫐', 'blueberries'],
      ['🍑', 'peach'], ['🍒', 'cherries'], ['🥝', 'kiwi'], ['🍍', 'pineapple'],
      ['🥑', 'avocado'], ['🍅', 'tomato'], ['🥕', 'carrot'], ['🌽', 'corn'],
      ['🥦', 'broccoli'], ['🍞', 'bread'], ['🧀', 'cheese'], ['🍔', 'burger'],
      ['🍟', 'fries'], ['🍕', 'pizza'], ['🌮', 'taco'], ['🌯', 'burrito'],
      ['🍣', 'sushi'], ['🍱', 'bento'], ['🍜', 'ramen noodles'], ['🍝', 'pasta spaghetti'],
      ['🍰', 'cake slice'], ['🎂', 'birthday cake'], ['🍪', 'cookie'], ['🍩', 'donut'],
      ['🍫', 'chocolate'], ['🍿', 'popcorn'], ['☕', 'coffee tea'], ['🍺', 'beer'],
    ],
  },
  {
    name: 'Activity',
    emojis: [
      ['⚽', 'soccer football'], ['🏀', 'basketball'], ['🏈', 'american football'], ['⚾', 'baseball'],
      ['🎾', 'tennis'], ['🏐', 'volleyball'], ['🎱', 'pool billiards'], ['🏓', 'ping pong'],
      ['🏸', 'badminton'], ['⛳', 'golf'], ['🏆', 'trophy win'], ['🥇', 'gold medal first'],
      ['🥈', 'silver medal'], ['🥉', 'bronze medal'], ['🎯', 'target bullseye'], ['🎮', 'game controller'],
      ['🎲', 'dice random'], ['🎸', 'guitar'], ['🎹', 'piano keyboard'], ['🎺', 'trumpet'],
      ['🎤', 'microphone sing'], ['🎧', 'headphones'], ['🎬', 'clapper film'], ['🎉', 'party tada celebrate'],
      ['🎊', 'confetti'], ['🎈', 'balloon'], ['🎁', 'gift present'], ['🏁', 'checkered flag finish'],
      ['🚴', 'cycling bike'], ['🏊', 'swimming'], ['🧗', 'climbing'],
    ],
  },
  {
    name: 'Travel & Places',
    emojis: [
      ['🚀', 'rocket ship launch ship it'], ['✈️', 'airplane flight'], ['🚗', 'car'], ['🚕', 'taxi'],
      ['🚌', 'bus'], ['🚆', 'train'], ['🚢', 'ship boat'], ['🛵', 'scooter'],
      ['🚁', 'helicopter'], ['🛰️', 'satellite'], ['🏠', 'house home'], ['🏢', 'office building'],
      ['🏭', 'factory'], ['🏗️', 'construction building'], ['🗼', 'tower'], ['🌉', 'bridge'],
      ['🌍', 'earth globe world'], ['🌙', 'moon night'], ['☀️', 'sun sunny'], ['🌈', 'rainbow'],
      ['⛅', 'cloud weather'], ['⛈️', 'storm thunder'], ['❄️', 'snow cold freeze'], ['🔥', 'fire hot lit burn'],
      ['🌊', 'wave ocean water'], ['🏔️', 'mountain'],
    ],
  },
  {
    name: 'Objects',
    emojis: [
      ['💻', 'laptop computer'], ['🖥️', 'desktop monitor'], ['⌨️', 'keyboard'], ['🖱️', 'mouse'],
      ['📱', 'phone mobile'], ['🖨️', 'printer'], ['💾', 'floppy save'], ['📷', 'camera photo'],
      ['🎥', 'video camera'], ['📺', 'tv'], ['📦', 'package box ship'], ['📚', 'books docs'],
      ['✏️', 'pencil edit'], ['📝', 'memo note write'], ['📌', 'pin'], ['📎', 'paperclip attach'],
      ['🔑', 'key auth'], ['🔒', 'lock secure'], ['🔓', 'unlock'], ['💡', 'idea lightbulb'],
      ['🔦', 'flashlight'], ['🔋', 'battery'], ['🔌', 'plug'], ['⏰', 'alarm clock time'],
      ['⚙️', 'gear settings config'], ['🛠️', 'tools'], ['🔧', 'wrench fix'], ['🔨', 'hammer'],
      ['🧪', 'test tube experiment'], ['🔬', 'microscope research'], ['💰', 'money bag'], ['💳', 'credit card billing'],
      ['📈', 'chart up growth'], ['📉', 'chart down decline'], ['📊', 'bar chart metrics'], ['📅', 'calendar date'],
    ],
  },
  {
    name: 'Symbols',
    emojis: [
      ['❤️', 'heart love red'], ['🧡', 'orange heart'], ['💛', 'yellow heart'], ['💚', 'green heart'],
      ['💙', 'blue heart'], ['💜', 'purple heart'], ['🖤', 'black heart'], ['🤍', 'white heart'],
      ['💔', 'broken heart'], ['💕', 'two hearts'], ['✅', 'check done complete yes'], ['❌', 'cross no fail wrong'],
      ['⭕', 'circle'], ['❓', 'question'], ['❗', 'exclamation important'], ['⚠️', 'warning caution'],
      ['🔴', 'red circle'], ['🟠', 'orange circle'], ['🟡', 'yellow circle'], ['🟢', 'green circle'],
      ['🔵', 'blue circle'], ['🟣', 'purple circle'], ['➕', 'plus add'], ['➖', 'minus remove'],
      ['♾️', 'infinity'], ['💢', 'anger'], ['💥', 'boom collision'], ['💫', 'dizzy sparkle'],
      ['✨', 'sparkles magic new'], ['🌟', 'glowing star'], ['💯', 'hundred perfect score'], ['🆗', 'ok'],
    ],
  },
  {
    name: 'Flags',
    emojis: [
      ['🏁', 'checkered flag'], ['🚩', 'triangular flag'], ['🎌', 'crossed flags'], ['🏴', 'black flag'],
      ['🏳️', 'white flag'], ['🏳️‍🌈', 'rainbow pride flag'], ['🏴‍☠️', 'pirate flag'], ['🇺🇸', 'united states usa'],
      ['🇬🇧', 'united kingdom uk'], ['🇨🇦', 'canada'], ['🇫🇷', 'france'], ['🇩🇪', 'germany'],
      ['🇮🇹', 'italy'], ['🇪🇸', 'spain'], ['🇯🇵', 'japan'], ['🇰🇷', 'korea'],
      ['🇨🇳', 'china'], ['🇮🇳', 'india'], ['🇧🇷', 'brazil'], ['🇲🇽', 'mexico'],
      ['🇦🇺', 'australia'], ['🇳🇱', 'netherlands'], ['🇸🇪', 'sweden'], ['🇻🇳', 'vietnam'],
    ],
  },
]

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, MAX_RECENTS) : []
  } catch {
    return []
  }
}

function pushRecent(emoji: string): string[] {
  const next = [emoji, ...loadRecents().filter((e) => e !== emoji)].slice(0, MAX_RECENTS)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / privacy-mode failures */
  }
  return next
}

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [query, setQuery] = useState('')
  const [recents, setRecents] = useState<string[]>(loadRecents)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = query.trim().toLowerCase()

  // Linear matches the query against an emoji's own name ("rocket", "ship it"),
  // so a search narrows *within* each category rather than dropping whole ones.
  const sections = useMemo(() => {
    if (!q) return CATEGORIES
    return CATEGORIES.map((c) => ({
      name: c.name,
      emojis: c.emojis.filter(([, kw]) => kw.includes(q)),
    })).filter((c) => c.emojis.length > 0)
  }, [q])

  function choose(emoji: string) {
    setRecents(pushRecent(emoji))
    onPick(emoji)
  }

  return (
    <div className="flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
      <div className="relative mb-1 px-1 pt-1">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji…"
          className="w-full rounded-md border border-border bg-bg py-1 pl-7 pr-2 text-[13px] text-fg placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </div>

      <div className="max-h-[240px] overflow-y-auto px-1 pb-1">
        {!q && recents.length > 0 && (
          <Section label="Frequently used" emojis={recents} onPick={choose} />
        )}
        {sections.map((c) => (
          <Section
            key={c.name}
            label={c.name}
            emojis={c.emojis.map(([e]) => e)}
            onPick={choose}
          />
        ))}
        {sections.length === 0 && (
          <div className="px-1 py-6 text-center text-[12px] text-faint">
            No emoji found
          </div>
        )}
      </div>
    </div>
  )
}

function Section({
  label,
  emojis,
  onPick,
}: {
  label: string
  emojis: string[]
  onPick: (emoji: string) => void
}) {
  return (
    <div className="mb-1">
      <div className="px-1 pb-0.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-faint">
        {label}
      </div>
      {/* The cell tracks the column (`w-full` in a 7-fr grid) instead of a fixed
          `h-7`, so at a larger `--font-scale` the glyph grows inside its box
          rather than being clipped by it. */}
      <div className="grid grid-cols-7 gap-0.5">
        {emojis.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            onClick={() => onPick(e)}
            className="flex aspect-square w-full items-center justify-center rounded-md text-[16px] leading-none hover:bg-bg-hover"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
