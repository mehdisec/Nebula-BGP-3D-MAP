import time
from typing import Any, Optional, Dict

class SimpleTTLCache:
    """Thread-safe in-memory cache with time-to-live expiration."""
    def __init__(self, default_ttl_seconds: int = 600):
        self.default_ttl = default_ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._cache.get(key)
        if not entry:
            return None
        if time.time() > entry["expires_at"]:
            del self._cache[key]
            return None
        return entry["data"]

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        self._cache[key] = {
            "data": value,
            "expires_at": time.time() + ttl
        }

    def clear(self) -> None:
        self._cache.clear()

# Global shared cache instances
cache = SimpleTTLCache(default_ttl_seconds=900)  # 15 minutes
as_cache = SimpleTTLCache(default_ttl_seconds=3600)  # 1 hour
