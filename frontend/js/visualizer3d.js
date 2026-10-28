/**
 * 3D Radial BGP Topology Visualizer
 * Uses 3d-force-graph and Three.js to render concentric orbital hop shells up to depth 10.
 */

class BGPVisualizer3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.graph = null;
    this.currentData = null;
    this.orbitalRings = [];
    this.autoRotate = false;
    this.showLabels = true;
    this.is2DMode = false;

    this.hopColors = {
      0: "#00f0ff", // Target Origin (Core Neon Cyan)
      1: "#38bdf8", // Hop 1: Direct Peers (Sky Blue)
      2: "#a855f7", // Hop 2: Tier-1 Transits (Purple)
      3: "#fbbf24", // Hop 3: Regional (Amber)
      4: "#f59e0b", // Hop 4: Transit (Orange)
      5: "#ec4899", // Hop 5: Intermediate (Pink)
      6: "#f43f5e", // Hop 6-10: Stubs & Edges (Rose)
      7: "#f43f5e",
      8: "#f43f5e",
      9: "#f43f5e",
      10: "#f43f5e"
    };

    this.init();
  }

  init() {
    if (!this.container) return;

    // Initialize 3d-force-graph
    this.graph = ForceGraph3D()(this.container)
      .backgroundColor("#05070d")
      .showNavInfo(false)
      .enableNodeDrag(false) // Keep radial coordinates fixed and clean
      // Node rendering
      .nodeId("id")
      .nodeLabel(node => `
        <div style="background: rgba(15,23,42,0.9); border: 1px solid #38bdf8; padding: 6px 10px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #f8fafc; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
          <div style="font-weight: bold; color: ${this.getNodeColor(node)};">AS${node.asn} ${node.flag || ''}</div>
          <div style="color: #94a3b8; font-size: 11px;">${node.name || ''}</div>
          <div style="color: #cbd5e1; font-size: 10px; margin-top: 2px;">
            ${node.depth === 0 ? '★ CORE TARGET' : `Hop ${node.depth}`} • ${node.tier}
          </div>
        </div>
      `)
      .nodeColor(node => this.getNodeColor(node))
      .nodeVal(node => {
        if (node.is_target) return 28;
        if (node.is_tier1) return 14;
        if (node.depth === 1) return 10;
        return Math.max(5, 12 - node.depth);
      })
      // Dynamic distinct link rendering
      .linkSource("source")
      .linkTarget("target")
      .linkColor(link => this.getLinkColor(link))
      .linkWidth(link => this.getLinkWidth(link))
      // Particle flow: Disabled in 2D mode
      .linkDirectionalParticles(link => this.getLinkParticles(link))
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleWidth(link => this.getLinkParticleWidth(link))
      .linkDirectionalParticleColor(link => this.getLinkParticleColor(link))
      // Hover and Click events
      .onNodeHover(node => {
        this.container.style.cursor = node ? "pointer" : "default";
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
        if (window.hoverHUD) {
          window.hoverHUD.hideFloatingHUD();
        }
      });

    // Custom Three.js Node Rendering with Glowing Shaders / Spheres
    this.graph.nodeThreeObject(node => {
      const group = new THREE.Group();

      const radius = node.is_target ? 12 : (node.is_tier1 ? 7.5 : (node.depth === 1 ? 6 : 4.5));
      const colorHex = this.getNodeColor(node);

      // Core Sphere
      const geom = new THREE.SphereGeometry(radius, 24, 24);
      const mat = new THREE.MeshPhongMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: node.is_target ? 0.7 : 0.35,
        shininess: 80,
        transparent: true,
        opacity: 0.95
      });
      const sphere = new THREE.Mesh(geom, mat);
      group.add(sphere);

      // Target AS Glowing Outer Halo
      if (node.is_target) {
        const haloGeom = new THREE.SphereGeometry(radius * 1.5, 24, 24);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.35,
          wireframe: true
        });
        const halo = new THREE.Mesh(haloGeom, haloMat);
        group.add(halo);
      }

      // Selected AS Glowing Ring Indicator (stays in place, does not displace to center!)
      const isSelected = this.selectedNode && String(this.selectedNode.id || this.selectedNode.asn) === String(node.id || node.asn);
      if (isSelected) {
        const selRingGeom = new THREE.RingGeometry(radius * 1.6, radius * 2.3, 36);
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

      // 3D Text Label Sprite
      if (this.showLabels && (node.is_target || node.is_tier1 || node.depth <= 2 || isSelected)) {
        const sprite = this.createTextSprite(node);
        sprite.position.set(0, radius + 8, 0);
        group.add(sprite);
      }

      return group;
    });

    // Camera Controls setup
    const controls = this.graph.controls();
    if (controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.rotateSpeed = 0.8;
      controls.zoomSpeed = 1.2;
    }

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

  createTextSprite(node) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(7, 10, 18, 0.85)";
    ctx.strokeStyle = this.getNodeColor(node);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 56, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 22px 'Inter', monospace, sans-serif";
    ctx.fillStyle = this.getNodeColor(node);
    ctx.textAlign = "center";
    ctx.fillText(`AS${node.asn} ${node.flag || ''}`, 128, 28);

    ctx.font = "14px 'Inter', sans-serif";
    ctx.fillStyle = "#94a3b8";
    const sub = (node.name || "").substring(0, 20);
    ctx.fillText(sub, 128, 48);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(40, 10, 1);
    return sprite;
  }

  getNodeColor(node) {
    if (node.is_target) return this.hopColors[0];
    const d = node.depth !== undefined ? node.depth : 1;
    return this.hopColors[d] || "#38bdf8";
  }

  // Helper to test if a link connects directly to the currently selected AS
  isLinkConnectedToSelected(link) {
    if (!this.selectedNode) return false;
    const selId = String(this.selectedNode.id || this.selectedNode.asn);
    const sId = typeof link.source === "object" ? String(link.source.id || link.source.asn) : String(link.source);
    const tId = typeof link.target === "object" ? String(link.target.id || link.target.asn) : String(link.target);
    return sId === selId || tId === selId;
  }

  // Clear, distinct, high-contrast link colors
  getLinkColor(link) {
    const isConnected = this.isLinkConnectedToSelected(link);
    if (isConnected) {
      return "#00f0ff"; // Bold neon cyan for links of selected AS
    }

    const d = link.depth || 1;
    const baseCol = this.hopColors[d] || "#38bdf8";

    if (this.selectedNode) {
      // Dim unrelated links slightly when an AS is selected
      return baseCol + (this.is2DMode ? "35" : "24");
    }

    if (this.is2DMode) {
      // Clean, distinct, high-contrast links in 2D mode
      return baseCol + "ee"; // 93% opacity
    }
    return baseCol + "99"; // 60% opacity in 3D
  }

  // Clear, thicker link widths
  getLinkWidth(link) {
    const isConnected = this.isLinkConnectedToSelected(link);
    if (isConnected) {
      return this.is2DMode ? 4.2 : 3.4; // Highlighted link
    }
    if (this.is2DMode) {
      return link.depth === 1 ? 2.6 : 1.8; // Crisp and prominent in 2D
    }
    return link.depth === 1 ? 2.0 : 1.3;
  }

  // Link particles: ZERO ANIMATION IN 2D MODE as requested
  getLinkParticles(link) {
    if (this.is2DMode) return 0; // Strict zero animation in 2D

    if (this.selectedNode) {
      return this.isLinkConnectedToSelected(link) ? 4 : 0;
    }
    return link.depth <= 2 ? 3 : 1;
  }

  getLinkParticleWidth(link) {
    if (this.is2DMode) return 0;
    return this.isLinkConnectedToSelected(link) ? 3.5 : (link.depth === 1 ? 2.8 : 1.8);
  }

  getLinkParticleColor(link) {
    return this.isLinkConnectedToSelected(link) ? "#00f0ff" : (this.hopColors[link.depth] || "#00f0ff");
  }

  selectNode(node) {
    this.selectedNode = node;
    this.updateVisualHighlights();

    // In 3D mode, gently orient without moving the whole map off center
    if (!this.is2DMode && node) {
      this.focusOnNode(node);
    }
    // In 2D mode: Camera stays stable at (0, 0, 0). The selected AS stays in its hop shell!
  }

  deselectNode() {
    this.selectedNode = null;
    this.updateVisualHighlights();
  }

  updateVisualHighlights() {
    if (!this.graph) return;
    this.graph.linkColor(link => this.getLinkColor(link));
    this.graph.linkWidth(link => this.getLinkWidth(link));
    this.graph.linkDirectionalParticles(link => this.getLinkParticles(link));
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

    // Assign true 2D concentric circle coordinates (x2d, 0, z2d) and retain 3D coordinates (x3d, y3d, z3d)
    const nodes = data.graph.nodes.map(n => {
      const d = n.depth || 0;
      const layer = nodesByDepth[d] || [n];
      const idxInLayer = layer.indexOf(n);
      const totalInLayer = layer.length;

      let x2d = 0;
      let z2d = 0;
      if (d > 0) {
        const r = baseRadius2D * d;
        // Evenly space out nodes along the circular circumference without any pole collapse
        const angle = (2 * Math.PI * idxInLayer) / totalInLayer + (d * 0.45);
        x2d = r * Math.cos(angle);
        z2d = r * Math.sin(angle);
      }

      return {
        ...n,
        x3d: n.x,
        y3d: n.y,
        z3d: n.z,
        x2d: x2d,
        y2d: 0,
        z2d: z2d,
        fx: this.is2DMode ? x2d : n.x,
        fy: this.is2DMode ? 0 : n.y,
        fz: this.is2DMode ? z2d : n.z
      };
    });

    const links = data.graph.links.map(l => ({
      ...l,
      source: l.source,
      target: l.target
    }));

    this.graph.graphData({ nodes, links });

    // Build concentric guide rings matching baseRadius
    this.buildOrbitalGuideRings(maxDepth);

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
        opacity: this.is2DMode ? (d <= 3 ? 0.32 : 0.18) : (d <= 3 ? 0.22 : 0.12)
      });

      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      scene.add(ringMesh);
      this.orbitalRings.push(ringMesh);

      // Hop indicator marker on the ring
      const markerSprite = this.createHopMarkerSprite(d, radius);
      if (markerSprite) {
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
    ctx.roundRect(2, 2, 124, 36, 6);
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
    if (this.is2DMode) {
      // In 2D mode, never displace the whole map to center on clicked node!
      return;
    }

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
    if (this.is2DMode) {
      camera.up.set(0, 0, -1);
      this.graph.cameraPosition({ x: 0, y: 1300, z: 0.001 }, { x: 0, y: 0, z: 0 }, 800);
    } else {
      camera.up.set(0, 1, 0);
      this.graph.cameraPosition({ x: 0, y: 380, z: 820 }, { x: 0, y: 0, z: 0 }, 1200);
    }
  }

  toggle2DMode() {
    this.is2DMode = !this.is2DMode;

    if (!this.graph) return this.is2DMode;

    const controls = this.graph.controls();
    const camera = this.graph.camera();

    if (this.is2DMode) {
      // 2D PLANAR MODE:
      // 1. Disable 3D spherical rotation, enable 2D panning
      if (controls) {
        controls.enableRotate = false;
        if (controls.screenSpacePanning !== undefined) {
          controls.screenSpacePanning = true;
        }
      }
      this.autoRotate = false;

      // 2. Reposition all nodes to true 2D concentric coordinates
      const gData = this.graph.graphData();
      if (gData && gData.nodes) {
        gData.nodes.forEach(n => {
          n.fx = n.x2d !== undefined ? n.x2d : n.x;
          n.fy = 0;
          n.fz = n.z2d !== undefined ? n.z2d : n.z;
        });
        this.graph.graphData(gData);
      }

      // 3. Position camera top-down looking at origin (0, 0, 0)
      camera.up.set(0, 0, -1);
      this.graph.cameraPosition({ x: 0, y: 1300, z: 0.001 }, { x: 0, y: 0, z: 0 }, 800);

      // 4. Update visual links and kill flow animations
      this.updateVisualHighlights();
      if (this.currentData) {
        this.buildOrbitalGuideRings(this.currentData.graph.max_depth || 10);
      }
    } else {
      // 3D RADIAL SPHERE MODE:
      // 1. Re-enable 3D orbit rotation
      if (controls) {
        controls.enableRotate = true;
      }

      // 2. Restore 3D spherical coordinates
      const gData = this.graph.graphData();
      if (gData && gData.nodes) {
        gData.nodes.forEach(n => {
          n.fx = n.x3d !== undefined ? n.x3d : n.x;
          n.fy = n.y3d !== undefined ? n.y3d : n.y;
          n.fz = n.z3d !== undefined ? n.z3d : n.z;
        });
        this.graph.graphData(gData);
      }

      // 3. Restore camera normal up vector and perspective angle
      camera.up.set(0, 1, 0);
      this.graph.cameraPosition({ x: 0, y: 380, z: 820 }, { x: 0, y: 0, z: 0 }, 1000);

      // 4. Update visual links and restore particles
      this.updateVisualHighlights();
      if (this.currentData) {
        this.buildOrbitalGuideRings(this.currentData.graph.max_depth || 10);
      }
    }

    return this.is2DMode;
  }

  toggleAutoRotate() {
    if (this.is2DMode) return false; // Disabled in 2D mode
    this.autoRotate = !this.autoRotate;
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
    let angle = 0;
    const animate = () => {
      requestAnimationFrame(animate);

      if (!this.is2DMode && this.autoRotate && this.graph) {
        angle += 0.0025;
        const camera = this.graph.camera();
        const dist = 850;
        camera.position.x = dist * Math.sin(angle);
        camera.position.z = dist * Math.cos(angle);
        camera.lookAt(0, 0, 0);
      }
    };
    animate();
  }
}

window.BGPVisualizer3D = BGPVisualizer3D;
