import pytest
from datetime import datetime
from unittest.mock import patch

from app.data.providers.open_meteo import open_meteo_provider
from app.data.providers.copernicus import copernicus_provider
from app.data.providers.incois import incois_provider
from app.data.providers.imd import imd_provider

def test_open_meteo_fetch_marine_live():
    """Test marine data fetch returns properly formatted Live response if successful, else None."""
    # Test valid coords
    res = open_meteo_provider.fetch_marine(19.0, 72.8, datetime.now())
    if res:
        assert res.metadata.mode == "LIVE"
        assert "wave_height_m" in res.data
        assert res.metadata.source == "Open-Meteo Marine"

def test_copernicus_no_credentials():
    """Test Copernicus returns None if credentials are missing."""
    # Temporarily remove credentials
    old_user = copernicus_provider.username
    copernicus_provider.username = None
    res = copernicus_provider.fetch_current(19.0, 72.8, datetime.now())
    assert res is None
    copernicus_provider.username = old_user

@patch('httpx.Client.get')
def test_incois_unavailable(mock_get):
    """Test INCOIS returns None by default due to no API."""
    mock_get.side_effect = Exception("Connection refused")
    res = incois_provider.fetch_pfz_zones(19.0, 72.8, datetime.now())
    assert res is None

@patch('httpx.Client.get')
def test_imd_unavailable(mock_get):
    """Test IMD returns None by default."""
    mock_get.side_effect = Exception("Connection refused")
    res = imd_provider.fetch_alerts(19.0, 72.8, datetime.now())
    assert res is None
