from .arcana_a import PART as _A
from .arcana_b import PART as _B

ARCANA = sorted(_A + _B, key=lambda a: a["n"])
