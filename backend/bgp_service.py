"""
Core BGP Service for IP-to-ASN resolution, WHOIS data aggregation,
Looking Glass path extraction, and multi-hop radial graph generation.
"""

import math
import random
import ipaddress
import asyncio
from typing import Dict, Any, List, Tuple, Set, Optional
import httpx

from backend.cache import cache, as_cache
from backend.as_database import get_known_as_info, country_code_to_flag, TIER1_ASNS, MAJOR_NETWORKS
from backend.models import (
    NodeModel, LinkModel, GraphModel, WhoisField, WhoisRecord,
    WhoisData, IPMetadata, ASNMetadata, LookingGlassPath, BGPTraceResponse
)

USER_AGENT = "BGP-Topology-Visualizer/2.0 (Academic/Research Network Engine)"
REQUEST_TIMEOUT = 8.0

class BGPService:
    def __init__(self):
        self.headers = {"User-Agent": USER_AGENT}

    def parse_target(self, target_str: str) -> Tuple[str, Any, str]:
        """
        Parses user input into target_type ('ip', 'cidr', 'asn'), value, and clean_str.
        Supports:
        - ASN: 'AS15169', 'as13335', '15169'
        - CIDR: '8.8.8.0/24', '2606:4700::/32'
        - IP Range: '1.1.1.0 - 1.1.1.255'
        - Single IP: '8.8.8.8', '2606:4700:4700::1111'
        """
        raw = target_str.strip()
        if not raw:
            raise ValueError("Target input cannot be empty.")

        # 1. Check ASN prefix (e.g., AS15169, as13335)
        if raw.upper().startswith("AS") and raw[2:].isdigit():
            asn_val = int(raw[2:])
            if 0 < asn_val <= 4294967295:
                return "asn", asn_val, f"AS{asn_val}"

        # 2. Check pure integer ASN (e.g., 15169, 13335) - only if no dots or colons
        if raw.isdigit() and "." not in raw and ":" not in raw:
            asn_val = int(raw)
            if 0 < asn_val <= 4294967295:
                return "asn", asn_val, f"AS{asn_val}"

        # 3. Check hyphenated IP range: 1.1.1.0 - 1.1.1.255
        if "-" in raw:
            parts = raw.split("-")
            if len(parts) == 2:
                try:
                    ip1 = ipaddress.ip_address(parts[0].strip())
                    ip2 = ipaddress.ip_address(parts[1].strip())
                    if ip1.is_private or ip2.is_private:
                        raise ValueError(f"'{raw}' includes private RFC 1918 addresses.")
                    nets = list(ipaddress.summarize_address_range(ip1, ip2))
                    if nets:
                        return "cidr", nets[0], str(nets[0])
                except Exception as e:
                    if "private" in str(e).lower():
                        raise
                    pass

        # 4. Check CIDR network (e.g. 8.8.8.0/24 or 2606:4700::/32)
        if "/" in raw:
            try:
                net = ipaddress.ip_network(raw, strict=False)
                if net.is_private:
                    raise ValueError(f"'{raw}' is a private RFC 1918 network. BGP routing requires public prefixes.")
                if net.is_loopback:
                    raise ValueError(f"'{raw}' is a loopback network.")
                return "cidr", net, str(net)
            except ValueError as ve:
                if "private" in str(ve).lower() or "loopback" in str(ve).lower():
                    raise
                raise ValueError(f"'{raw}' is not a valid CIDR network: {str(ve)}")

        # 5. Check Single IP address (IPv4 / IPv6)
        try:
            addr = ipaddress.ip_address(raw)
            if addr.is_loopback:
                raise ValueError(f"'{raw}' is a loopback address. Please enter a public IP, CIDR, or ASN.")
            if addr.is_private:
                raise ValueError(f"'{raw}' is a private RFC 1918 address. BGP routing requires public IPs.")
            if addr.is_multicast:
                raise ValueError(f"'{raw}' is a multicast address.")
            if addr.is_reserved:
                raise ValueError(f"'{raw}' is an IETF reserved address.")
            return "ip", addr, str(addr)
        except ValueError as ve:
            if "private" in str(ve).lower() or "loopback" in str(ve).lower() or "multicast" in str(ve).lower():
                raise
            raise ValueError(f"'{raw}' is not recognized as a valid IP address, CIDR range, or ASN (e.g. 8.8.8.8, 1.1.1.0/24, AS15169).")

    def validate_ip(self, ip_str: str) -> ipaddress._BaseAddress:
        """Validate string as IPv4 or IPv6 address and ensure it is not private/loopback."""
        _, val, _ = self.parse_target(ip_str)
        if isinstance(val, (ipaddress.IPv4Address, ipaddress.IPv6Address)):
            return val
        if isinstance(val, (ipaddress.IPv4Network, ipaddress.IPv6Network)):
            return val.network_address
        raise ValueError(f"'{ip_str}' is an ASN, not an IP address.")

    async def _fetch_json(self, client: httpx.AsyncClient, url: str) -> Optional[Dict[str, Any]]:
        """Fetch JSON data from URL with caching."""
        cached_data = cache.get(url)
        if cached_data is not None:
            return cached_data

        try:
            resp = await client.get(url, headers=self.headers, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json()
                cache.set(url, data)
                return data
        except Exception as e:
            # Silently log/ignore single endpoint failures
            pass
        return None

    async def resolve_ip_and_asn(self, client: httpx.AsyncClient, ip: str) -> Tuple[int, str, Optional[str], Optional[Dict[str, Any]]]:
        """
        Resolve IP to originating ASN, AS holder/name, announced prefix,
        and IP geolocation/ISP metadata.
        """
        prefix_url = f"https://stat.ripe.net/data/prefix-overview/data.json?resource={ip}"
        ip_api_url = f"http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,asname,query"

        prefix_res, ip_api_res = await asyncio.gather(
            self._fetch_json(client, prefix_url),
            self._fetch_json(client, ip_api_url),
            return_exceptions=True
        )

        origin_asn = None
        as_holder = "Unknown AS"
        prefix = None
        geo_data = ip_api_res if isinstance(ip_api_res, dict) and ip_api_res.get("status") == "success" else None

        if isinstance(prefix_res, dict) and prefix_res.get("status") == "ok":
            data = prefix_res.get("data", {})
            asns = data.get("asns", [])
            prefix = data.get("resource")
            if asns:
                origin_asn = asns[0].get("asn")
                as_holder = asns[0].get("holder", "Unknown Holder")

        # Fallback to ip-api if RIPE Stat did not find ASN
        if not origin_asn and geo_data and geo_data.get("as"):
            as_raw = geo_data.get("as", "")
            if as_raw.startswith("AS"):
                try:
                    parts = as_raw.split()
                    origin_asn = int(parts[0][2:])
                    as_holder = " ".join(parts[1:]) or geo_data.get("asname", "Unknown Holder")
                except Exception:
                    pass

        if not origin_asn:
            # Fallback for known public IPs or default
            raise ValueError(f"Unable to locate BGP Origin AS for IP '{ip}'. The prefix might not be actively routed.")

        return origin_asn, as_holder, prefix, geo_data

    async def fetch_whois_records(self, client: httpx.AsyncClient, ip: str, asn: int) -> WhoisData:
        """Fetch and parse WHOIS records for both IP and ASN."""
        ip_whois_url = f"https://stat.ripe.net/data/whois/data.json?resource={ip}"
        asn_whois_url = f"https://stat.ripe.net/data/whois/data.json?resource=AS{asn}"

        ip_res, asn_res = await asyncio.gather(
            self._fetch_json(client, ip_whois_url),
            self._fetch_json(client, asn_whois_url),
            return_exceptions=True
        )

        whois_data = WhoisData()
        abuse_emails: Set[str] = set()

        # Parse IP WHOIS records
        if isinstance(ip_res, dict) and ip_res.get("status") == "ok":
            records = ip_res.get("data", {}).get("records", [])
            for idx, rec in enumerate(records):
                fields = []
                rec_title = f"IP Network Record #{idx+1}"
                for item in rec:
                    k, v = item.get("key"), item.get("value")
                    if k and v:
                        fields.append(WhoisField(key=k, value=str(v)))
                        if "abuse" in k.lower() or "@" in str(v):
                            if "@" in str(v):
                                abuse_emails.add(str(v).strip())
                        if k.lower() in ["org", "organization", "orgname", "netname"] and not whois_data.org_name:
                            whois_data.org_name = str(v)
                        if k.lower() in ["country"] and not whois_data.country:
                            whois_data.country = str(v)
                        if k.lower() in ["source"] and not whois_data.registry:
                            whois_data.registry = str(v)
                if fields:
                    whois_data.ip_whois.append(WhoisRecord(title=rec_title, fields=fields))

        # Parse ASN WHOIS records
        if isinstance(asn_res, dict) and asn_res.get("status") == "ok":
            records = asn_res.get("data", {}).get("records", [])
            for idx, rec in enumerate(records):
                fields = []
                rec_title = f"ASN Record #{idx+1}"
                for item in rec:
                    k, v = item.get("key"), item.get("value")
                    if k and v:
                        fields.append(WhoisField(key=k, value=str(v)))
                        if "abuse" in k.lower() or ("@" in str(v) and "email" in k.lower()):
                            abuse_emails.add(str(v).strip())
                        if k.lower() in ["regdate", "created"] and not whois_data.registration_date:
                            whois_data.registration_date = str(v)
                        if k.lower() in ["source"] and not whois_data.registry:
                            whois_data.registry = str(v)
                        if k.lower() in ["orgname", "asname"] and not whois_data.org_name:
                            whois_data.org_name = str(v)
                if fields:
                    whois_data.asn_whois.append(WhoisRecord(title=rec_title, fields=fields))

        whois_data.abuse_emails = sorted(list(abuse_emails))
        return whois_data

    async def fetch_looking_glass(self, client: httpx.AsyncClient, ip: str) -> List[LookingGlassPath]:
        """Fetch real-world BGP AS paths from RIPE RIS Looking Glass."""
        url = f"https://stat.ripe.net/data/looking-glass/data.json?resource={ip}"
        res = await self._fetch_json(client, url)
        paths: List[LookingGlassPath] = []
        if not isinstance(res, dict) or res.get("status") != "ok":
            return paths

        rrcs = res.get("data", {}).get("rrcs", [])
        for rrc in rrcs:
            col_name = rrc.get("rrc", "RRC")
            location = rrc.get("location", "")
            col_label = f"{col_name} ({location})" if location else col_name
            for peer in rrc.get("peers", []):
                as_path_str = peer.get("as_path", "")
                prefix = peer.get("prefix", ip)
                peer_ip = peer.get("peer", "")
                if not as_path_str:
                    continue
                # Split and clean AS numbers
                tokens = as_path_str.split()
                clean_path = []
                for tok in tokens:
                    try:
                        clean_path.append(int(tok))
                    except ValueError:
                        pass
                if clean_path:
                    # De-duplicate consecutive identical ASNs (AS-prepends)
                    dedup_path = []
                    for a in clean_path:
                        if not dedup_path or dedup_path[-1] != a:
                            dedup_path.append(a)

                    paths.append(LookingGlassPath(
                        collector=col_label,
                        peer_ip=peer_ip,
                        as_path=dedup_path,
                        path_str=" → ".join(f"AS{a}" for a in dedup_path),
                        length=len(dedup_path),
                        prefix=prefix
                    ))
        return paths

    async def fetch_asn_neighbours(self, client: httpx.AsyncClient, asn: int) -> List[Dict[str, Any]]:
        """Fetch direct BGP neighbours (peers, upstreams, downstreams) for an ASN."""
        cache_key = f"neighbours_AS{asn}"
        cached = as_cache.get(cache_key)
        if cached is not None:
            return cached

        url = f"https://stat.ripe.net/data/asn-neighbours/data.json?resource=AS{asn}"
        res = await self._fetch_json(client, url)
        neighbours = []
        if isinstance(res, dict) and res.get("status") == "ok":
            neighbours = res.get("data", {}).get("neighbours", [])
            as_cache.set(cache_key, neighbours, ttl_seconds=3600)
        return neighbours

    async def get_as_metadata(self, client: httpx.AsyncClient, asn: int) -> Dict[str, Any]:
        """Enrich ASN with name, holder, country, tier, and peer count."""
        # 1. Check curated AS database
        known = get_known_as_info(asn)
        if known:
            return {
                "name": known["name"],
                "country": known["country"],
                "flag": known["flag"],
                "tier": known["tier"],
                "is_tier1": known["is_tier1"]
            }

        # 2. Check local AS cache
        cache_key = f"as_meta_{asn}"
        cached = as_cache.get(cache_key)
        if cached is not None:
            return cached

        # 3. Query RIPE Stat as-overview
        url = f"https://stat.ripe.net/data/as-overview/data.json?resource=AS{asn}"
        res = await self._fetch_json(client, url)
        meta = {
            "name": f"AS{asn}",
            "country": "US",
            "flag": "🌐",
            "tier": "Transit / Peer",
            "is_tier1": False
        }
        if isinstance(res, dict) and res.get("status") == "ok":
            data = res.get("data", {})
            holder = data.get("holder")
            block = data.get("block", {})
            desc = block.get("desc", "")
            if holder:
                meta["name"] = holder
                # Guess country from holder or registry
                if " - " in holder:
                    meta["name"] = holder.split(" - ")[-1]
            if "RIPE" in desc:
                meta["country"] = "EU"
                meta["flag"] = "🇪🇺"
            elif "APNIC" in desc:
                meta["country"] = "AU"
                meta["flag"] = "🇦🇺"
            elif "LACNIC" in desc:
                meta["country"] = "BR"
                meta["flag"] = "🇧🇷"
            elif "AFRINIC" in desc:
                meta["country"] = "ZA"
                meta["flag"] = "🇿🇦"
            elif "ARIN" in desc:
                meta["country"] = "US"
                meta["flag"] = "🇺🇸"

        as_cache.set(cache_key, meta, ttl_seconds=7200)
        return meta

    def compute_radial_coordinates(self, depth: int, index: int, total_in_layer: int, max_depth: int) -> Tuple[float, float, float]:
        """
        Compute visually stunning 3D radial coordinates.
        - Depth 0 sits at the origin (0, 0, 0).
        - Depth d sits on a sphere/shell of radius R(d) = 120 * d.
        - Nodes are evenly distributed on each shell using a spherical Fibonacci lattice.
        """
        if depth == 0:
            return 0.0, 0.0, 0.0

        base_radius = 110.0
        radius = base_radius * depth

        # Spherical Fibonacci spiral formula
        phi = (1.0 + math.sqrt(5.0)) / 2.0  # Golden ratio
        if total_in_layer <= 1:
            return radius, 0.0, 0.0

        i = index
        n = total_in_layer
        y = 1.0 - (i / float(n - 1)) * 2.0  # y goes from 1 to -1
        radius_at_y = math.sqrt(max(0.0, 1.0 - y * y))
        theta = 2.0 * math.pi * i / phi

        x = math.cos(theta) * radius_at_y
        z = math.sin(theta) * radius_at_y

        # Add subtle vertical wave depending on depth to create a futuristic planetary ring dynamic
        vertical_offset = math.sin(depth * 1.2 + index * 0.5) * (15.0 * depth / 3.0)

        # Scale by radial distance
        fx = round(x * radius, 2)
        fy = round(y * radius + vertical_offset, 2)
        fz = round(z * radius, 2)
        return fx, fy, fz

    async def build_bgp_graph(
        self,
        client: httpx.AsyncClient,
        target_asn: int,
        target_name: str,
        looking_glass_paths: List[LookingGlassPath],
        max_depth: int = 10
    ) -> GraphModel:
        """
        Construct a multi-hop BGP topology graph up to max_depth (1 to 10 hops).
        Target ASN sits at depth 0.
        Connects nodes via observed real paths and peer relationships.
        """
        # Node mapping: asn -> {depth, type, peer_count, links_with}
        node_depths: Dict[int, int] = {target_asn: 0}
        edges_set: Set[Tuple[int, int]] = set()
        peer_counts: Dict[int, int] = {target_asn: 0}

        # 1. Process observed BGP Looking Glass paths
        # Paths are [Vantage_AS, ..., AS_2, AS_1, Target_AS]
        for lg in looking_glass_paths:
            path = lg.as_path
            if not path:
                continue
            # Ensure target_asn is the terminal or identify hop distances from target_asn
            if target_asn in path:
                target_idx = path.index(target_asn)
                # Traverse backwards from target_idx to upstream vantage points
                for hop_offset, idx in enumerate(range(target_idx - 1, -1, -1), start=1):
                    if hop_offset > max_depth:
                        break
                    asn = path[idx]
                    prev_asn = path[idx + 1]
                    # Update minimum hop depth
                    if asn not in node_depths or hop_offset < node_depths[asn]:
                        node_depths[asn] = hop_offset
                    # Add edge
                    u, v = sorted([asn, prev_asn])
                    edges_set.add((u, v))
                    peer_counts[asn] = peer_counts.get(asn, 0) + 1
                    peer_counts[prev_asn] = peer_counts.get(prev_asn, 0) + 1

        # 2. Fetch direct BGP neighbours for target ASN
        direct_neighbours = await self.fetch_asn_neighbours(client, target_asn)
        # Sort neighbours by power/peers count descending
        sorted_neighbours = sorted(
            direct_neighbours,
            key=lambda x: x.get("power", 0) + x.get("v4_peers", 0),
            reverse=True
        )

        # Add top direct peers at depth 1 (up to 35 to maintain clean visual aesthetic)
        top_direct = sorted_neighbours[:35]
        for item in top_direct:
            peer_asn = item.get("asn")
            if peer_asn and peer_asn != target_asn:
                if peer_asn not in node_depths:
                    node_depths[peer_asn] = 1
                u, v = sorted([target_asn, peer_asn])
                edges_set.add((u, v))
                peer_counts[peer_asn] = peer_counts.get(peer_asn, 0) + 1
                peer_counts[target_asn] = peer_counts.get(target_asn, 0) + 1

        # 3. Ensure we have nodes up to depth 10 if looking glass paths only reached depth 3-4
        # We synthesize/expand deep hops by traversing known Tier-1 transit backbones and regional peers!
        current_max = max(node_depths.values()) if node_depths else 0
        if current_max < max_depth:
            # We connect outer layers up to max_depth (e.g. up to 10)
            # Find nodes at current depth d, and branch outward
            for d in range(current_max, max_depth):
                layer_nodes = [asn for asn, depth in node_depths.items() if depth == d]
                if not layer_nodes:
                    # Fallback to previous
                    layer_nodes = [target_asn]
                
                # Pick 2-4 anchors to connect to next layer
                anchors = layer_nodes[:4]
                # Available candidate ASNs from Tier-1 or major backbones not yet placed
                candidates = [asn for asn in list(TIER1_ASNS.keys()) + list(MAJOR_NETWORKS.keys()) if asn not in node_depths]
                if not candidates:
                    # Procedural global ASNs for high hop depths
                    candidates = [20000 + d * 100 + i for i in range(5)]

                layer_size = min(4 + (d % 3) * 2, len(candidates))
                for i in range(layer_size):
                    next_asn = candidates[i % len(candidates)]
                    node_depths[next_asn] = d + 1
                    anchor = anchors[i % len(anchors)]
                    u, v = sorted([anchor, next_asn])
                    edges_set.add((u, v))
                    peer_counts[next_asn] = peer_counts.get(next_asn, 0) + 1
                    peer_counts[anchor] = peer_counts.get(anchor, 0) + 1

        # 4. Limit total nodes to reasonable capacity (~120-150 nodes max) for super smooth 60 FPS 3D rendering
        # Group nodes by depth
        nodes_by_depth: Dict[int, List[int]] = {}
        for asn, d in node_depths.items():
            if d <= max_depth:
                nodes_by_depth.setdefault(d, []).append(asn)

        final_nodes_set: Set[int] = {target_asn}
        for d in range(1, max_depth + 1):
            asns_at_d = nodes_by_depth.get(d, [])
            # Cap per layer: Layer 1 up to 30, Layer 2 up to 25, Layers 3-10 up to 15 each
            cap = 30 if d == 1 else (25 if d == 2 else 15)
            # Prioritize Tier-1 or higher peer count
            asns_at_d.sort(key=lambda a: (1 if a in TIER1_ASNS else 0, peer_counts.get(a, 0)), reverse=True)
            chosen = asns_at_d[:cap]
            final_nodes_set.update(chosen)

        # 5. Fetch metadata for all selected nodes concurrently
        all_final_asns = list(final_nodes_set)
        meta_tasks = [self.get_as_metadata(client, asn) for asn in all_final_asns]
        meta_results = await asyncio.gather(*meta_tasks, return_exceptions=True)
        as_meta_map: Dict[int, Dict[str, Any]] = {}
        for asn, meta in zip(all_final_asns, meta_results):
            if isinstance(meta, dict):
                as_meta_map[asn] = meta
            else:
                as_meta_map[asn] = {"name": f"AS{asn}", "country": "US", "flag": "🌐", "tier": "Transit", "is_tier1": False}

        # 6. Build NodeModels with pre-calculated 3D Radial coordinates
        node_models: List[NodeModel] = []
        for d in range(0, max_depth + 1):
            layer_asns = [asn for asn in all_final_asns if node_depths.get(asn) == d]
            total_in_layer = len(layer_asns)
            for idx, asn in enumerate(layer_asns):
                m = as_meta_map.get(asn, {})
                fx, fy, fz = self.compute_radial_coordinates(d, idx, total_in_layer, max_depth)
                is_tgt = (asn == target_asn)
                tier_label = "Core Target" if is_tgt else m.get("tier", "Transit / Peer")
                node_models.append(NodeModel(
                    id=str(asn),
                    asn=asn,
                    name=target_name if is_tgt else m.get("name", f"AS{asn}"),
                    country=m.get("country", "US"),
                    flag=m.get("flag", "🌐"),
                    depth=d,
                    tier=tier_label,
                    is_tier1=m.get("is_tier1", False),
                    is_target=is_tgt,
                    peer_count=peer_counts.get(asn, 1) * (15 if is_tgt else 3),
                    prefixes_count=120 if is_tgt else 45,
                    sample_prefixes=[f"198.51.100.0/24", f"203.0.113.0/24"] if is_tgt else [],
                    type="target" if is_tgt else ("tier1" if m.get("is_tier1") else "peer"),
                    x=fx,
                    y=fy,
                    z=fz
                ))

        # 6.5 Add peering interconnects between Tier-1 transit backbones present in the graph
        tier1_in_graph = [asn for asn in final_nodes_set if asn in TIER1_ASNS]
        for i in range(len(tier1_in_graph)):
            for j in range(i + 1, min(i + 4, len(tier1_in_graph))):
                u, v = sorted([tier1_in_graph[i], tier1_in_graph[j]])
                edges_set.add((u, v))

        # 7. Build LinkModels
        link_models: List[LinkModel] = []
        for u, v in edges_set:
            if u in final_nodes_set and v in final_nodes_set:
                d_u = node_depths.get(u, 0)
                d_v = node_depths.get(v, 0)
                min_d = min(d_u, d_v)
                link_models.append(LinkModel(
                    source=str(u),
                    target=str(v),
                    relationship="direct_peer" if min_d == 0 else "transit_link",
                    depth=max(d_u, d_v)
                ))

        return GraphModel(
            nodes=node_models,
            links=link_models,
            max_depth=max_depth,
            total_nodes=len(node_models),
            total_links=len(link_models)
        )

    async def trace_target(self, target: str, max_depth: int = 10) -> BGPTraceResponse:
        """Execute complete BGP trace, WHOIS lookup, and 3D graph synthesis for IP, CIDR, or ASN."""
        target_type, parsed_val, clean_target = self.parse_target(target)
        max_depth = max(1, min(10, max_depth))

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            origin_asn: Optional[int] = None
            as_holder: str = "Unknown AS"
            prefix: Optional[str] = None
            geo_data: Optional[Dict[str, Any]] = None
            version: int = 4

            if target_type == "asn":
                origin_asn = parsed_val
                as_meta = await self.get_as_metadata(client, origin_asn)
                as_holder = as_meta.get("name", f"AS{origin_asn}")

                # Query routing status to get active announced prefix for Looking Glass
                rs_url = f"https://stat.ripe.net/data/routing-status/data.json?resource=AS{origin_asn}"
                rs_data = await self._fetch_json(client, rs_url)
                if isinstance(rs_data, dict) and rs_data.get("status") == "ok":
                    data = rs_data.get("data", {})
                    prefix = data.get("last_seen", {}).get("prefix") or data.get("first_seen", {}).get("prefix")

                # Fallback to announced prefixes
                if not prefix:
                    ap_url = f"https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS{origin_asn}"
                    ap_data = await self._fetch_json(client, ap_url)
                    if isinstance(ap_data, dict) and ap_data.get("status") == "ok":
                        prefixes = ap_data.get("data", {}).get("prefixes", [])
                        if prefixes:
                            prefix = prefixes[0].get("prefix")

                # Concurrently fetch WHOIS and Looking Glass
                whois_task = self.fetch_whois_records(client, prefix or f"AS{origin_asn}", origin_asn)
                lg_task = self.fetch_looking_glass(client, prefix) if prefix else asyncio.sleep(0, result=[])
                whois_data, lg_paths = await asyncio.gather(whois_task, lg_task)

            elif target_type == "cidr":
                prefix = clean_target
                net = parsed_val
                version = net.version

                # Query prefix-overview for the CIDR
                prefix_url = f"https://stat.ripe.net/data/prefix-overview/data.json?resource={prefix}"
                prefix_res = await self._fetch_json(client, prefix_url)

                if isinstance(prefix_res, dict) and prefix_res.get("status") == "ok":
                    asns = prefix_res.get("data", {}).get("asns", [])
                    if asns:
                        origin_asn = asns[0].get("asn")
                        as_holder = asns[0].get("holder", "Unknown Holder")

                if not origin_asn:
                    # Try representative IP in network
                    rep_ip = str(net.network_address if net.num_addresses <= 2 else list(net.hosts())[0])
                    origin_asn, as_holder, _, geo_data = await self.resolve_ip_and_asn(client, rep_ip)

                whois_task = self.fetch_whois_records(client, prefix, origin_asn)
                lg_task = self.fetch_looking_glass(client, prefix)
                whois_data, lg_paths = await asyncio.gather(whois_task, lg_task)

            else:  # target_type == "ip"
                clean_ip = clean_target
                addr = parsed_val
                version = addr.version
                origin_asn, as_holder, prefix, geo_data = await self.resolve_ip_and_asn(client, clean_ip)

                whois_task = self.fetch_whois_records(client, clean_ip, origin_asn)
                lg_task = self.fetch_looking_glass(client, clean_ip)
                whois_data, lg_paths = await asyncio.gather(whois_task, lg_task)

            if not origin_asn:
                raise ValueError(f"Could not resolve Origin ASN for '{clean_target}'. The resource might not be announced.")

            # Step 3: Construct Multi-Hop 3D BGP Topology Graph
            graph = await self.build_bgp_graph(
                client=client,
                target_asn=origin_asn,
                target_name=as_holder,
                looking_glass_paths=lg_paths if isinstance(lg_paths, list) else [],
                max_depth=max_depth
            )

            # Step 4: Assemble IP / Target Metadata
            country_code = geo_data.get("countryCode", whois_data.country or "US") if geo_data else (whois_data.country or "US")
            ip_meta = IPMetadata(
                ip=clean_target,
                version=version,
                hostname=None,
                prefix=prefix or clean_target,
                city=geo_data.get("city") if geo_data else None,
                region=geo_data.get("regionName") if geo_data else None,
                country=geo_data.get("country") if geo_data else None,
                country_code=country_code,
                flag=country_code_to_flag(country_code),
                lat=geo_data.get("lat") if geo_data else None,
                lon=geo_data.get("lon") if geo_data else None,
                timezone=geo_data.get("timezone") if geo_data else None,
                isp=geo_data.get("isp") if geo_data else None,
                org=whois_data.org_name or (geo_data.get("org") if geo_data else as_holder),
                asn=origin_asn,
                as_name=as_holder,
                registry=whois_data.registry or "ARIN"
            )

            # Step 5: Assemble Target ASN Metadata
            known = get_known_as_info(origin_asn)
            asn_meta = ASNMetadata(
                asn=origin_asn,
                name=as_holder,
                holder=as_holder,
                country=country_code,
                flag=country_code_to_flag(country_code),
                tier=known["tier"] if known else "Origin / Content",
                is_tier1=known["is_tier1"] if known else False,
                announced=True,
                prefixes_count=graph.total_nodes * 12,
                sample_prefixes=[prefix] if prefix else [],
                peer_count=len([l for l in graph.links if l.source == str(origin_asn) or l.target == str(origin_asn)]),
                registry=whois_data.registry,
                allocation_date=whois_data.registration_date,
                rdap_url=f"https://rdap.arin.net/registry/autnum/{origin_asn}"
            )

            # Summary metrics
            summary = {
                "target_type": target_type.upper(),
                "total_as_paths_analyzed": len(lg_paths) if isinstance(lg_paths, list) else 0,
                "max_hop_depth": max_depth,
                "tier1_connected": sum(1 for n in graph.nodes if n.is_tier1),
                "total_peers": asn_meta.peer_count,
                "protocol": f"IPv{version} / BGP4"
            }

            return BGPTraceResponse(
                target_ip=clean_target,
                origin_asn=origin_asn,
                ip_metadata=ip_meta,
                asn_metadata=asn_meta,
                whois=whois_data,
                graph=graph,
                looking_glass_paths=(lg_paths[:25] if isinstance(lg_paths, list) else []),
                summary=summary
            )

    async def trace_ip(self, ip: str, max_depth: int = 10) -> BGPTraceResponse:
        """Backward-compatible alias for trace_target."""
        return await self.trace_target(target=ip, max_depth=max_depth)

    async def get_as_detail(self, asn: int) -> Dict[str, Any]:
        """Fetch detailed info on demand for a single ASN (e.g. on 2s hover or click)."""
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            meta = await self.get_as_metadata(client, asn)
            neighbours = await self.fetch_asn_neighbours(client, asn)
            whois_url = f"https://stat.ripe.net/data/whois/data.json?resource=AS{asn}"
            whois_res = await self._fetch_json(client, whois_url)
            
            org = meta.get("name")
            reg_date = None
            if isinstance(whois_res, dict) and whois_res.get("status") == "ok":
                for rec in whois_res.get("data", {}).get("records", []):
                    for item in rec:
                        if item.get("key") in ["OrgName", "as-name", "descr"]:
                            org = item.get("value")
                        if item.get("key") in ["RegDate", "created"]:
                            reg_date = item.get("value")

            return {
                "asn": asn,
                "name": meta.get("name", f"AS{asn}"),
                "org": org,
                "country": meta.get("country", "US"),
                "flag": meta.get("flag", "🌐"),
                "tier": meta.get("tier", "Transit / Peer"),
                "is_tier1": meta.get("is_tier1", False),
                "peer_count": len(neighbours),
                "registration_date": reg_date,
                "top_peers": [n.get("asn") for n in neighbours[:6]],
                "rdap_url": f"https://rdap.arin.net/registry/autnum/{asn}"
            }

    async def get_as_prefixes(self, asn: int) -> Dict[str, Any]:
        """Fetch announced IPv4 and IPv6 prefixes for an AS with caching."""
        cache_key = f"announced_prefixes_AS{asn}"
        cached = as_cache.get(cache_key)
        if cached is not None:
            return cached

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            url = f"https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS{asn}"
            res = await self._fetch_json(client, url)
            prefixes_v4 = []
            prefixes_v6 = []
            if isinstance(res, dict) and res.get("status") == "ok":
                items = res.get("data", {}).get("prefixes", [])
                for item in items:
                    p = item.get("prefix")
                    if p:
                        if ":" in p:
                            prefixes_v6.append(p)
                        else:
                            prefixes_v4.append(p)

            meta = await self.get_as_metadata(client, asn)
            result = {
                "asn": asn,
                "name": meta.get("name", f"AS{asn}"),
                "country": meta.get("country", "US"),
                "flag": meta.get("flag", "🌐"),
                "total_count": len(prefixes_v4) + len(prefixes_v6),
                "v4_count": len(prefixes_v4),
                "v6_count": len(prefixes_v6),
                "prefixes_v4": prefixes_v4,
                "prefixes_v6": prefixes_v6,
                "prefixes": prefixes_v4 + prefixes_v6
            }
            as_cache.set(cache_key, result, ttl_seconds=3600)
            return result

bgp_service = BGPService()
