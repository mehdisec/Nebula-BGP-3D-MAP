from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class NodeModel(BaseModel):
    id: str
    asn: int
    name: str
    country: str = "US"
    flag: str = "🌐"
    depth: int = 0
    tier: str = "Transit / Peer"
    is_tier1: bool = False
    is_target: bool = False
    peer_count: int = 0
    prefixes_count: int = 0
    sample_prefixes: List[str] = Field(default_factory=list)
    type: str = "peer"
    # Precomputed 3D radial coordinates
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None

class LinkModel(BaseModel):
    source: str
    target: str
    relationship: str = "peer"
    power: int = 1
    depth: int = 1

class GraphModel(BaseModel):
    nodes: List[NodeModel]
    links: List[LinkModel]
    max_depth: int
    total_nodes: int
    total_links: int

class WhoisField(BaseModel):
    key: str
    value: str

class WhoisRecord(BaseModel):
    title: str
    fields: List[WhoisField]

class WhoisData(BaseModel):
    ip_whois: List[WhoisRecord] = Field(default_factory=list)
    asn_whois: List[WhoisRecord] = Field(default_factory=list)
    raw_text: Optional[str] = None
    abuse_emails: List[str] = Field(default_factory=list)
    org_name: Optional[str] = None
    country: Optional[str] = None
    registry: Optional[str] = None
    registration_date: Optional[str] = None

class IPMetadata(BaseModel):
    ip: str
    version: int
    hostname: Optional[str] = None
    prefix: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    flag: str = "🌐"
    lat: Optional[float] = None
    lon: Optional[float] = None
    timezone: Optional[str] = None
    isp: Optional[str] = None
    org: Optional[str] = None
    asn: int
    as_name: str
    registry: Optional[str] = None

class ASNMetadata(BaseModel):
    asn: int
    name: str
    holder: Optional[str] = None
    country: Optional[str] = None
    flag: str = "🌐"
    tier: str = "Transit / Peer"
    is_tier1: bool = False
    announced: bool = True
    prefixes_count: int = 0
    sample_prefixes: List[str] = Field(default_factory=list)
    peer_count: int = 0
    registry: Optional[str] = None
    allocation_date: Optional[str] = None
    rdap_url: Optional[str] = None

class LookingGlassPath(BaseModel):
    collector: str
    peer_ip: str
    as_path: List[int]
    path_str: str
    length: int
    prefix: str

class BGPTraceResponse(BaseModel):
    target_ip: str
    origin_asn: int
    ip_metadata: IPMetadata
    asn_metadata: ASNMetadata
    whois: WhoisData
    graph: GraphModel
    looking_glass_paths: List[LookingGlassPath] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
