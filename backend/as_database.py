"""
Database of known Autonomous System (AS) networks, Tier-1 backbones,
hyper-scalers, CDNs, and helper functions for metadata enrichment.
"""

from typing import Dict, Any, Optional

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
}

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
