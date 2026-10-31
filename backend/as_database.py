"""
Database of known Autonomous System (AS) networks, Tier-1 backbones,
hyper-scalers, CDNs, and helper functions for metadata enrichment.
"""

import math
from typing import Dict, Any, Optional, Tuple

# Comprehensive ISO 2-letter Country Coordinates (Centroids) for Geographic Mapping
COUNTRY_COORDINATES: Dict[str, Tuple[float, float]] = {
    "US": (37.0902, -95.7129),
    "GB": (55.3781, -3.4360),
    "DE": (51.1657, 10.4515),
    "FR": (46.2276, 2.2137),
    "NL": (52.1326, 5.2913),
    "JP": (36.2048, 138.2529),
    "CN": (35.8617, 104.1954),
    "IN": (20.5937, 78.9629),
    "BR": (-14.2350, -51.9253),
    "AU": (-25.2744, 133.7751),
    "ZA": (-30.5595, 22.9375),
    "SE": (60.1282, 18.6435),
    "IT": (41.8719, 12.5674),
    "ES": (40.4637, -3.7492),
    "SG": (1.3521, 103.8198),
    "HK": (22.3193, 114.1694),
    "CA": (56.1304, -106.3468),
    "CH": (46.8182, 8.2275),
    "IR": (32.4279, 53.6880),
    "TR": (38.9637, 35.2433),
    "RU": (61.5240, 105.3188),
    "KR": (35.9078, 127.7669),
    "EU": (50.8503, 4.3517),
    "PL": (51.9194, 19.1451),
    "UA": (48.3794, 31.1656),
    "NO": (60.4720, 8.4689),
    "FI": (61.9241, 25.7482),
    "DK": (56.2639, 9.5018),
    "IE": (53.1424, -7.6921),
    "BE": (50.5039, 4.4699),
    "AT": (47.5162, 14.5501),
    "CZ": (49.8175, 15.4730),
    "RO": (45.9432, 24.9668),
    "HU": (47.1625, 19.5033),
    "GR": (39.0742, 21.8243),
    "PT": (39.3999, -8.2245),
    "BG": (42.7339, 25.4858),
    "IL": (31.0461, 34.8516),
    "AE": (23.4241, 53.8478),
    "SA": (23.8859, 45.0792),
    "NZ": (-40.9006, 174.8860),
    "MX": (23.6345, -102.5528),
    "AR": (-38.4161, -63.6167),
    "CL": (-35.6751, -71.5430),
    "CO": (4.5709, -74.2973),
    "ID": (-0.7893, 113.9213),
    "MY": (4.2105, 101.9758),
    "TH": (15.8700, 100.9925),
    "VN": (14.0583, 108.2772),
    "PH": (12.8797, 121.7740),
    "TW": (23.6978, 120.9605),
    "EG": (26.8206, 30.8025),
    "NG": (9.0820, 8.6753),
    "KE": (-0.0236, 37.9062),
    "PK": (30.3753, 69.3451),
    "BD": (23.6850, 90.3563),
    "IS": (64.9631, -19.0208),
    "LU": (49.8153, 6.1296),
    "EE": (58.5953, 25.0136),
    "LV": (56.8796, 24.6032),
    "LT": (55.1694, 23.8813),
    "SI": (46.1512, 14.9955),
    "SK": (48.6690, 19.6990),
    "HR": (45.1000, 15.2000),
    "RS": (44.0165, 21.0059),
    "CY": (35.1264, 33.4299),
    "QA": (25.3548, 51.1839),
    "KW": (29.3117, 47.4818),
    "OM": (21.5126, 55.9233),
    "BH": (26.0667, 50.5577),
    "JO": (30.5852, 36.2384),
    "LB": (33.8547, 35.8623),
    "KZ": (48.0196, 66.9237),
    "UZ": (41.3775, 64.5853),
    "AZ": (40.1431, 47.5769),
    "GE": (42.3154, 43.3569),
    "AM": (40.0691, 45.0382),
    "PE": (-9.1900, -75.0152),
    "VE": (6.4238, -66.5897),
    "EC": (-1.8312, -78.1834),
    "UY": (-32.5228, -55.7658),
    "PA": (8.5379, -80.7821),
    "CR": (9.7489, -83.7534),
    "MA": (31.7917, -7.0926),
    "TN": (33.8869, 9.5375),
    "DZ": (28.0339, 1.6596),
    "GH": (7.9465, -1.0232),
    "UG": (1.3733, 32.2903),
    "TZ": (-6.3690, 34.8888),
    "SN": (14.4974, -14.4524),
}

def get_country_coordinates(country_code: Optional[str]) -> Tuple[float, float]:
    """Return (lat, lon) centroid for 2-letter country code."""
    if not country_code:
        return (25.0, 10.0)
    code = country_code.upper().strip()
    return COUNTRY_COORDINATES.get(code, (25.0, 10.0))

def get_as_geo_coordinates(asn: int, country_code: Optional[str], index_in_country: int = 0) -> Tuple[float, float]:
    """
    Get deterministic lat/lon for an ASN within a country.
    Uses golden-angle dispersal so multiple ASNs in the same country
    do not overlap, creating a clear and readable visual cluster.
    """
    base_lat, base_lon = get_country_coordinates(country_code)
    if index_in_country == 0:
        return round(base_lat, 4), round(base_lon, 4)

    # Golden ratio angle offset
    angle = ((asn + index_in_country * 17) * 2.399963) % (2 * math.pi)
    # Radius in degrees: gentle spread around country centroid
    radius = min(3.8, 0.7 + 0.38 * (index_in_country ** 0.5))

    cos_lat = max(0.2, math.cos(math.radians(base_lat)))
    lat = base_lat + radius * math.sin(angle)
    lon = base_lon + (radius / cos_lat) * math.cos(angle)

    # Clamp to valid geographic bounds
    lat = max(-75.0, min(75.0, lat))
    lon = max(-175.0, min(175.0, lon))
    return round(lat, 4), round(lon, 4)

# Global Tier-1 Transit Providers (Default-free zone)
TIER1_ASNS = {
    174: {"name": "Cogent Communications", "country": "US", "tier": "Tier-1"},
    701: {"name": "Verizon (UUNET)", "country": "US", "tier": "Tier-1"},
    1239: {"name": "Sprint (T-Mobile)", "country": "US", "tier": "Tier-1"},
    1299: {"name": "Arelion (formerly Telia Carrier)", "country": "SE", "tier": "Tier-1"},
    2914: {"name": "NTT Communications", "country": "JP", "tier": "Tier-1"},
    3257: {"name": "GTT Communications", "country": "US", "tier": "Tier-1"},
    3320: {"name": "Deutsche Telekom", "country": "DE", "tier": "Tier-1"},
    3356: {"name": "Lumen (CenturyLink / Level 3)", "country": "US", "tier": "Tier-1"},
    5511: {"name": "Orange (Open Transit)", "country": "FR", "tier": "Tier-1"},
    6453: {"name": "Tata Communications", "country": "IN", "tier": "Tier-1"},
    6461: {"name": "Zayo Group (AboveNet)", "country": "US", "tier": "Tier-1"},
    6762: {"name": "Telecom Italia Sparkle", "country": "IT", "tier": "Tier-1"},
    6830: {"name": "Liberty Global", "country": "NL", "tier": "Tier-1"},
    7018: {"name": "AT&T Services", "country": "US", "tier": "Tier-1"},
    12956: {"name": "Telefonica Global Solutions", "country": "ES", "tier": "Tier-1"},
}

# Major Hyper-scalers, Content Providers, and Global CDNs
MAJOR_NETWORKS = {
    15169: {"name": "Google LLC", "country": "US", "tier": "Content / Hyperscale"},
    13335: {"name": "Cloudflare, Inc.", "country": "US", "tier": "Global CDN / Anycast"},
    16509: {"name": "Amazon Web Services (AWS)", "country": "US", "tier": "Cloud / Hyperscale"},
    8075: {"name": "Microsoft Corporation", "country": "US", "tier": "Cloud / Hyperscale"},
    32934: {"name": "Meta (Facebook)", "country": "US", "tier": "Content / Hyperscale"},
    20940: {"name": "Akamai Technologies", "country": "US", "tier": "Global CDN"},
    54113: {"name": "Fastly", "country": "US", "tier": "Global CDN"},
    6939: {"name": "Hurricane Electric", "country": "US", "tier": "Major Transit / IPv6 Backbone"},
    9002: {"name": "RETN", "country": "GB", "tier": "International Transit"},
    46484: {"name": "OVHcloud", "country": "FR", "tier": "Cloud / Hosting"},
    24940: {"name": "Hetzner Online GmbH", "country": "DE", "tier": "Hosting / Cloud"},
    19281: {"name": "Quad9 Anycast DNS", "country": "CH", "tier": "Anycast DNS"},
    36692: {"name": "Cisco OpenDNS", "country": "US", "tier": "Anycast DNS"},
    2635: {"name": "Automattic / WordPress", "country": "US", "tier": "Content"},
    714: {"name": "Apple Inc.", "country": "US", "tier": "Enterprise / Hyperscale"},
    37963: {"name": "Alibaba Cloud", "country": "CN", "tier": "Cloud / Hyperscale"},
    45102: {"name": "Alibaba Cloud US", "country": "US", "tier": "Cloud / Hyperscale"},
    13238: {"name": "Yandex LLC", "country": "RU", "tier": "Content / Search"},
    22822: {"name": "Limelight Networks (Edgio)", "country": "US", "tier": "Global CDN"},
    12880: {"name": "DCI / TIC Iran Telecom", "country": "IR", "tier": "National Transit"},
    44244: {"name": "MTN Irancell", "country": "IR", "tier": "Major Mobile Operator"},
    197207: {"name": "MCI (Mobile Telecommunication Iran)", "country": "IR", "tier": "Major Mobile Operator"},
    48159: {"name": "TCI (Telecommunication Company of Iran)", "country": "IR", "tier": "National Telco"},
    56429: {"name": "TIC (Telecommunication Infrastructure Co)", "country": "IR", "tier": "National Gateway"}
}

# Curated Representative IPs for Instant City-level Geolocation
KNOWN_ASN_REPRESENTATIVE_IPS: Dict[int, str] = {
    174: "154.54.38.1",       # Cogent
    701: "152.179.0.1",       # Verizon UUNET
    1239: "144.232.0.1",      # Sprint
    1299: "62.115.1.1",       # Arelion (Sweden / Europe)
    2914: "129.250.0.1",      # NTT Communications (Tokyo / Global)
    3257: "213.200.64.1",     # GTT Communications
    3320: "194.25.0.1",       # Deutsche Telekom (Frankfurt, DE)
    3356: "4.69.130.1",       # Lumen / CenturyLink / Level 3
    5511: "193.251.128.1",    # Orange OpenTransit (Paris, FR)
    6453: "216.6.99.1",       # Tata Communications (Mumbai, IN)
    6461: "64.125.0.1",       # Zayo Group (Denver / New York, US)
    6762: "213.144.176.1",    # Telecom Italia Sparkle (Rome, IT)
    6830: "213.46.160.1",     # Liberty Global (Amsterdam, NL)
    7018: "12.122.0.1",       # AT&T Services (Dallas / Atlanta, US)
    12956: "213.140.32.1",    # Telefonica Global Solutions (Madrid, ES)
    15169: "8.8.8.8",         # Google LLC (Mountain View / Ashburn, US)
    13335: "1.1.1.1",         # Cloudflare, Inc. (San Francisco / Global)
    16509: "52.95.110.1",     # Amazon AWS (Seattle / Ashburn, US)
    8075: "20.190.128.1",     # Microsoft (Redmond / Chicago, US)
    32934: "157.240.0.1",     # Meta (Menlo Park, US)
    20940: "23.32.0.1",       # Akamai Technologies (Cambridge, US)
    54113: "151.101.1.1",     # Fastly (San Francisco, US)
    6939: "216.218.0.1",      # Hurricane Electric (Fremont, US)
    9002: "87.245.224.1",     # RETN (London, GB)
    46484: "198.27.64.1",     # OVHcloud (Roubaix / Montreal)
    24940: "91.190.240.1",    # Hetzner Online (Nuremberg / Falkenstein, DE)
    19281: "9.9.9.9",         # Quad9 (Zurich, CH)
    36692: "208.67.222.222",  # Cisco OpenDNS (San Francisco, US)
    2635: "192.0.64.1",       # Automattic (San Francisco, US)
    714: "17.253.144.1",      # Apple Inc. (Cupertino, US)
    37963: "47.74.0.1",       # Alibaba Cloud (Hangzhou, CN)
    45102: "47.88.0.1",       # Alibaba Cloud US
    13238: "77.88.8.8",       # Yandex (Moscow, RU)
    22822: "68.142.64.1",     # Edgio (Tempe, US)
    12880: "5.200.0.1",       # TIC Iran
    44244: "185.143.232.1",   # MTN Irancell (Tehran, IR)
    197207: "188.253.0.1",    # MCI (Tehran, IR)
    48159: "2.144.0.1",       # TCI (Tehran, IR)
    56429: "178.252.0.1"      # TIC Infrastructure (Tehran, IR)
}

def get_known_representative_ip(asn: int) -> Optional[str]:
    """Retrieve curated representative IP address for an ASN."""
    return KNOWN_ASN_REPRESENTATIVE_IPS.get(asn)

# Unicode Flag converter
def country_code_to_flag(code: Optional[str]) -> str:
    """Convert 2-letter ISO country code into emoji flag."""
    if not code or len(code) != 2:
        return "🌐"
    code = code.upper()
    try:
        # Regional indicator symbols: A is 127462, etc.
        flag = "".join(chr(127397 + ord(c)) for c in code)
        return flag
    except Exception:
        return "🌐"

def get_known_as_info(asn: int) -> Optional[Dict[str, Any]]:
    """Look up known ASN in our curated registry."""
    if asn in TIER1_ASNS:
        item = TIER1_ASNS[asn]
        return {
            "asn": asn,
            "name": item["name"],
            "country": item["country"],
            "flag": country_code_to_flag(item["country"]),
            "tier": item["tier"],
            "is_tier1": True,
        }
    if asn in MAJOR_NETWORKS:
        item = MAJOR_NETWORKS[asn]
        return {
            "asn": asn,
            "name": item["name"],
            "country": item["country"],
            "flag": country_code_to_flag(item["country"]),
            "tier": item["tier"],
            "is_tier1": False,
        }
    return None
