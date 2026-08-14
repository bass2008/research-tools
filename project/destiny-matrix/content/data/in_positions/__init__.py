"""Толкования арканов по позициям отчёта: {номер аркана: {ключ раздела: текст}}.

Модули собираются автоматически, чтобы порции текста можно было добавлять файлами и не
править список импортов.
"""
import importlib
import pkgutil

IN_POSITIONS: dict[int, dict[str, str]] = {}

for _mod in sorted(m.name for m in pkgutil.iter_modules(__path__)):
    _texts = importlib.import_module(f"{__name__}.{_mod}").TEXT
    for _n, _by_key in _texts.items():
        _slot = IN_POSITIONS.setdefault(_n, {})
        for _key, _text in _by_key.items():
            if _key in _slot:
                raise ValueError(f"аркан {_n}: позиция {_key} описана дважды ({_mod})")
            _slot[_key] = _text
