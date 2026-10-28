/**
 * Main Application Controller
 * Handles user interactions, API querying, tab rendering, and UI synchronization.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize 3D Visualizer
  window.bgpVisualizer = new BGPVisualizer3D("3d-viewport");

  // Elements
  const ipInput = document.getElementById("ip-input");
  const depthSlider = document.getElementById("depth-slider");
  const depthVal = document.getElementById("depth-val");
  const traceBtn = document.getElementById("trace-btn");
  const loadingOverlay = document.getElementById("loading-overlay");
  const loadingStatus = document.getElementById("loading-status");
  const errorMessage = document.getElementById("error-toast");
  const errorText = document.getElementById("error-text");

  // Sample Chips
  const sampleChips = document.querySelectorAll(".sample-chip");
  sampleChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const ip = chip.getAttribute("data-ip");
      if (ip) {
        ipInput.value = ip;
        executeTrace(ip, parseInt(depthSlider.value, 10));
      }
    });
  });

  // Depth Slider Sync
  if (depthSlider && depthVal) {
    depthSlider.addEventListener("input", (e) => {
      depthVal.innerText = `${e.target.value} Hops`;
    });
  }

  // Submit Handler
  traceBtn.addEventListener("click", () => {
    const ip = ipInput.value.trim();
    if (!ip) {
      showError("Please enter a valid IPv4 or IPv6 address.");
      return;
    }
    const depth = parseInt(depthSlider.value, 10) || 10;
    executeTrace(ip, depth);
  });

  ipInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      traceBtn.click();
    }
  });

  // Tab Switching
  function switchTab(targetTab) {
    const tabButtons = document.querySelectorAll(".panel-tab-btn");
    const tabPanes = document.querySelectorAll(".panel-tab-pane");

    tabButtons.forEach(b => {
      if (b.getAttribute("data-tab") === targetTab) {
        b.classList.add("text-cyan-400", "border-cyan-400");
        b.classList.remove("text-slate-400", "border-transparent");
      } else {
        b.classList.remove("text-cyan-400", "border-cyan-400");
        b.classList.add("text-slate-400", "border-transparent");
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === `tab-${targetTab}`) {
        pane.classList.remove("hidden");
      } else {
        pane.classList.add("hidden");
      }
    });
  }

  const tabButtons = document.querySelectorAll(".panel-tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab"));
    });
  });

  // Controls Toolbar
  const resetCameraBtn = document.getElementById("btn-reset-camera");
  if (resetCameraBtn) {
    resetCameraBtn.addEventListener("click", () => window.bgpVisualizer.resetCamera());
  }

  const autoRotateBtn = document.getElementById("btn-auto-rotate");
  if (autoRotateBtn) {
    autoRotateBtn.addEventListener("click", () => {
      const active = window.bgpVisualizer.toggleAutoRotate();
      autoRotateBtn.classList.toggle("bg-cyan-500/20", active);
      autoRotateBtn.classList.toggle("text-cyan-300", active);
    });
  }

  const toggleLabelsBtn = document.getElementById("btn-toggle-labels");
  if (toggleLabelsBtn) {
    toggleLabelsBtn.addEventListener("click", () => {
      const visible = window.bgpVisualizer.toggleLabels();
      toggleLabelsBtn.classList.toggle("bg-cyan-500/20", visible);
      toggleLabelsBtn.classList.toggle("text-cyan-300", visible);
    });
  }

  const toggleSidebarBtn = document.getElementById("btn-toggle-sidebar");
  const sidePanel = document.getElementById("side-panel");
  if (toggleSidebarBtn && sidePanel) {
    toggleSidebarBtn.addEventListener("click", () => {
      sidePanel.classList.toggle("collapsed");
    });
  }

  // 2D Map Mode Toggle (Top-Left Header Button)
  const toggle2DBtn = document.getElementById("btn-toggle-2d");
  const btn2DIcon = document.getElementById("btn-2d-icon");
  const btn2DText = document.getElementById("btn-2d-text");
  const badgeViewMode = document.getElementById("badge-view-mode");

  if (toggle2DBtn) {
    toggle2DBtn.addEventListener("click", () => {
      if (!window.bgpVisualizer) return;
      const is2D = window.bgpVisualizer.toggle2DMode();
      if (is2D) {
        toggle2DBtn.classList.add("bg-purple-900/40", "border-purple-400", "text-purple-300");
        toggle2DBtn.classList.remove("bg-slate-900/90", "border-cyan-500/40", "text-cyan-300");
        if (btn2DIcon) btn2DIcon.innerText = "🌐";
        if (btn2DText) btn2DText.innerText = "3D View";
        if (badgeViewMode) {
          badgeViewMode.innerText = "2D PLANAR";
          badgeViewMode.className = "text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800";
        }
      } else {
        toggle2DBtn.classList.remove("bg-purple-900/40", "border-purple-400", "text-purple-300");
        toggle2DBtn.classList.add("bg-slate-900/90", "border-cyan-500/40", "text-cyan-300");
        if (btn2DIcon) btn2DIcon.innerText = "🗺️";
        if (btn2DText) btn2DText.innerText = "2D Map";
        if (badgeViewMode) {
          badgeViewMode.innerText = "3D RADIAL";
          badgeViewMode.className = "text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800";
        }
      }
    });
  }

  // Left Sidebar (Announced Prefixes) Controls
  const leftPanel = document.getElementById("left-panel");
  const btnCloseLeftPanel = document.getElementById("btn-close-left-panel");
  const btnOpenLeftPanel = document.getElementById("btn-open-left-panel");
  const lpPrefixSearch = document.getElementById("lp-prefix-search");
  const lpFilterBtns = document.querySelectorAll(".lp-filter-btn");

  if (btnCloseLeftPanel && leftPanel) {
    btnCloseLeftPanel.addEventListener("click", () => {
      leftPanel.classList.add("collapsed");
    });
  }

  if (btnOpenLeftPanel && leftPanel) {
    btnOpenLeftPanel.addEventListener("click", () => {
      leftPanel.classList.toggle("collapsed");
    });
  }

  let currentPrefixData = null;
  let currentProtocolFilter = "all";
  let prefixDisplayLimit = 80;

  if (lpPrefixSearch) {
    lpPrefixSearch.addEventListener("input", () => {
      prefixDisplayLimit = 80;
      renderPrefixesList();
    });
  }

  lpFilterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      currentProtocolFilter = btn.getAttribute("data-filter") || "all";
      lpFilterBtns.forEach(b => {
        if (b === btn) {
          b.className = "lp-filter-btn flex-1 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-center font-medium cursor-pointer";
        } else {
          b.className = "lp-filter-btn flex-1 py-1 rounded bg-slate-900 text-slate-400 border border-slate-800 text-center hover:text-slate-200 cursor-pointer";
        }
      });
      prefixDisplayLimit = 80;
      renderPrefixesList();
    });
  });

  // Export Announced Prefixes (TXT, CSV, JSON)
  const btnExportTxt = document.getElementById("btn-export-txt");
  const btnExportCsv = document.getElementById("btn-export-csv");
  const btnExportJson = document.getElementById("btn-export-json");

  if (btnExportTxt) {
    btnExportTxt.addEventListener("click", () => {
      if (!currentPrefixData || !currentPrefixData.asn) {
        showError("Please select an Autonomous System first to export its announced prefixes.");
        return;
      }
      exportPrefixesText(currentPrefixData);
    });
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener("click", () => {
      if (!currentPrefixData || !currentPrefixData.asn) {
        showError("Please select an Autonomous System first to export its announced prefixes.");
        return;
      }
      exportPrefixesCSV(currentPrefixData);
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener("click", () => {
      if (!currentPrefixData || !currentPrefixData.asn) {
        showError("Please select an Autonomous System first to export its announced prefixes.");
        return;
      }
      exportPrefixesJSON(currentPrefixData);
    });
  }

  // Toast Close Button
  const toastClose = document.getElementById("toast-close");
  if (toastClose) {
    toastClose.addEventListener("click", () => {
      errorMessage.classList.add("hidden");
    });
  }

  /**
   * Main Trace Execution Function
   */
  async function executeTrace(ip, depth) {
    showLoading(true, `Querying BGP Route Collectors & WHOIS for ${ip}...`);
    hideError();

    try {
      const url = `/api/trace?ip=${encodeURIComponent(ip)}&depth=${depth}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server returned HTTP ${response.status}`);
      }

      const data = await response.json();

      // Update Header Stats
      updateHeaderStats(data);

      // Render 3D Radial Graph
      window.bgpVisualizer.renderData(data);

      // Render Side Panel Tabs
      renderTargetSummaryTab(data);
      renderASNMetadataTab(data);
      renderWHOISTab(data);
      renderLookingGlassTab(data);

    } catch (err) {
      console.error("Trace failed:", err);
      showError(err.message || "Failed to complete BGP trace.");
    } finally {
      showLoading(false);
    }
  }

  function updateHeaderStats(data) {
    document.getElementById("stat-target-ip").innerText = data.target_ip;
    document.getElementById("stat-origin-as").innerText = `AS${data.origin_asn}`;
    document.getElementById("stat-total-nodes").innerText = data.graph.total_nodes;
    document.getElementById("stat-total-links").innerText = data.graph.total_links;
    document.getElementById("stat-max-depth").innerText = `${data.graph.max_depth} Hops`;
    document.getElementById("stat-tier1-count").innerText = `${data.summary.tier1_connected || 0} Tier-1`;
  }

  function renderTargetSummaryTab(data) {
    const meta = data.ip_metadata;
    const container = document.getElementById("tab-target");
    if (!container) return;

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Main Card -->
        <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono tracking-wider text-cyan-400 uppercase">Target Endpoint</span>
            <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              IPv${meta.version}
            </span>
          </div>
          <div class="text-2xl font-bold font-mono text-white flex items-center gap-2">
            <span>${meta.ip}</span>
            <span class="text-xl">${meta.flag}</span>
          </div>
          <div class="text-xs text-slate-300 font-mono">
            Prefix: <span class="text-cyan-300 font-bold">${meta.prefix || 'N/A'}</span>
          </div>
        </div>

        <!-- Geolocation & Network Info -->
        <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2.5 text-xs">
          <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Network & Location</div>
          
          <div class="flex justify-between py-1 border-b border-slate-800">
            <span class="text-slate-400">Organization</span>
            <span class="text-slate-200 font-medium text-right">${meta.org || meta.as_name || 'N/A'}</span>
          </div>

          <div class="flex justify-between py-1 border-b border-slate-800">
            <span class="text-slate-400">ISP Provider</span>
            <span class="text-slate-200 font-medium text-right">${meta.isp || meta.as_name || 'N/A'}</span>
          </div>

          <div class="flex justify-between py-1 border-b border-slate-800">
            <span class="text-slate-400">Country / Region</span>
            <span class="text-slate-200 font-medium">${meta.flag} ${meta.country || 'Unknown'}, ${meta.region || ''}</span>
          </div>

          <div class="flex justify-between py-1 border-b border-slate-800">
            <span class="text-slate-400">City</span>
            <span class="text-slate-200 font-medium">${meta.city || 'N/A'}</span>
          </div>

          <div class="flex justify-between py-1 border-b border-slate-800">
            <span class="text-slate-400">Coordinates</span>
            <span class="text-cyan-300 font-mono">${meta.lat && meta.lon ? `${meta.lat.toFixed(2)}, ${meta.lon.toFixed(2)}` : 'N/A'}</span>
          </div>

          <div class="flex justify-between py-1">
            <span class="text-slate-400">Timezone</span>
            <span class="text-slate-300">${meta.timezone || 'UTC'}</span>
          </div>
        </div>

        <!-- Quick Action -->
        <button id="btn-focus-target" class="w-full py-2.5 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/></svg>
          Re-center 3D Camera on Target
        </button>
      </div>
    `;

    document.getElementById("btn-focus-target").addEventListener("click", () => {
      const targetNode = data.graph.nodes.find(n => n.is_target);
      if (targetNode) window.bgpVisualizer.focusOnNode(targetNode);
    });
  }

  /**
   * Main AS Inspector function: Invoked whenever an AS node is clicked or chosen.
   * Updates the right sidebar with the complete profile of the selected AS.
   */
  async function selectAS(nodeOrAsn) {
    if (!nodeOrAsn) return;

    let asn = null;
    let node = null;

    if (typeof nodeOrAsn === "object") {
      asn = nodeOrAsn.asn;
      node = nodeOrAsn;
    } else {
      asn = parseInt(String(nodeOrAsn).replace(/AS/i, ""), 10);
      if (window.bgpVisualizer && window.bgpVisualizer.currentData) {
        node = (window.bgpVisualizer.currentData.graph.nodes || []).find(n => n.asn === asn);
      }
    }

    if (!asn) return;

    // Ensure sidebar is visible
    const sidePanel = document.getElementById("side-panel");
    if (sidePanel) sidePanel.classList.remove("collapsed");

    // Automatically switch active tab to AS Inspector
    switchTab("asn");

    // Update AS Inspector tab badge
    const badge = document.getElementById("tab-asn-badge");
    if (badge) {
      badge.innerText = `AS${asn}`;
      badge.classList.remove("hidden");
    }

    // Highlight selected node and its links in visualizer without displacing the map
    if (window.bgpVisualizer) {
      const activeNode = node || (window.bgpVisualizer.currentData?.graph?.nodes || []).find(n => n.asn === asn);
      if (activeNode) {
        window.bgpVisualizer.selectNode(activeNode);
      }
    }

    // Render immediate topology node details
    renderSelectedASCard(node || { asn, name: `AS${asn}`, country: "US", flag: "🌐", tier: "Transit / Peer" }, true);

    // Concurrently load announced prefixes in the Left Sidebar
    loadASPrefixes(asn, node);

    // Concurrently fetch real-time full AS details from backend (/api/as/{asn})
    try {
      const res = await fetch(`/api/as/${asn}`);
      if (res.ok) {
        const fullDetail = await res.json();
        const merged = {
          ...(node || {}),
          ...fullDetail
        };
        renderSelectedASCard(merged, false);

        // Enrich currentPrefixData with complete AS specifications
        if (currentPrefixData && currentPrefixData.asn === asn) {
          currentPrefixData.name = fullDetail.name || currentPrefixData.name;
          currentPrefixData.country = fullDetail.country || currentPrefixData.country;
          currentPrefixData.flag = fullDetail.flag || currentPrefixData.flag;
          currentPrefixData.tier = fullDetail.tier || currentPrefixData.tier;
          currentPrefixData.is_tier1 = fullDetail.is_tier1 !== undefined ? fullDetail.is_tier1 : currentPrefixData.is_tier1;
          currentPrefixData.peer_count = fullDetail.peer_count !== undefined ? fullDetail.peer_count : currentPrefixData.peer_count;
          currentPrefixData.registration_date = fullDetail.registration_date;
          currentPrefixData.rdap_url = fullDetail.rdap_url;
        }
      }
    } catch (e) {
      console.warn("Could not fetch supplementary details for AS" + asn, e);
      if (node) renderSelectedASCard(node, false);
    }
  }

  window.selectAS = selectAS;

  function renderSelectedASCard(asData, isLoading) {
    const container = document.getElementById("tab-asn");
    if (!container) return;

    const isTarget = asData.is_target || (window.bgpVisualizer?.currentData?.origin_asn === asData.asn);
    const hopLabel = asData.depth !== undefined 
      ? (asData.depth === 0 ? "Hop 0 (Core Target)" : `Hop ${asData.depth} from Target`)
      : "Topology Node";

    const tierClass = asData.is_tier1
      ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
      : (isTarget ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30");

    // Connected neighbor peers
    let peersListHtml = "";
    const topPeers = asData.top_peers || [];
    if (topPeers.length > 0) {
      peersListHtml = `
        <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2.5 text-xs">
          <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Direct Neighbor Peers</span>
            <span class="text-cyan-400 font-mono">${asData.peer_count ? asData.peer_count.toLocaleString() : topPeers.length} Peers</span>
          </div>
          <div class="flex flex-wrap gap-1.5 pt-1">
            ${topPeers.map(pAsn => `
              <button class="dynamic-peer-btn text-[11px] font-mono px-2 py-1 rounded bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 border border-slate-700 transition" data-asn="${pAsn}">
                AS${pAsn}
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Selected AS Header Profile Card -->
        <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-3 relative overflow-hidden">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              Selected AS Profile
            </span>
            <span class="px-2 py-0.5 rounded text-[11px] font-semibold border ${tierClass}">
              ${asData.tier || (asData.is_tier1 ? "Tier-1 Transit" : "Transit / Peer")}
            </span>
          </div>
          
          <div class="text-2xl font-bold font-mono text-white flex items-center gap-2">
            <span>AS${asData.asn}</span>
            <span>${asData.flag || "🌐"}</span>
            <span class="text-xs font-normal font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              ${asData.country || "US"}
            </span>
          </div>

          <div class="text-sm font-semibold text-slate-200">
            ${asData.org || asData.name || `Autonomous System ${asData.asn}`}
          </div>

          <div class="flex items-center gap-2 pt-1 text-xs font-mono">
            <span class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              ${hopLabel}
            </span>
            ${asData.is_tier1 ? '<span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Tier-1 Backbone</span>' : ''}
          </div>
        </div>

        <!-- Telemetry Metrics Grid -->
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <div class="text-slate-400 mb-1">Total Peers</div>
            <div class="text-lg font-bold font-mono text-cyan-300">${asData.peer_count ? asData.peer_count.toLocaleString() : '1+'}</div>
          </div>
          <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <div class="text-slate-400 mb-1">Announced Routes</div>
            <div class="text-lg font-bold font-mono text-purple-300">${asData.prefixes_count ? asData.prefixes_count + '+' : 'Active'}</div>
          </div>
        </div>

        <!-- Registry & Allocation Details -->
        <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2 text-xs">
          <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Registration Telemetry</div>
          
          <div class="flex justify-between py-1 border-b border-slate-800">
            <span class="text-slate-400">RIR Registry</span>
            <span class="text-slate-200 font-mono">${asData.registry || 'ARIN / RIPE'}</span>
          </div>

          <div class="flex justify-between py-1 border-b border-slate-800">
            <span class="text-slate-400">Registration Date</span>
            <span class="text-slate-200">${asData.registration_date || 'Historically Assigned'}</span>
          </div>

          <div class="flex justify-between py-1">
            <span class="text-slate-400">BGP Routing State</span>
            <span class="text-emerald-400 font-medium flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Globally Announced
            </span>
          </div>
        </div>

        ${peersListHtml}

        <!-- Action Buttons -->
        <div class="space-y-2 pt-1">
          <button id="btn-focus-selected-as" class="w-full py-2.5 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/></svg>
            Center 3D Camera on AS${asData.asn}
          </button>

          <button id="btn-trace-selected-as" class="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.2)] transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Trace Route for AS${asData.asn}
          </button>

          <a href="${asData.rdap_url || `https://rdap.arin.net/registry/autnum/${asData.asn}`}" target="_blank" rel="noopener" class="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            Open Official RDAP Record
          </a>
        </div>
      </div>
    `;

    // Hook up center camera button
    const focusBtn = document.getElementById("btn-focus-selected-as");
    if (focusBtn) {
      focusBtn.addEventListener("click", () => {
        if (window.bgpVisualizer && window.bgpVisualizer.currentData) {
          const n = (window.bgpVisualizer.currentData.graph.nodes || []).find(node => node.asn === asData.asn);
          if (n) window.bgpVisualizer.focusOnNode(n);
        }
      });
    }

    // Hook up trace route for this AS button
    const traceAsBtn = document.getElementById("btn-trace-selected-as");
    if (traceAsBtn) {
      traceAsBtn.addEventListener("click", () => {
        const ipInput = document.getElementById("ip-input");
        const depthSlider = document.getElementById("depth-slider");
        if (ipInput) ipInput.value = `AS${asData.asn}`;
        const depth = depthSlider ? (parseInt(depthSlider.value, 10) || 10) : 10;
        executeTrace(`AS${asData.asn}`, depth);
      });
    }

    // Hook up peer button clicks
    container.querySelectorAll(".dynamic-peer-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const pAsn = btn.getAttribute("data-asn");
        if (pAsn) selectAS(parseInt(pAsn, 10));
      });
    });
  }

  function renderASNMetadataTab(data) {
    if (data && data.asn_metadata) {
      renderSelectedASCard(data.asn_metadata, false);
    }
  }

  function renderWHOISTab(data) {
    const whois = data.whois;
    const container = document.getElementById("tab-whois");
    if (!container) return;

    let abuseHtml = "";
    if (whois.abuse_emails && whois.abuse_emails.length > 0) {
      abuseHtml = `
        <div class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs space-y-1">
          <div class="font-semibold text-rose-300 flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            Abuse Contact
          </div>
          <div class="text-rose-200 font-mono">${whois.abuse_emails.join(", ")}</div>
        </div>
      `;
    }

    let recordsHtml = "";
    const allRecords = [...whois.ip_whois, ...whois.asn_whois];

    if (allRecords.length === 0) {
      recordsHtml = `<div class="text-xs text-slate-400 italic">No structured WHOIS records available.</div>`;
    } else {
      recordsHtml = allRecords.map(rec => `
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-2">
          <div class="font-semibold text-cyan-300 border-b border-slate-800 pb-1">${rec.title}</div>
          <div class="space-y-1 font-mono text-[11px]">
            ${rec.fields.map(f => `
              <div class="flex justify-between py-0.5">
                <span class="text-slate-400 font-medium">${f.key}:</span>
                <span class="text-slate-200 text-right break-all max-w-[65%]">${f.value}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("");
    }

    container.innerHTML = `
      <div class="space-y-4">
        ${abuseHtml}
        <div class="space-y-3">
          ${recordsHtml}
        </div>
      </div>
    `;
  }

  function renderLookingGlassTab(data) {
    const paths = data.looking_glass_paths || [];
    const container = document.getElementById("tab-lg");
    if (!container) return;

    if (paths.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-400 italic">No looking glass paths recorded for this prefix.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="space-y-3">
        <div class="text-xs text-slate-400 flex justify-between">
          <span>Observed BGP Paths</span>
          <span class="font-mono text-cyan-300">${paths.length} Vantage Collectors</span>
        </div>
        <div class="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
          ${paths.map(p => `
            <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1.5 hover:border-slate-700 transition">
              <div class="flex items-center justify-between text-[11px]">
                <span class="font-semibold text-slate-300 font-mono">${p.collector}</span>
                <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">${p.length} Hops</span>
              </div>
              <div class="font-mono text-[11px] text-cyan-400 bg-black/40 p-1.5 rounded border border-slate-800/80 break-words leading-relaxed">
                ${p.path_str}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function showLoading(show, message = "Processing BGP Topology...") {
    if (loadingOverlay) {
      loadingOverlay.classList.toggle("hidden", !show);
      if (loadingStatus) loadingStatus.innerText = message;
    }
  }

  function showError(msg) {
    if (errorMessage && errorText) {
      errorText.innerText = msg;
      errorMessage.classList.remove("hidden");
    }
  }

  function hideError() {
    if (errorMessage) {
      errorMessage.classList.add("hidden");
    }
  }

  async function loadASPrefixes(asn, nodeInfo) {
    const leftPanel = document.getElementById("left-panel");
    const lpBadgeCount = document.getElementById("lp-badge-count");
    const lpFlag = document.getElementById("lp-as-flag");
    const lpNumber = document.getElementById("lp-as-number");
    const lpCountry = document.getElementById("lp-as-country");
    const lpName = document.getElementById("lp-as-name");
    const container = document.getElementById("lp-prefixes-container");

    if (!container) return;

    // Automatically open left panel
    if (leftPanel) leftPanel.classList.remove("collapsed");

    // Set immediate identity header
    if (lpNumber) lpNumber.innerText = `AS${asn}`;
    if (lpName) lpName.innerText = nodeInfo?.name || `Autonomous System ${asn}`;
    if (lpFlag) lpFlag.innerText = nodeInfo?.flag || "🌐";
    if (lpCountry) {
      if (nodeInfo?.country) {
        lpCountry.innerText = nodeInfo.country;
        lpCountry.classList.remove("hidden");
      } else {
        lpCountry.classList.add("hidden");
      }
    }

    // Set loading indicator
    container.innerHTML = `
      <div class="p-6 text-center text-xs space-y-3 font-mono">
        <div class="w-7 h-7 mx-auto rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
        <div class="text-cyan-300 font-semibold">Loading Prefixes for AS${asn}...</div>
        <div class="text-slate-500 text-[11px]">Querying RIPE RIS Announced Routing Tables</div>
      </div>
    `;

    try {
      const res = await fetch(`/api/as/${asn}/prefixes`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      currentPrefixData = {
        ...data,
        tier: nodeInfo?.tier || (data.is_tier1 ? "Tier-1 Global Transit" : "Transit / Peer"),
        is_tier1: nodeInfo?.is_tier1 || data.is_tier1 || false,
        peer_count: nodeInfo?.peer_count !== undefined ? nodeInfo.peer_count : (data.peer_count || 0)
      };
      prefixDisplayLimit = 80;

      // Update Header with fetched metadata
      if (data.name && lpName) lpName.innerText = data.name;
      if (data.flag && lpFlag) lpFlag.innerText = data.flag;
      if (data.country && lpCountry) {
        lpCountry.innerText = data.country;
        lpCountry.classList.remove("hidden");
      }

      // Update counters on protocol tabs
      const countAll = document.getElementById("lp-count-all");
      const countV4 = document.getElementById("lp-count-v4");
      const countV6 = document.getElementById("lp-count-v6");
      if (countAll) countAll.innerText = `(${data.total_count})`;
      if (countV4) countV4.innerText = `(${data.v4_count})`;
      if (countV6) countV6.innerText = `(${data.v6_count})`;
      if (lpBadgeCount) {
        lpBadgeCount.innerText = `${data.total_count} CIDRs`;
        lpBadgeCount.classList.remove("hidden");
      }

      renderPrefixesList();
    } catch (err) {
      console.warn("Error fetching announced prefixes:", err);
      container.innerHTML = `
        <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-center space-y-2 font-mono">
          <div class="text-rose-300 font-semibold">Failed to fetch prefixes</div>
          <div class="text-slate-400 text-[11px]">${err.message || "Network error"}</div>
          <button id="lp-retry-btn" class="mt-2 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] cursor-pointer">
            Retry
          </button>
        </div>
      `;
      const retryBtn = document.getElementById("lp-retry-btn");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => loadASPrefixes(asn, nodeInfo));
      }
    }
  }

  function renderPrefixesList() {
    const container = document.getElementById("lp-prefixes-container");
    const renderedCountEl = document.getElementById("lp-rendered-count");
    if (!container || !currentPrefixData) return;

    let items = [];
    if (currentProtocolFilter === "v4") {
      items = currentPrefixData.prefixes_v4 || [];
    } else if (currentProtocolFilter === "v6") {
      items = currentPrefixData.prefixes_v6 || [];
    } else {
      items = currentPrefixData.prefixes || [];
    }

    const searchQuery = (lpPrefixSearch?.value || "").trim().toLowerCase();
    if (searchQuery) {
      items = items.filter(p => p.toLowerCase().includes(searchQuery));
    }

    if (renderedCountEl) {
      renderedCountEl.innerText = `${items.length} of ${currentPrefixData.total_count} prefixes`;
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-500 italic font-mono">
          No announced prefixes match current filter criteria.
        </div>
      `;
      return;
    }

    const visibleItems = items.slice(0, prefixDisplayLimit);
    const hasMore = items.length > prefixDisplayLimit;

    const html = visibleItems.map(prefix => {
      const isV6 = prefix.includes(":");
      const badgeClass = isV6
        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
        : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      const badgeText = isV6 ? "v6" : "v4";

      return `
        <div class="prefix-item-card p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono group">
          <div class="flex items-center gap-2 min-w-0 pr-2">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeClass} shrink-0">${badgeText}</span>
            <span class="text-slate-200 font-semibold truncate hover:text-cyan-300 transition select-all" title="${prefix}">${prefix}</span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button class="lp-copy-prefix-btn p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
              data-prefix="${prefix}" title="Copy CIDR prefix">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </button>
            <button class="lp-trace-prefix-btn px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-400 border border-slate-700/80 text-[10px] transition cursor-pointer flex items-center gap-1"
              data-prefix="${prefix}" title="Trace this prefix topology">
              <span>Trace</span>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join("");

    let moreBtnHtml = "";
    if (hasMore) {
      moreBtnHtml = `
        <div class="pt-2 text-center">
          <button id="lp-show-more-btn" class="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-400 font-mono text-xs transition cursor-pointer">
            Show More (+80 of ${items.length - prefixDisplayLimit} remaining)
          </button>
        </div>
      `;
    }

    container.innerHTML = html + moreBtnHtml;

    // Attach Copy listeners
    container.querySelectorAll(".lp-copy-prefix-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const p = btn.getAttribute("data-prefix");
        if (!p) return;
        try {
          await navigator.clipboard.writeText(p);
          btn.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
          setTimeout(() => {
            btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>`;
          }, 1500);
        } catch (err) {
          console.warn("Copy to clipboard failed", err);
        }
      });
    });

    // Attach Trace listeners
    container.querySelectorAll(".lp-trace-prefix-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = btn.getAttribute("data-prefix");
        if (p) {
          ipInput.value = p;
          const depth = parseInt(depthSlider.value, 10) || 10;
          executeTrace(p, depth);
        }
      });
    });

    // Attach Show More listener
    const showMoreBtn = document.getElementById("lp-show-more-btn");
    if (showMoreBtn) {
      showMoreBtn.addEventListener("click", () => {
        prefixDisplayLimit += 80;
        renderPrefixesList();
      });
    }
  }

  /**
   * Export Utilities: Download file to user's computer
   */
  function downloadFile(filename, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showExportToast(`Downloaded ${filename}`);
  }

  function showExportToast(msg) {
    const toast = document.createElement("div");
    toast.className = "fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-cyan-400/50 text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.25)] text-xs font-mono flex items-center gap-2 transition-all duration-300 pointer-events-none";
    toast.innerHTML = `
      <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>${msg}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 400);
    }, 2800);
  }

  /**
   * Export as plain text (.txt) with comprehensive AS Number specifications header
   */
  function exportPrefixesText(data) {
    if (!data) return;
    const now = new Date();
    const timestampStr = now.toISOString().replace("T", " ").replace(/\..+/, " UTC");
    const fileTimestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);

    const v4List = data.prefixes_v4 || [];
    const v6List = data.prefixes_v6 || [];
    const totalCount = data.total_count || (v4List.length + v6List.length);

    let txt = `================================================================================\n`;
    txt += `NEBULA // BGP RADAR - AUTONOMOUS SYSTEM PREFIX SPECIFICATION REPORT\n`;
    txt += `Export Generated: ${timestampStr}\n`;
    txt += `================================================================================\n\n`;

    txt += `[AS SPECIFICATIONS & REGISTRY IDENTITY]\n`;
    txt += `--------------------------------------------------------------------------------\n`;
    txt += `Autonomous System:     AS${data.asn}\n`;
    txt += `Organization Name:     ${data.name || 'AS' + data.asn}\n`;
    txt += `Country / Flag:        ${data.country || 'N/A'} ${data.flag || ''}\n`;
    txt += `Network Tier / Role:   ${data.tier || 'Transit / Peer'}\n`;
    txt += `Tier-1 Backbone:       ${data.is_tier1 ? 'Yes (Global Tier-1 Transit)' : 'No'}\n`;
    if (data.peer_count) {
      txt += `Observed Peer Count:   ${data.peer_count} BGP Peers\n`;
    }
    if (data.registration_date) {
      txt += `Registration Date:     ${data.registration_date}\n`;
    }
    if (data.rdap_url) {
      txt += `Registry RDAP:         ${data.rdap_url}\n`;
    }
    txt += `Total Announced CIDRs: ${totalCount}\n`;
    txt += `IPv4 Prefixes Count:   ${data.v4_count || v4List.length}\n`;
    txt += `IPv6 Prefixes Count:   ${data.v6_count || v6List.length}\n`;
    txt += `Data Source:           RIPE NCC RIS (Routing Information Service) & Route Collectors\n`;
    txt += `--------------------------------------------------------------------------------\n\n`;

    txt += `================================================================================\n`;
    txt += `IPV4 ANNOUNCED PREFIXES (${v4List.length})\n`;
    txt += `================================================================================\n`;
    if (v4List.length === 0) {
      txt += `(No IPv4 prefixes announced)\n`;
    } else {
      v4List.forEach((p, i) => {
        txt += `${String(i + 1).padStart(5, " ")}.  ${p}\n`;
      });
    }

    txt += `\n================================================================================\n`;
    txt += `IPV6 ANNOUNCED PREFIXES (${v6List.length})\n`;
    txt += `================================================================================\n`;
    if (v6List.length === 0) {
      txt += `(No IPv6 prefixes announced)\n`;
    } else {
      v6List.forEach((p, i) => {
        txt += `${String(i + 1).padStart(5, " ")}.  ${p}\n`;
      });
    }

    txt += `\n================================================================================\n`;
    txt += `[END OF REPORT - NEBULA BGP RADAR]\n`;
    txt += `================================================================================\n`;

    downloadFile(`AS${data.asn}_prefixes_${fileTimestamp}.txt`, "text/plain;charset=utf-8", txt);
  }

  /**
   * Export as CSV spreadsheet (.csv) with AS Number metadata header and row attributes
   */
  function exportPrefixesCSV(data) {
    if (!data) return;
    const now = new Date();
    const timestampStr = now.toISOString();
    const fileTimestamp = timestampStr.replace(/[:.]/g, "-").slice(0, 19);

    const v4List = data.prefixes_v4 || [];
    const v6List = data.prefixes_v6 || [];
    const allList = data.prefixes || [...v4List, ...v6List];
    const totalCount = data.total_count || allList.length;

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    let csv = `# NEBULA // BGP RADAR - AS ANNOUNCED PREFIXES EXPORT\n`;
    csv += `# Autonomous System: AS${data.asn}\n`;
    csv += `# AS Name / Organization: ${escapeCSV(data.name || 'AS' + data.asn)}\n`;
    csv += `# Country: ${escapeCSV(data.country || 'N/A')}\n`;
    csv += `# Network Tier: ${escapeCSV(data.tier || 'Transit / Peer')}\n`;
    csv += `# Tier-1 Backbone: ${data.is_tier1 ? 'Yes' : 'No'}\n`;
    csv += `# Total Announced Prefixes: ${totalCount}\n`;
    csv += `# IPv4 Count: ${data.v4_count || v4List.length}\n`;
    csv += `# IPv6 Count: ${data.v6_count || v6List.length}\n`;
    csv += `# Exported At (UTC): ${timestampStr}\n`;
    csv += `# Data Source: RIPE NCC RIS\n`;
    csv += `asn,as_name,country,ip_version,prefix,cidr_length,exported_at_utc\n`;

    allList.forEach(prefix => {
      const isV6 = prefix.includes(":");
      const version = isV6 ? "IPv6" : "IPv4";
      const cidrLen = prefix.includes("/") ? prefix.split("/")[1] : "";
      csv += `${data.asn},${escapeCSV(data.name || 'AS' + data.asn)},${escapeCSV(data.country || 'US')},${version},${escapeCSV(prefix)},${cidrLen},${escapeCSV(timestampStr)}\n`;
    });

    downloadFile(`AS${data.asn}_prefixes_${fileTimestamp}.csv`, "text/csv;charset=utf-8", csv);
  }

  /**
   * Export as structured JSON (.json) with complete AS specifications object & categorized prefix arrays
   */
  function exportPrefixesJSON(data) {
    if (!data) return;
    const now = new Date();
    const timestampStr = now.toISOString();
    const fileTimestamp = timestampStr.replace(/[:.]/g, "-").slice(0, 19);

    const v4List = data.prefixes_v4 || [];
    const v6List = data.prefixes_v6 || [];
    const allList = data.prefixes || [...v4List, ...v6List];
    const totalCount = data.total_count || allList.length;

    const exportObj = {
      report_title: "NEBULA BGP RADAR - Autonomous System Announced Prefixes",
      generator: "NEBULA // BGP RADAR v2.0",
      exported_at_utc: timestampStr,
      as_specification: {
        asn: data.asn,
        asn_formatted: `AS${data.asn}`,
        as_name: data.name || `AS${data.asn}`,
        country_code: data.country || "US",
        flag: data.flag || "🌐",
        tier: data.tier || "Transit / Peer",
        is_tier1: Boolean(data.is_tier1),
        peer_count: data.peer_count !== undefined ? data.peer_count : null,
        registration_date: data.registration_date || null,
        rdap_url: data.rdap_url || null,
        data_source: "RIPE NCC RIS (Routing Information Service)"
      },
      statistics: {
        total_announced_prefixes: totalCount,
        ipv4_count: data.v4_count || v4List.length,
        ipv6_count: data.v6_count || v6List.length
      },
      prefixes: allList.map(p => {
        const isV6 = p.includes(":");
        return {
          prefix: p,
          version: isV6 ? "IPv6" : "IPv4",
          cidr_length: p.includes("/") ? parseInt(p.split("/")[1], 10) : null
        };
      }),
      prefixes_v4: v4List,
      prefixes_v6: v6List
    };

    const jsonContent = JSON.stringify(exportObj, null, 2);
    downloadFile(`AS${data.asn}_prefixes_${fileTimestamp}.json`, "application/json;charset=utf-8", jsonContent);
  }

  // Standby initial state for sidebar panels
  function renderInitialSidebarStandby() {
    const targetTab = document.getElementById("tab-target");
    if (targetTab) {
      targetTab.innerHTML = `
        <div class="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-center space-y-3 py-8">
          <div class="w-10 h-10 mx-auto rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="font-mono text-slate-300 font-semibold">Awaiting Target Input</div>
          <div class="text-slate-500 leading-relaxed max-w-xs mx-auto">
            Enter an IP address, CIDR range (e.g. <span class="text-cyan-400">1.1.1.0/24</span>), or ASN (<span class="text-purple-400">AS15169</span>) above to initialize the 3D topology.
          </div>
        </div>
      `;
    }

    const asnTab = document.getElementById("tab-asn");
    if (asnTab) {
      asnTab.innerHTML = `
        <div class="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-center space-y-3 py-8">
          <div class="w-10 h-10 mx-auto rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/></svg>
          </div>
          <div class="font-mono text-slate-300 font-semibold">AS Inspector Standby</div>
          <div class="text-slate-500 leading-relaxed max-w-xs mx-auto">
            Click on any AS node in the 3D topology or select an AS from the list to inspect its routing details, peering relationships, and WHOIS records.
          </div>
        </div>
      `;
    }

    const lpContainer = document.getElementById("lp-prefixes-container");
    if (lpContainer) {
      lpContainer.innerHTML = `
        <div class="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-center space-y-3 py-8">
          <div class="w-10 h-10 mx-auto rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
          </div>
          <div class="font-mono text-slate-300 font-semibold">No AS Selected</div>
          <div class="text-slate-500 leading-relaxed max-w-xs mx-auto">
            Click on any AS in the network map or select one to view all announced IPv4 & IPv6 prefixes.
          </div>
        </div>
      `;
    }
  }

  // Initialize standby state on startup
  renderInitialSidebarStandby();
});
