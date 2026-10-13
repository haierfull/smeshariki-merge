// Тот же формат, что и config.json в настольной версии — можно вставить сюда обновлённый конфиг.
// Главное — не удалять обёртку «window.GAME_CONFIG = ... ;» в начале и в конце файла.
window.GAME_CONFIG = {
  "title": "Смешарики: Слияние",
  "subtitle": "Специально для Варечки",
  "window": {
    "width": 900,
    "height": 860,
    "fps": 60,
    "fullscreen": false
  },
  "background": {
    "image": "assets/background.png",
    "color": [
      255,
      243,
      209
    ],
    "fit": "cover"
  },
  "container": {
    "width": 460,
    "height": 600,
    "bottom_margin": 40,
    "wall_thickness": 12,
    "wall_color": [
      122,
      84,
      60
    ],
    "fill_color": [
      255,
      255,
      255,
      110
    ],
    "image": "assets/container.png",
    "danger_line_from_top": 50,
    "danger_seconds": 2.0,
    "danger_grace_seconds": 1.0,
    "danger_color": [
      230,
      60,
      60
    ]
  },
  "physics": {
    "gravity": 1500,
    "elasticity": 0.1,
    "friction": 0.5,
    "wall_friction": 0.4,
    "damping": 0.85,
    "density": 1.0,
    "iterations": 30,
    "steps_per_second": 120,
    "hitbox": {
      "mode": "auto",
      "alpha_threshold": 100,
      "simplify": 1.5,
      "concavity": 3.0,
      "max_parts": 20,
      "padding": 0.5
    }
  },
  "gameplay": {
    "drop_delay": 0.5,
    "hold_y_offset": 60,
    "keyboard_speed": 600,
    "top_merge": "vanish",
    "top_merge_bonus": 100,
    "show_guideline": true
  },
  "shuffle": {
    "enabled": true,
    "uses": 3,
    "duration": 0.8,
    "candidates": 30,
    "grace_seconds": 1.5,
    "icon": "assets/shuffle_icon.png"
  },
  "spawn": [
    {
      "id": "biby",
      "weight": 40
    },
    {
      "id": "pin",
      "weight": 30
    },
    {
      "id": "karkarych",
      "weight": 20
    },
    {
      "id": "sovunya",
      "weight": 10
    }
  ],
  "characters": [
    {
      "id": "biby",
      "name": "Биби",
      "radius": 25,
      "score": 1,
      "color": [
        170,
        220,
        235
      ],
      "image": "assets/characters/01_biby.png",
      "image_scale": 1.0,
      "hitbox_scale": 1.0
    },
    {
      "id": "pin",
      "name": "Пин",
      "radius": 31,
      "score": 3,
      "color": [
        120,
        150,
        200
      ],
      "image": "assets/characters/02_pin.png",
      "image_scale": 1.0,
      "hitbox_scale": 1.0
    },
    {
      "id": "karkarych",
      "name": "Кар-Карыч",
      "radius": 39,
      "score": 6,
      "color": [
        70,
        80,
        100
      ],
      "image": "assets/characters/03_karkarych.png",
      "image_scale": 1.0,
      "hitbox_scale": 1.0
    },
    {
      "id": "sovunya",
      "name": "Совунья",
      "radius": 49,
      "score": 10,
      "color": [
        190,
        170,
        220
      ],
      "image": "assets/characters/04_sovunya.png",
      "image_scale": 1.0,
      "hitbox_scale": 1.0
    },
    {
      "id": "kopatych",
      "name": "Копатыч",
      "radius": 59,
      "score": 15,
      "color": [
        140,
        120,
        100
      ],
      "image": "assets/characters/05_kopatych.png",
      "image_scale": 1.0,
      "hitbox_scale": 1.0
    },
    {
      "id": "losyash",
      "name": "Лосяш",
      "radius": 69,
      "score": 21,
      "color": [
        235,
        170,
        90
      ],
      "image": "assets/characters/06_losyash.png",
      "image_scale": 1.0,
      "hitbox_scale": 1.0
    },
    {
      "id": "yozhik",
      "name": "Ёжик",
      "radius": 82,
      "score": 28,
      "color": [
        110,
        100,
        180
      ],
      "image": "assets/characters/07_yozhik.png",
      "image_scale": 1.0,
      "hitbox_scale": 1.0
    },
    {
      "id": "krosh",
      "name": "Крош",
      "radius": 99,
      "score": 36,
      "color": [
        90,
        160,
        235
      ],
      "image": "assets/characters/08_krosh.png",
      "image_scale": 1.0,
      "hitbox_scale": 1.0
    },
    {
      "id": "nyusha",
      "name": "Нюша",
      "radius": 112,
      "score": 45,
      "color": [
        245,
        150,
        190
      ],
      "image": "assets/characters/09_nyusha.png",
      "image_scale": 1.0,
      "hitbox_scale": 1.0
    },
    {
      "id": "barash",
      "name": "Бараш",
      "radius": 125,
      "score": 55,
      "color": [
        225,
        120,
        160
      ],
      "image": "assets/characters/10_barash.png",
      "image_scale": 1.0,
      "hitbox_scale": 1.0
    }
  ],
  "ui": {
    "show_ladder": true,
    "show_next": true,
    "show_volume": true,
    "font_file": "assets/font.ttf",
    "text_color": [
      90,
      56,
      37
    ],
    "accent_color": [
      232,
      93,
      117
    ],
    "guideline_color": [
      205,
      185,
      155
    ],
    "panel": {
      "fill_color": [
        255,
        255,
        255,
        150
      ],
      "border_color": [
        122,
        84,
        60
      ],
      "border_width": 4,
      "radius": 18
    }
  },
  "messages": {
    "score": "Счёт",
    "best": "Рекорд",
    "next": "Дальше",
    "ladder": "Цепочка",
    "music": "Музыка",
    "sounds": "Звуки",
    "start_text": "Нажмите, чтобы продолжить",
    "game_over": "Игра окончена",
    "new_record": "Новый рекорд!",
    "restart_hint": "Пробел или клик — заново",
    "new_character": "Новый друг: {name}!",
    "shuffle": "Перемешать",
    "shuffled": "Перемешали!",
    "shuffle_none": "Пока нечего перемешивать",
    "shuffle_empty": "Перемешивания закончились",
    "top_reached": "Ура! Получился {name}!",
    "controls": "Мышь или ← → — двигать, клик или пробел — бросить"
  },
  "sound": {
    "volume": 0.4,
    "music_volume": 0.1,
    "drop": "assets/sounds/drop.wav",
    "merge": "assets/sounds/merge.wav",
    "top": "assets/sounds/top.wav",
    "game_over": "assets/sounds/game_over.wav",
    "shuffle": "assets/sounds/shuffle.wav",
    "music": "assets/sounds/music.ogg"
  }
};
