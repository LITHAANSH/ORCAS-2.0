from datetime import datetime
from typing import Dict, Optional, Protocol

from ...schemas import ProviderResponse

class BaseProvider(Protocol):
    """Provider interface contract."""

    def fetch(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        """Fetch data for location and time.

        Returns:
            ProviderResponse if successful.
            None on any failure (timeout, invalid data, network error).
        """
        ...
