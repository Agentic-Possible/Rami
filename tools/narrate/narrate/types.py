"""Types shared at audio and progress-file boundaries."""

from typing import TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    import numpy as np
    from numpy.typing import NDArray

    Samples = NDArray[np.float32]

CacheContext = dict[str, str | float | None]


class SegmentTiming(TypedDict):
    id: str
    start: float
    end: float


class PartRecord(TypedDict):
    id: str
    label: str
    file: str
    spineHref: str
    spinePath: str
    fragment: str | None
    duration: float
    bytes: int
    cacheKey: str
    segments: list[SegmentTiming]
