"""Сочетания пар арканов: {(a, b): (короткая фраза, абзац, абзац[, абзац])}, a < b.

Модули подхватываются автоматически. Порядок пары проверяется здесь же: перевёрнутая пара
дала бы вторую страницу на тот же смысл.
"""
import importlib
import pkgutil

PAIRS: dict[tuple[int, int], tuple[str, ...]] = {}

for _mod in sorted(m.name for m in pkgutil.iter_modules(__path__)):
    for _key, _value in importlib.import_module(f"{__name__}.{_mod}").PAIRS.items():
        _a, _b = _key
        if not 1 <= _a < _b <= 22:
            raise ValueError(f"{_mod}: пара {_key} не в порядке a < b внутри 1..22")
        if _key in PAIRS:
            raise ValueError(f"{_mod}: пара {_key} описана дважды")
        if len(_value) < 3:
            raise ValueError(f"{_mod}: у пары {_key} меньше двух абзацев")
        PAIRS[_key] = _value
