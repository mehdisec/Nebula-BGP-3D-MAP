/**
 * Hover Detection & 2-Second Continuous Trigger Module
 * Manages the circular progress countdown ring and the dynamic floating AS HUD tooltip/modal.
 */

class HoverHUDManager {
  constructor() {
    this.HOVER_THRESHOLD_MS = 2000; // Continuous 2-second hover requirement
    this.hoverTimer = null;
    this.hoverStartTime = null;
    this.currentHoverNode = null;
    this.animFrameId = null;

    this.mouseX = 0;
    this.mouseY = 0;
    this.isHudOpen = false;

    this.progressRing = document.getElementById("hover-progress-ring");
    this.progressCircle = document.getElementById("progress-circle-val");
    this.progressText = document.getElementById("hover-progress-text");
    this.floatingHud = document.getElementById("floating-as-hud");

    // Track mouse position globally
    window.addEventListener("mousemove", (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;

      // Reposition progress ring next to cursor
      if (this.currentHoverNode && !this.isHudOpen && this.progressRing) {
        this.progressRing.style.left = `${this.mouseX + 22}px`;
        this.progressRing.style.top = `${this.mouseY - 22}px`;
      }
    });

    // Close HUD button handler
    const closeBtn = document.getElementById("hud-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hideFloatingHUD());
    }

    // Camera Focus button in HUD (also selects AS in sidebar)
    const focusBtn = document.getElementById("hud-focus-btn");
    if (focusBtn) {
      focusBtn.addEventListener("click", () => {
        if (this.activeHudNode) {
          if (window.bgpVisualizer) {
            window.bgpVisualizer.selectNode(this.activeHudNode);
          }
          if (window.selectAS) {
            window.selectAS(this.activeHudNode);
          }
          this.hideFloatingHUD();
        }
      });
    }
  }

  /**
   * Called by 3D Force Graph whenever the hovered node changes
   * @param {Object|null} node - The hovered node or null if mouse is in empty space
   */
  onNodeHover(node) {
    if (this.isHudOpen) {
      // If HUD is already open for this node, don't interrupt
      if (node && this.activeHudNode && node.id === this.activeHudNode.id) {
        return;
      }
    }

    // If mouse left the node or switched to another node
    if (!node || (this.currentHoverNode && this.currentHoverNode.id !== node.id)) {
      this.cancelHoverCountdown();
    }

    if (node) {
      this.currentHoverNode = node;
      this.startHoverCountdown(node);
    }
  }

  startHoverCountdown(node) {
    this.cancelHoverCountdown();
    this.currentHoverNode = node;
    this.hoverStartTime = performance.now();

    // Show countdown progress ring near cursor
    if (this.progressRing) {
      this.progressRing.style.display = "block";
      this.progressRing.style.left = `${this.mouseX + 22}px`;
      this.progressRing.style.top = `${this.mouseY - 22}px`;
    }

    const totalCircumference = 125.6; // 2 * PI * 20

    const updateFrame = () => {
      if (!this.currentHoverNode) return;

      const elapsed = performance.now() - this.hoverStartTime;
      const progress = Math.min(1.0, elapsed / this.HOVER_THRESHOLD_MS);

      // Animate SVG circular progress dashoffset
      if (this.progressCircle) {
        const offset = totalCircumference * (1.0 - progress);
        this.progressCircle.style.strokeDashoffset = offset.toFixed(1);
      }

      if (this.progressText) {
        const remainingSec = Math.max(0, ((this.HOVER_THRESHOLD_MS - elapsed) / 1000)).toFixed(1);
        this.progressText.innerText = `${remainingSec}s`;
      }

      if (progress >= 1.0) {
        // Continuous 2.0 seconds requirement reached!
        this.triggerHoverAction(this.currentHoverNode);
        return;
      }

      this.animFrameId = requestAnimationFrame(updateFrame);
    };

    this.animFrameId = requestAnimationFrame(updateFrame);
  }

  cancelHoverCountdown() {
    this.currentHoverNode = null;
    this.hoverStartTime = null;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.progressRing) {
      this.progressRing.style.display = "none";
    }

    if (this.progressCircle) {
      this.progressCircle.style.strokeDashoffset = "125.6";
    }
  }

  /**
   * Fires after 2 seconds continuous hover: displays dynamic floating tooltip/modal
   */
  triggerHoverAction(node) {
    this.cancelHoverCountdown();
    this.activeHudNode = node;
    this.showFloatingHUD(node, this.mouseX, this.mouseY);
  }

  showFloatingHUD(node, posX, posY) {
    if (!this.floatingHud) return;

    this.isHudOpen = true;

    // Populate HUD elements
    document.getElementById("hud-asn-label").innerText = `AS${node.asn}`;
    document.getElementById("hud-flag").innerText = node.flag || "🌐";
    document.getElementById("hud-name").innerText = node.name || `Autonomous System ${node.asn}`;
    document.getElementById("hud-country").innerText = `${node.country || "US"}`;
    document.getElementById("hud-depth").innerText = node.depth === 0 ? "Hop 0 (Core Target)" : `Hop ${node.depth} from Target`;
    document.getElementById("hud-tier").innerText = node.tier || (node.is_tier1 ? "Tier-1 Transit" : "Transit / Peer");
    document.getElementById("hud-peers").innerText = node.peer_count ? `${node.peer_count.toLocaleString()} Peers` : "Connected Peer";
    document.getElementById("hud-prefixes").innerText = node.prefixes_count ? `${node.prefixes_count} Announced Prefixes` : "Active Route";

    const rdapLink = document.getElementById("hud-rdap-link");
    if (rdapLink) {
      rdapLink.href = `https://rdap.arin.net/registry/autnum/${node.asn}`;
    }

    // Position HUD safely on screen (avoid overflowing off edges)
    const hudWidth = 360;
    const hudHeight = 310;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    let targetX = posX + 20;
    let targetY = posY - 100;

    if (targetX + hudWidth > screenW - 20) {
      targetX = posX - hudWidth - 20;
    }
    if (targetY + hudHeight > screenH - 20) {
      targetY = screenH - hudHeight - 20;
    }
    if (targetY < 20) {
      targetY = 20;
    }

    this.floatingHud.style.left = `${Math.max(10, targetX)}px`;
    this.floatingHud.style.top = `${Math.max(10, targetY)}px`;
    this.floatingHud.classList.add("active");

    // Fetch live supplementary AS details in background to enhance HUD if needed
    fetch(`/api/as/${node.asn}`)
      .then(res => res.json())
      .then(data => {
        if (this.isHudOpen && this.activeHudNode && this.activeHudNode.asn === data.asn) {
          if (data.org && data.org !== data.name) {
            document.getElementById("hud-name").innerText = `${data.name} (${data.org})`;
          }
          if (data.registration_date) {
            const regEl = document.getElementById("hud-regdate");
            if (regEl) {
              regEl.innerText = `Registered: ${data.registration_date}`;
              regEl.style.display = "block";
            }
          }
        }
      })
      .catch(() => {});
  }

  hideFloatingHUD() {
    if (!this.floatingHud) return;
    this.floatingHud.classList.remove("active");
    this.isHudOpen = false;
    this.activeHudNode = null;
  }
}

// Global instance
window.hoverHUD = new HoverHUDManager();
