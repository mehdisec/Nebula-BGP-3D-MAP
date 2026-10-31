/**
 * 3D Radial BGP Topology & Geographic World Map Visualizer
 * Powered by 3d-force-graph and Three.js.
 * Supports:
 * 1. '3d'  - 3D Radial Spherical Fibonacci hop shells
 * 2. 'map' - Real-world Cyber World Map with geographic AS placement and curved transit arcs
 * 3. '2d'  - 2D Planar concentric rings
 */

const COUNTRY_COORDS_JS = {
  US: [37.0902, -95.7129], GB: [55.3781, -3.4360], DE: [51.1657, 10.4515], FR: [46.2276, 2.2137],
  NL: [52.1326, 5.2913], JP: [36.2048, 138.2529], CN: [35.8617, 104.1954], IN: [20.5937, 78.9629],
  BR: [-14.2350, -51.9253], AU: [-25.2744, 133.7751], ZA: [-30.5595, 22.9375], SE: [60.1282, 18.6435],
  IT: [41.8719, 12.5674], ES: [40.4637, -3.7492], SG: [1.3521, 103.8198], HK: [22.3193, 114.1694],
  CA: [56.1304, -106.3468], CH: [46.8182, 8.2275], IR: [32.4279, 53.6880], TR: [38.9637, 35.2433],
  RU: [61.5240, 105.3188], KR: [35.9078, 127.7669], EU: [50.8503, 4.3517], PL: [51.9194, 19.1451],
  UA: [48.3794, 31.1656], NO: [60.4720, 8.4689], FI: [61.9241, 25.7482], DK: [56.2639, 9.5018],
  IE: [53.1424, -7.6921], BE: [50.5039, 4.4699], AT: [47.5162, 14.5501], CZ: [49.8175, 15.4730],
  RO: [45.9432, 24.9668], HU: [47.1625, 19.5033], GR: [39.0742, 21.8243], PT: [39.3999, -8.2245],
  BG: [42.7339, 25.4858], IL: [31.0461, 34.8516], AE: [23.4241, 53.8478], SA: [23.8859, 45.0792],
  NZ: [-40.9006, 174.8860], MX: [23.6345, -102.5528], AR: [-38.4161, -63.6167], CL: [-35.6751, -71.5430],
  CO: [4.5709, -74.2973], ID: [-0.7893, 113.9213], MY: [4.2105, 101.9758], TH: [15.8700, 100.9925],
  VN: [14.0583, 108.2772], PH: [12.8797, 121.7740], TW: [23.6978, 120.9605], EG: [26.8206, 30.8025],
  NG: [9.0820, 8.6753], KE: [-0.0236, 37.9062], PK: [30.3753, 69.3451], BD: [23.6850, 90.3563],
  IS: [64.9631, -19.0208], LU: [49.8153, 6.1296], EE: [58.5953, 25.0136], LV: [56.8796, 24.6032],
  LT: [55.1694, 23.8813], SI: [46.1512, 14.9955], SK: [48.6690, 19.6990], HR: [45.1000, 15.2000]
};

class BGPVisualizer3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.graph = null;
    this.currentData = null;
    this.orbitalRings = [];
    this.autoRotate = false;
    this.showLabels = true;
    this.viewMode = '3d'; // '3d' | 'map' | '2d'
    this.is2DMode = false;
    this.worldMapMesh = null;
    this.worldMapTexture = null;

    this.hopColors = {
      0: "#ff6600", // Target Origin (Distinct Vibrant Cyber Orange)
      1: "#00b4d8", // Hop 1: Direct Peers & Upstreams (Bright Azure)
      2: "#a855f7", // Hop 2: Tier-1 Global Backbones (Royal Ultraviolet)
      3: "#f59e0b", // Hop 3: Regional Transits (Solar Amber)
      4: "#fb7185", // Hop 4: Intermediate Transits (Neon Coral)
      5: "#ec4899", // Hop 5: Edge & Stubs (Electric Magenta)
      6: "#f43f5e", // Hop 6-10: Vantage Points & Remote Stubs
      7: "#f43f5e",
      8: "#f43f5e",
      9: "#f43f5e",
      10: "#f43f5e"
    };

    this.connectedPeerIds = new Set();
    this.activeTierFilter = "all";
    this.nodesById = new Map();
    this.init();
  }

  init() {
    if (!this.container) return;

    // Initialize 3d-force-graph with native Three.js OrbitControls for 360-degree object exploration
    this.graph = ForceGraph3D({ controlType: 'orbit' })(this.container)
      .backgroundColor("#05070d")
      .showNavInfo(false)
      .enableNodeDrag(false)
      .enableNavigationControls(true)
      // Node visibility & filtering
      .nodeVisibility(node => this.isNodeVisible(node))
      .linkVisibility(link => this.isLinkVisible(link))
      // Node rendering
      .nodeId("id")
      .nodeLabel(node => {
        const geoInfo = (typeof node.lat === 'number' && typeof node.lon === 'number')
          ? `${node.city ? node.city + ', ' : ''}${node.country || 'US'} (${node.lat >= 0 ? node.lat.toFixed(1) + '°N' : Math.abs(node.lat).toFixed(1) + '°S'}, ${node.lon >= 0 ? node.lon.toFixed(1) + '°E' : Math.abs(node.lon).toFixed(1) + '°W'})`
          : `${node.country || 'US'}`;
        const repInfo = node.representative_ip ? `<div style="color: #67e8f9; font-size: 10px;">🌐 IP: ${node.representative_ip}</div>` : '';
        return `
          <div style="background: rgba(15,23,42,0.95); border: 1px solid #00f0ff; padding: 6px 10px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #f8fafc; box-shadow: 0 4px 16px rgba(0,240,255,0.25);">
            <div style="font-weight: bold; color: ${this.getNodeColor(node)};">AS${node.asn} ${node.flag || ''}</div>
            <div style="color: #cbd5e1; font-size: 11px;">${node.name || ''}</div>
            ${repInfo}
            <div style="color: #38bdf8; font-size: 10px; margin-top: 2px;">📍 ${geoInfo}</div>
            <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">
              ${node.depth === 0 ? '★ CORE TARGET' : `Hop ${node.depth}`} • ${node.tier} • ${node.peer_count || 1} Peers
            </div>
          </div>
        `;
      })
      .nodeColor(node => this.getNodeColor(node))
      .nodeVal(node => {
        if (node.is_target) return 28;
        if (node.is_tier1) return 14;
        if (node.depth === 1) return 10;
        return Math.max(5, 12 - node.depth);
      })
      // Rebuilt distinct high-contrast link rendering
      .linkSource("source")
      .linkTarget("target")
      .linkColor(link => this.getLinkColor(link))
      .linkWidth(link => this.getLinkWidth(link))
      .linkCurvature(link => (this.viewMode === 'map' ? 0.24 : 0))
      // Particle photons (calm, subtle packet flow)
      .linkDirectionalParticles(link => this.getLinkParticles(link))
      .linkDirectionalParticleSpeed(0.005)
      .linkDirectionalParticleWidth(link => this.getLinkParticleWidth(link))
      .linkDirectionalParticleColor(link => this.getLinkParticleColor(link))
      // Hover and Click events
      .onNodeHover(node => {
        this.container.style.cursor = node ? "pointer" : "grab";
        if (window.hoverHUD) {
          window.hoverHUD.onNodeHover(node);
        }
      })
      .onNodeClick(node => {
        this.selectNode(node);
        if (window.selectAS) {
          window.selectAS(node);
        }
      })
      .onBackgroundClick(() => {
        this.deselectNode();
        if (window.selectAS) {
          window.selectAS(null);
        }
        if (window.hoverHUD) {
          window.hoverHUD.hideFloatingHUD();
        }
      });

    // Rebuilt Custom Three.js Node Rendering with Multi-layer Shaders & Peer Highlights
    this.graph.nodeThreeObject(node => {
      const group = new THREE.Group();

      const hasSelection = !!this.selectedNode;
      const nodeId = String(node.id || node.asn);
      const isSelected = hasSelection && String(this.selectedNode.id || this.selectedNode.asn) === nodeId;
      const isPeer = hasSelection && this.connectedPeerIds && this.connectedPeerIds.has(nodeId);
      const isDimmed = hasSelection && !isSelected && !isPeer;

      let radius = node.is_target ? 12 : (node.is_tier1 ? 8.0 : (node.depth === 1 ? 6.5 : 5.0));
      if (isSelected) radius *= 1.35;
      else if (isPeer) radius *= 1.15;

      const colorHex = this.getNodeColor(node);

      // Core Sphere Material with Dynamic Peer Highlighting
      const mat = new THREE.MeshPhongMaterial({
        color: isDimmed ? 0x1e293b : colorHex,
        emissive: isDimmed ? 0x0f172a : (isSelected ? 0x00f0ff : (node.is_target ? 0xff6600 : colorHex)),
        emissiveIntensity: isDimmed ? 0.08 : (isSelected ? 0.95 : (isPeer ? 0.75 : (node.is_target ? 0.85 : 0.45))),
        shininess: isDimmed ? 10 : 90,
        transparent: true,
        opacity: isDimmed ? 0.12 : (isSelected ? 1.0 : (isPeer ? 0.95 : 0.9))
      });

      const geom = new THREE.SphereGeometry(radius, 24, 24);
      const sphere = new THREE.Mesh(geom, mat);
      group.add(sphere);

      // Target AS Glowing Pulsing Energy Shell
      if (node.is_target && !isDimmed) {
        const haloGeom = new THREE.SphereGeometry(radius * 1.55, 24, 24);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0xff6600,
          transparent: true,
          opacity: 0.38,
          wireframe: true
        });
        const halo = new THREE.Mesh(haloGeom, haloMat);
        group.add(halo);
      }

      // Tier-1 Transit Octahedron Crystalline Shell
      if (node.is_tier1 && !isDimmed) {
        const octGeom = new THREE.OctahedronGeometry(radius * 1.4, 0);
        const octMat = new THREE.MeshBasicMaterial({
          color: 0xa855f7,
          wireframe: true,
          transparent: true,
          opacity: 0.4
        });
        const octMesh = new THREE.Mesh(octGeom, octMat);
        group.add(octMesh);
      }

      // Selected AS Glowing Radar Ring Indicator
      if (isSelected) {
        const selRingGeom = new THREE.RingGeometry(radius * 1.7, radius * 2.5, 36);
        const selRingMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95
        });
        const selRing = new THREE.Mesh(selRingGeom, selRingMat);
        selRing.rotation.x = Math.PI / 2;
        group.add(selRing);
      }

      // Connected Direct Peer Indicator Ring
      if (isPeer) {
        const peerRingGeom = new THREE.RingGeometry(radius * 1.35, radius * 1.75, 24);
        const peerRingMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85
        });
        const peerRing = new THREE.Mesh(peerRingGeom, peerRingMat);
        peerRing.rotation.x = Math.PI / 2;
        group.add(peerRing);
      }

      // 3D Text Label Sprite
      const shouldShowLabel = !isDimmed && (
        isSelected ||
        isPeer ||
        node.is_target ||
        node.is_tier1 ||
        (this.showLabels && node.depth <= 2)
      );

      if (shouldShowLabel) {
        const sprite = this.createTextSprite(node, isSelected, isPeer);
        sprite.position.set(0, radius + 8, 0);
        group.add(sprite);
      }

      return group;
    });

    // Camera Controls setup (OrbitControls around target AS nodes)
    const controls = this.graph.controls();
    if (controls) {
      controls.enabled = true;
      controls.enableRotate = true;
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.rotateSpeed = 1.0;
      controls.zoomSpeed = 1.2;
      controls.enablePan = true;
      controls.panSpeed = 1.0;
      controls.minDistance = 40;
      controls.maxDistance = 5000;
      if (controls.target) {
        controls.target.set(0, 0, 0);
      }
    }

    // Build Cyber World Map Plane Mesh
    this.buildWorldMapMesh();

    // Set initial camera perspective
    this.graph.cameraPosition({ x: 0, y: 350, z: 750 }, { x: 0, y: 0, z: 0 }, 1500);

    // Responsive resizing with ResizeObserver to prevent layout jumps during zoom
    if (window.ResizeObserver && this.container) {
      let rAF = null;
      const ro = new ResizeObserver((entries) => {
        if (rAF) cancelAnimationFrame(rAF);
        rAF = requestAnimationFrame(() => {
          for (const entry of entries) {
            const w = Math.floor(entry.contentRect.width);
            const h = Math.floor(entry.contentRect.height);
            if (w > 0 && h > 0 && this.graph) {
              this.graph.width(w);
              this.graph.height(h);
            }
          }
        });
      });
      ro.observe(this.container);
      this.resizeObserver = ro;
    } else {
      window.addEventListener("resize", () => {
        if (this.graph && this.container) {
          this.graph.width(this.container.clientWidth);
          this.graph.height(this.container.clientHeight);
        }
      });
    }

    // Start render loop for auto-rotation and orbital effects
    this.startAnimationLoop();
  }

  buildWorldMapMesh() {
    const scene = this.graph.scene();
    if (!scene) return;

    if (this.worldMapMesh) {
      scene.remove(this.worldMapMesh);
      this.worldMapMesh = null;
    }

    const mapW = 1800;
    const mapH = 900;
    const mapGeom = new THREE.PlaneGeometry(mapW, mapH, 1, 1);

    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('/static/assets/world_cyber_map.png', () => {
      if (this.graph && this.graph.renderer && this.graph.scene && this.graph.camera) {
        this.graph.renderer().render(this.graph.scene(), this.graph.camera());
      }
    });
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.worldMapTexture = texture;

    const mapMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.worldMapMesh = new THREE.Mesh(mapGeom, mapMat);
    this.worldMapMesh.rotation.x = -Math.PI / 2;
    this.worldMapMesh.position.set(0, -0.5, 0);
    this.worldMapMesh.visible = (this.viewMode === 'map');

    // Glowing Cyber Border Frame around the World Map
    const hw = mapW / 2;
    const hh = mapH / 2;
    const framePoints = [
      new THREE.Vector3(-hw, 0, -hh),
      new THREE.Vector3(hw, 0, -hh),
      new THREE.Vector3(hw, 0, hh),
      new THREE.Vector3(-hw, 0, hh),
      new THREE.Vector3(-hw, 0, -hh)
    ];
    const frameGeom = new THREE.BufferGeometry().setFromPoints(framePoints);
    const frameMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45
    });
    this.worldMapMesh.add(new THREE.Line(frameGeom, frameMat));

    // Equator & Prime Meridian Grid Lines
    const eqGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-hw, 0, 0),
      new THREE.Vector3(hw, 0, 0)
    ]);
    const pmGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -hh),
      new THREE.Vector3(0, 0, hh)
    ]);
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.2
    });
    this.worldMapMesh.add(new THREE.Line(eqGeom, gridMat));
    this.worldMapMesh.add(new THREE.Line(pmGeom, gridMat));

    scene.add(this.worldMapMesh);
  }

  createTextSprite(node, isSelected = false, isPeer = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext("2d");

    let bgColor = "rgba(10, 15, 29, 0.92)";
    let borderColor = this.getNodeColor(node);
    let titleColor = borderColor;
    let badgeText = "";

    if (isSelected) {
      bgColor = "rgba(2, 44, 67, 0.98)";
      borderColor = "#00f0ff";
      titleColor = "#ffffff";
      badgeText = "★ SELECTED";
    } else if (isPeer) {
      bgColor = "rgba(15, 23, 42, 0.95)";
      borderColor = "#38bdf8";
      titleColor = "#38bdf8";
      badgeText = "PEER NODE";
    }

    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(4, 4, 248, 64, 8);
    } else {
      ctx.rect(4, 4, 248, 64);
    }
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 20px 'JetBrains Mono', monospace, sans-serif";
    ctx.fillStyle = titleColor;
    ctx.textAlign = "center";
    ctx.fillText(`AS${node.asn} ${node.flag || ''}`, 128, 28);

    if (badgeText) {
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = isSelected ? "#00f0ff" : "#38bdf8";
      ctx.fillText(badgeText, 128, 45);
    } else {
      ctx.font = "13px 'Inter', sans-serif";
      ctx.fillStyle = "#94a3b8";
      const sub = (node.name || "").substring(0, 22);
      ctx.fillText(sub, 128, 46);
    }

    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#64748b";
    const loc = node.city ? `${node.city}, ${node.country || ''}` : (node.country || '');
    ctx.fillText(loc ? `📍 ${loc.substring(0, 24)}` : `${node.peer_count || 1} Peers`, 128, 62);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(42, 11.8, 1);
    return sprite;
  }

  getNodeColor(node) {
    if (node.is_target) return this.hopColors[0];
    const d = node.depth !== undefined ? node.depth : 1;
    return this.hopColors[d] || "#00b4d8";
  }

  isLinkConnectedToSelected(link) {
    if (!this.selectedNode) return false;
    const selId = String(this.selectedNode.id || this.selectedNode.asn);
    const sId = typeof link.source === "object" ? String(link.source.id || link.source.asn) : String(link.source);
    const tId = typeof link.target === "object" ? String(link.target.id || link.target.asn) : String(link.target);
    return sId === selId || tId === selId;
  }

  getLinkColor(link) {
    const isConnected = this.isLinkConnectedToSelected(link);
    if (this.selectedNode) {
      if (isConnected) {
        return "#00f0ff";
      }
      return "rgba(56, 189, 248, 0.04)";
    }

    const d = link.depth || 1;
    const baseCol = this.hopColors[d] || "#00b4d8";

    if (this.viewMode === '2d') {
      return baseCol + "fa";
    }
    if (this.viewMode === 'map') {
      return baseCol + "dd";
    }
    return baseCol + "b0";
  }

  getLinkWidth(link) {
    const isConnected = this.isLinkConnectedToSelected(link);
    if (this.selectedNode) {
      if (isConnected) {
        return this.viewMode === '2d' ? 3.6 : 2.8;
      }
      return 0.5;
    }
    if (this.viewMode === '2d') {
      return link.depth === 1 ? 2.4 : 1.4;
    }
    if (this.viewMode === 'map') {
      return link.depth === 1 ? 2.4 : 1.5;
    }
    return link.depth === 1 ? 2.0 : 1.2;
  }

  getLinkParticles(link) {
    if (this.selectedNode) {
      return this.isLinkConnectedToSelected(link) ? 2 : 0;
    }
    // Subtle, clean packet flow: Only 1 packet on primary direct Hop 1 links (0 on distant edge links)
    if (this.viewMode === '2d') {
      return link.depth === 1 ? 1 : 0;
    }
    // In 3D: 1 packet on direct Hop 1 links and Tier-1 transits, 0 on distant edge links to avoid clutter
    if (link.depth === 1) return 1;
    if (link.depth === 2 && (link.is_tier1 || link.value > 1)) return 1;
    return 0;
  }

  getLinkParticleWidth(link) {
    if (this.selectedNode) {
      return this.isLinkConnectedToSelected(link) ? 2.4 : 0;
    }
    return link.depth === 1 ? 1.8 : 1.2;
  }

  getLinkParticleColor(link) {
    if (this.selectedNode && this.isLinkConnectedToSelected(link)) {
      return "#ffffff";
    }
    return this.hopColors[link.depth] || "#00f0ff";
  }

  selectNode(node) {
    this.selectedNode = node;
    this.connectedPeerIds = new Set();
    if (node) {
      const selId = String(node.id || node.asn);
      if (Array.isArray(node.connected_peers) && node.connected_peers.length > 0) {
        node.connected_peers.forEach(p => this.connectedPeerIds.add(String(p)));
      } else if (this.currentData && this.currentData.graph) {
        (this.currentData.graph.links || []).forEach(l => {
          const s = String(typeof l.source === "object" ? l.source.id || l.source.asn : l.source);
          const t = String(typeof l.target === "object" ? l.target.id || l.target.asn : l.target);
          if (s === selId) this.connectedPeerIds.add(t);
          if (t === selId) this.connectedPeerIds.add(s);
        });
      }
    }
    this.updateVisualHighlights();

    if (this.viewMode !== '2d' && node) {
      this.focusOnNode(node);
    }
  }

  deselectNode() {
    this.selectedNode = null;
    this.connectedPeerIds = new Set();
    this.updateVisualHighlights();
  }

  isNodeVisible(node) {
    if (!node) return false;
    if (this.activeTierFilter === "all" || !this.activeTierFilter) return true;
    if (node.is_target) return true; // Target Origin AS remains visible as the topological anchor
    const targetTier = parseInt(this.activeTierFilter, 10);
    const nodeTier = node.tier_level !== undefined ? node.tier_level : (node.is_tier1 ? 1 : 2);
    return nodeTier === targetTier;
  }

  isLinkVisible(link) {
    if (!link) return false;
    if (this.activeTierFilter === "all" || !this.activeTierFilter) return true;
    const sId = String(typeof link.source === "object" ? (link.source.id || link.source.asn) : link.source);
    const tId = String(typeof link.target === "object" ? (link.target.id || link.target.asn) : link.target);
    const sNode = typeof link.source === "object" ? link.source : (this.nodesById ? this.nodesById.get(sId) : null);
    const tNode = typeof link.target === "object" ? link.target : (this.nodesById ? this.nodesById.get(tId) : null);
    return this.isNodeVisible(sNode) && this.isNodeVisible(tNode);
  }

  setTierFilter(tier) {
    this.activeTierFilter = String(tier);
    if (!this.graph) return;
    this.graph.nodeVisibility(node => this.isNodeVisible(node));
    this.graph.linkVisibility(link => this.isLinkVisible(link));
    if (typeof this.graph.refresh === 'function') {
      this.graph.refresh();
    }
  }

  updateVisualHighlights() {
    if (!this.graph) return;
    this.graph.linkColor(link => this.getLinkColor(link));
    this.graph.linkWidth(link => this.getLinkWidth(link));
    this.graph.linkDirectionalParticles(link => this.getLinkParticles(link));
    this.graph.linkDirectionalParticleWidth(link => this.getLinkParticleWidth(link));
    this.graph.linkDirectionalParticleColor(link => this.getLinkParticleColor(link));
    this.graph.nodeThreeObject(this.graph.nodeThreeObject());
  }

  renderData(data) {
    this.currentData = data;
    this.selectedNode = null;
    const maxDepth = data.graph.max_depth || 10;

    // Group nodes by hop depth to compute clean, non-overlapping 2D concentric circles
    const nodesByDepth = {};
    data.graph.nodes.forEach(n => {
      const d = n.depth || 0;
      if (!nodesByDepth[d]) nodesByDepth[d] = [];
      nodesByDepth[d].push(n);
    });

    const baseRadius2D = 140.0;
    const mapW = 1800;
    const mapH = 900;
    const halfW = mapW / 2;
    const halfH = mapH / 2;

    const countryCounters = {};

    const nodes = data.graph.nodes.map(n => {
      const d = n.depth || 0;
      const layer = nodesByDepth[d] || [n];
      const idxInLayer = layer.indexOf(n);
      const totalInLayer = layer.length;

      // 1. 2D Concentric Coordinates
      let x2d = 0;
      let z2d = 0;
      if (d > 0) {
        const r = baseRadius2D * d;
        const angle = (2 * Math.PI * idxInLayer) / totalInLayer + (d * 0.45);
        x2d = r * Math.cos(angle);
        z2d = r * Math.sin(angle);
      }

      // 2. World Map Geographic Coordinates
      let lat = typeof n.lat === 'number' ? n.lat : null;
      let lon = typeof n.lon === 'number' ? n.lon : null;

      if (lat === null || lon === null) {
        const cCode = (n.country || 'US').toUpperCase();
        const base = COUNTRY_COORDS_JS[cCode] || [25.0, 10.0];
        const cIdx = countryCounters[cCode] || 0;
        countryCounters[cCode] = cIdx + 1;

        if (cIdx === 0) {
          lat = base[0];
          lon = base[1];
        } else {
          const angle = ((n.asn + cIdx * 17) * 2.399963) % (2 * Math.PI);
          const radius = Math.min(3.8, 0.7 + 0.38 * Math.sqrt(cIdx));
          const cosLat = Math.max(0.2, Math.cos((base[0] * Math.PI) / 180));
          lat = base[0] + radius * Math.sin(angle);
          lon = base[1] + (radius / cosLat) * Math.cos(angle);
        }
      }

      // Clamp lat & lon to standard map bounds
      lat = Math.max(-75.0, Math.min(75.0, lat));
      lon = Math.max(-175.0, Math.min(175.0, lon));

      // Equirectangular mapping to X-Z plane
      const xMap = (lon / 180.0) * halfW;
      const zMap = -(lat / 90.0) * halfH;
      const yMap = 3.5;

      let initFx = n.x;
      let initFy = n.y;
      let initFz = n.z;

      if (this.viewMode === 'map') {
        initFx = xMap;
        initFy = yMap;
        initFz = zMap;
      } else if (this.viewMode === '2d') {
        initFx = x2d;
        initFy = 0;
        initFz = z2d;
      }

      return {
        ...n,
        x3d: n.x,
        y3d: n.y,
        z3d: n.z,
        x2d: x2d,
        y2d: 0,
        z2d: z2d,
        xMap: xMap,
        yMap: yMap,
        zMap: zMap,
        x: initFx,
        y: initFy,
        z: initFz,
        fx: initFx,
        fy: initFy,
        fz: initFz
      };
    });

    const links = data.graph.links.map(l => ({
      ...l,
      source: l.source,
      target: l.target
    }));

    this.nodesById = new Map();
    nodes.forEach(n => this.nodesById.set(String(n.id || n.asn), n));

    this.graph.graphData({ nodes, links });
    this.setTierFilter(this.activeTierFilter);

    // Build concentric guide rings matching baseRadius
    this.buildOrbitalGuideRings(maxDepth);

    // Sync visibility of world map mesh and guide rings
    if (this.worldMapMesh) {
      this.worldMapMesh.visible = (this.viewMode === 'map');
    }
    this.orbitalRings.forEach(r => {
      r.visible = (this.viewMode !== 'map');
    });

    // Reset camera to clean overview
    this.resetCamera();
    this.updateVisualHighlights();
  }

  buildOrbitalGuideRings(maxDepth) {
    const scene = this.graph.scene();
    if (!scene) return;

    // Remove existing orbital rings
    this.orbitalRings.forEach(r => scene.remove(r));
    this.orbitalRings = [];

    const baseRadius = 140.0;

    for (let d = 1; d <= maxDepth; d++) {
      const radius = baseRadius * d;

      // Concentric orbital guide ring on horizontal X-Z plane
      const ringGeom = new THREE.RingGeometry(radius - 0.5, radius + 0.5, 96);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(this.hopColors[d] || "#38bdf8"),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: this.viewMode === '2d' ? (d <= 3 ? 0.32 : 0.18) : (d <= 3 ? 0.22 : 0.12)
      });

      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.visible = (this.viewMode !== 'map');
      scene.add(ringMesh);
      this.orbitalRings.push(ringMesh);

      // Hop indicator marker on the ring
      const markerSprite = this.createHopMarkerSprite(d, radius);
      if (markerSprite) {
        markerSprite.visible = (this.viewMode !== 'map');
        scene.add(markerSprite);
        this.orbitalRings.push(markerSprite);
      }
    }
  }

  createHopMarkerSprite(depth, radius) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.strokeStyle = this.hopColors[depth] || "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(2, 2, 124, 36, 6);
    } else {
      ctx.rect(2, 2, 124, 36);
    }
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 16px 'Inter', monospace, sans-serif";
    ctx.fillStyle = this.hopColors[depth] || "#38bdf8";
    ctx.textAlign = "center";
    ctx.fillText(`HOP ${depth}`, 64, 25);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(30, 9.5, 1);
    sprite.position.set(radius, 0, 0);
    return sprite;
  }

  focusOnNode(node) {
    if (!node || !this.graph) return;

    if (this.viewMode === '2d') {
      return;
    }

    if (this.viewMode === 'map') {
      const targetX = node.xMap !== undefined ? node.xMap : (node.fx || 0);
      const targetZ = node.zMap !== undefined ? node.zMap : (node.fz || 0);
      this.graph.cameraPosition(
        { x: targetX, y: 190, z: targetZ + 130 },
        { x: targetX, y: 0, z: targetZ },
        900
      );
      return;
    }

    // 3D Mode Focus
    const distance = node.is_target ? 220 : 160;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

    const newPos = {
      x: (node.x || 0) * distRatio,
      y: (node.y || 0) * distRatio + 40,
      z: (node.z || 0) * distRatio
    };

    this.graph.cameraPosition(newPos, { x: 0, y: 0, z: 0 }, 1000);
  }

  resetCamera() {
    if (!this.graph) return;
    const camera = this.graph.camera();
    const controls = this.graph.controls();

    if (camera) {
      camera.up.set(0, 1, 0);
    }

    if (this.viewMode === 'map') {
      this.graph.cameraPosition({ x: 0, y: 760, z: 460 }, { x: 0, y: 0, z: -40 }, 900);
    } else if (this.viewMode === '2d') {
      this.graph.cameraPosition({ x: 0, y: 1100, z: 220 }, { x: 0, y: 0, z: 0 }, 800);
    } else {
      this.graph.cameraPosition({ x: 0, y: 380, z: 820 }, { x: 0, y: 0, z: 0 }, 1000);
    }

    if (controls) {
      controls.target.set(0, 0, 0);
      controls.enabled = true;
      controls.enableRotate = true;
      controls.update();
    }
  }

  resize() {
    if (!this.container || !this.graph) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w > 0 && h > 0) {
      this.graph.width(w);
      this.graph.height(h);
      const camera = this.graph.camera();
      if (camera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      const controls = this.graph.controls();
      if (controls) {
        controls.enabled = true;
        controls.enableRotate = true;
        controls.update();
      }
      const renderer = typeof this.graph.renderer === 'function' ? this.graph.renderer() : null;
      if (renderer && renderer.setSize) {
        renderer.setSize(w, h);
      }
    }
  }

  setViewMode(mode) {
    if (!['3d', 'map', '2d'].includes(mode)) return this.viewMode;
    this.viewMode = mode;
    this.is2DMode = (mode === '2d');

    if (!this.graph) return this.viewMode;

    const controls = this.graph.controls();
    const camera = this.graph.camera();

    // 1. World Map Mesh visibility
    if (this.worldMapMesh) {
      this.worldMapMesh.visible = (this.viewMode === 'map');
    }

    // 2. Guide rings visibility
    this.orbitalRings.forEach(r => {
      r.visible = (this.viewMode !== 'map');
    });

    // 3. Link Curvature
    this.graph.linkCurvature(link => {
      if (this.viewMode === 'map') return 0.24;
      return 0;
    });

    const gData = this.graph.graphData();

    if (this.viewMode === 'map') {
      // WORLD MAP MODE:
      if (controls) {
        controls.enabled = true;
        controls.enableRotate = true;
        controls.rotateSpeed = 0.6;
        if (controls.screenSpacePanning !== undefined) {
          controls.screenSpacePanning = true;
        }
        controls.target.set(0, 0, 0);
        controls.update();
      }
      this.autoRotate = false;

      // Position nodes at their Geographic coordinates on the map
      if (gData && gData.nodes && gData.nodes.length > 0) {
        gData.nodes.forEach(n => {
          const tx = n.xMap !== undefined ? n.xMap : (n.x || 0);
          const ty = n.yMap !== undefined ? n.yMap : 3.5;
          const tz = n.zMap !== undefined ? n.zMap : (n.z || 0);
          n.fx = tx;
          n.fy = ty;
          n.fz = tz;
          n.x = tx;
          n.y = ty;
          n.z = tz;
          if (n.__threeObj) {
            n.__threeObj.position.set(tx, ty, tz);
          }
        });
        this.graph.graphData({
          nodes: [...gData.nodes],
          links: [...gData.links]
        });
        if (typeof this.graph.refresh === 'function') {
          this.graph.refresh();
        }
      }

      camera.up.set(0, 1, 0);
      this.graph.cameraPosition({ x: 0, y: 760, z: 460 }, { x: 0, y: 0, z: -40 }, 900);
      this.updateVisualHighlights();

    } else if (this.viewMode === '2d') {
      // 2D PLANAR RINGS MODE (Free mouse drag rotation & tilt enabled!)
      if (controls) {
        controls.enabled = true;
        controls.enableRotate = true; // Free rotation enabled! Drag in empty space rotates rings
        controls.rotateSpeed = 0.85;
        controls.enablePan = true;
        controls.panSpeed = 1.0;
        controls.enableZoom = true;
        controls.zoomSpeed = 1.2;
        if (controls.screenSpacePanning !== undefined) {
          controls.screenSpacePanning = true;
        }
        controls.target.set(0, 0, 0);
        controls.update();
      }
      this.autoRotate = false;

      if (gData && gData.nodes && gData.nodes.length > 0) {
        gData.nodes.forEach(n => {
          const tx = n.x2d !== undefined ? n.x2d : (n.x || 0);
          const ty = 0;
          const tz = n.z2d !== undefined ? n.z2d : (n.z || 0);
          n.fx = tx;
          n.fy = ty;
          n.fz = tz;
          n.x = tx;
          n.y = ty;
          n.z = tz;
          if (n.__threeObj) {
            n.__threeObj.position.set(tx, ty, tz);
          }
        });
        this.graph.graphData({
          nodes: [...gData.nodes],
          links: [...gData.links]
        });
        if (typeof this.graph.refresh === 'function') {
          this.graph.refresh();
        }
      }

      camera.up.set(0, 1, 0);
      // High-angle perspective view (y: 1100, z: 220) so there is NO pole gimbal lock!
      this.graph.cameraPosition({ x: 0, y: 1100, z: 220 }, { x: 0, y: 0, z: 0 }, 800);
      this.updateVisualHighlights();
      if (this.currentData) {
        this.buildOrbitalGuideRings(this.currentData.graph.max_depth || 3);
      }

    } else {
      // 3D RADIAL SPHERE MODE (Free mouse drag rotation around objects enabled!)
      if (controls) {
        controls.enabled = true;
        controls.enableRotate = true; // OrbitControls 360-degree exploration around center objects
        controls.rotateSpeed = 1.0;
        controls.enablePan = true;
        controls.panSpeed = 1.0;
        controls.enableZoom = true;
        controls.zoomSpeed = 1.2;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        if (controls.target) {
          controls.target.set(0, 0, 0);
        }
        controls.update();
      }

      if (gData && gData.nodes && gData.nodes.length > 0) {
        gData.nodes.forEach(n => {
          const tx = n.x3d !== undefined ? n.x3d : (n.x || 0);
          const ty = n.y3d !== undefined ? n.y3d : (n.y || 0);
          const tz = n.z3d !== undefined ? n.z3d : (n.z || 0);
          n.fx = tx;
          n.fy = ty;
          n.fz = tz;
          n.x = tx;
          n.y = ty;
          n.z = tz;
          if (n.__threeObj) {
            n.__threeObj.position.set(tx, ty, tz);
          }
        });
        this.graph.graphData({
          nodes: [...gData.nodes],
          links: [...gData.links]
        });
        if (typeof this.graph.refresh === 'function') {
          this.graph.refresh();
        }
      }

      camera.up.set(0, 1, 0);
      this.graph.cameraPosition({ x: 0, y: 380, z: 820 }, { x: 0, y: 0, z: 0 }, 1000);
      this.updateVisualHighlights();
      if (this.currentData) {
        this.buildOrbitalGuideRings(this.currentData.graph.max_depth || 3);
      }
    }

    return this.viewMode;
  }

  toggle2DMode() {
    const nextMode = this.viewMode === '3d' ? 'map' : (this.viewMode === 'map' ? '2d' : '3d');
    this.setViewMode(nextMode);
    return this.viewMode !== '3d';
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    const controls = this.graph ? this.graph.controls() : null;
    if (controls) {
      controls.autoRotate = this.autoRotate;
      controls.autoRotateSpeed = 1.5;
    }
    return this.autoRotate;
  }

  toggleLabels() {
    this.showLabels = !this.showLabels;
    if (this.currentData) {
      this.graph.nodeThreeObject(this.graph.nodeThreeObject());
    }
    return this.showLabels;
  }

  startAnimationLoop() {
    // Note: three-render-objects runs its own internal animation cycle calling controls.update(delta).
    // Sync autoRotate state with controls.
    const animate = () => {
      requestAnimationFrame(animate);

      const controls = this.graph ? this.graph.controls() : null;
      if (controls && controls.autoRotate !== this.autoRotate) {
        controls.autoRotate = !!this.autoRotate;
        controls.autoRotateSpeed = 1.5;
      }
    };
    animate();
  }
}

window.BGPVisualizer3D = BGPVisualizer3D;
