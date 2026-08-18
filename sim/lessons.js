// Simulated lesson lifecycles.
//
// Each lesson mirrors the state shape its Control Panel manager returns, so the
// unmodified app.js files cannot tell the difference. State lives in
// sessionStorage because in the real project containers keep running while you
// navigate between pages.
window.SiliconLanesSim = window.SiliconLanesSim || {};

(function (sim) {
  const storageKey = "silicon-lanes-sim";
  let store = {};
  try {
    store = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "{}");
  } catch {
    store = {};
  }

  function persist() {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(store));
    } catch {
      // Private-mode browsers refuse writes; the lesson still works for this page view.
    }
  }

  function slot(id, initial) {
    if (!store[id]) store[id] = initial();
    return store[id];
  }

  // Matches what the browser throws when nothing is listening on the port.
  function connectionRefused() {
    return new TypeError("Failed to fetch");
  }

  function jsonResponse(body, { status = 200, statusText = "OK", headers = {} } = {}) {
    return new Response(JSON.stringify(body), {
      status,
      statusText,
      headers: { "content-type": "application/json; charset=utf-8", ...headers }
    });
  }

  function catalogPayload(server) {
    return { data: sim.products, servedBy: { service: "Catalog Service", server } };
  }

  function replica(sequence) {
    return {
      id: sim.containerId(),
      name: `catalogService${sequence}`,
      sequence,
      hostPort: sim.catalogPort(sequence),
      containerPort: 6212,
      startedAt: new Date().toISOString(),
      log: []
    };
  }

  function exposeReplica(instance, ownedByLesson = true) {
    return {
      id: instance.id,
      shortId: instance.id.slice(0, 12),
      name: instance.name,
      serviceKey: "catalog",
      sequence: instance.sequence,
      state: "running",
      running: true,
      hostPort: instance.hostPort,
      containerPort: instance.containerPort,
      startedAt: instance.startedAt,
      ownedByLesson
    };
  }

  // ---------------------------------------------------------------- Lesson 1
  // One Catalog Service replica, called directly by the browser.
  const lesson01 = {
    id: "lesson-01-direct-service",
    data: slot("lesson-01-direct-service", () => ({ running: false, instance: null, serviceLog: [] })),

    state() {
      const { running, instance } = this.data;
      return {
        running,
        ownedByLesson: running,
        instance: running && instance ? {
          id: instance.id,
          name: instance.name,
          hostPort: instance.hostPort,
          containerPort: instance.containerPort,
          directUrl: `http://localhost:${instance.hostPort}/api/products`
        } : null
      };
    },

    async start() {
      if (!this.data.running) {
        await sim.delay(sim.latency.containerStart());
        this.data.instance = replica(1);
        this.data.running = true;
        this.data.serviceLog = [];
        persist();
      }
      return this.state();
    },

    async stop() {
      Object.assign(this.data, { running: false, instance: null, serviceLog: [] });
      persist();
    },

    logs() {
      return {
        logs: this.data.running
          ? sim.renderLines(this.data.serviceLog, "No requests received yet.")
          : "Start the service to see its request log."
      };
    },

    clearLogs() {
      this.data.serviceLog = [];
      persist();
    },

    async origin() {
      if (!this.data.running) throw connectionRefused();
      await sim.delay(sim.latency.serviceQuery());
      sim.pushLine(this.data.serviceLog, sim.serviceLine("GET", "/api/products"));
      persist();
      const server = this.data.instance.name;
      return jsonResponse(catalogPayload(server), {
        headers: { "x-service-name": "Catalog Service", "x-request-server": server }
      });
    }
  };

  // ---------------------------------------------------------------- Lesson 2
  // Nginx reverse proxy with a 15s response cache in front of one replica.
  const lesson02 = {
    id: "lesson-02-reverse-proxy",
    cacheTtlSeconds: 15,
    data: slot("lesson-02-reverse-proxy", () => ({
      running: false, proxyId: null, instance: null, cachedAt: null, proxyLog: [], serviceLog: []
    })),

    state() {
      const { running, proxyId, instance } = this.data;
      if (!running) {
        return { running: false, cacheTtlSeconds: this.cacheTtlSeconds, proxy: null, service: null };
      }
      return {
        running: true,
        cacheTtlSeconds: this.cacheTtlSeconds,
        proxy: {
          id: proxyId,
          name: "reverseProxy1",
          hostPort: 7212,
          containerPort: 80,
          directUrl: "http://localhost:7212/api/products"
        },
        service: {
          id: instance.id,
          name: instance.name,
          hostPort: instance.hostPort,
          containerPort: instance.containerPort,
          ownedByLesson: true
        }
      };
    },

    async start() {
      if (!this.data.running) {
        await sim.delay(sim.latency.containerStart());
        this.data.instance = replica(1);
        this.data.proxyId = sim.containerId();
        this.data.running = true;
        this.data.cachedAt = null;
        this.data.proxyLog = [];
        this.data.serviceLog = [];
        persist();
      }
      return this.state();
    },

    async stop() {
      Object.assign(this.data, {
        running: false, proxyId: null, instance: null, cachedAt: null, proxyLog: [], serviceLog: []
      });
      persist();
    },

    logs() {
      if (!this.data.running) {
        return {
          proxyLogs: "Start the lesson to see Reverse Proxy requests.",
          serviceLogs: "Start the lesson to see Catalog Service requests."
        };
      }
      return {
        proxyLogs: sim.renderLines(this.data.proxyLog, "No proxy requests received yet."),
        serviceLogs: sim.renderLines(this.data.serviceLog, "No requests received yet.")
      };
    },

    clearLogs() {
      this.data.proxyLog = [];
      this.data.serviceLog = [];
      persist();
    },

    clearCache() {
      // A purged entry is gone, so the next lookup is a MISS rather than EXPIRED.
      this.data.cachedAt = null;
      persist();
      return this.state();
    },

    async origin() {
      if (!this.data.running) throw connectionRefused();
      const { cachedAt } = this.data;
      const fresh = cachedAt !== null && Date.now() - cachedAt < this.cacheTtlSeconds * 1000;
      // Nginx reports MISS when no entry exists at all, EXPIRED when a stale one is replaced.
      const cacheStatus = fresh ? "HIT" : cachedAt === null ? "MISS" : "EXPIRED";
      const server = this.data.instance.name;

      if (fresh) {
        await sim.delay(sim.latency.cacheHit());
      } else {
        await sim.delay(sim.latency.proxyHop() + sim.latency.serviceQuery());
        sim.pushLine(this.data.serviceLog, sim.serviceLine("GET", "/api/products"));
        this.data.cachedAt = Date.now();
      }

      sim.pushLine(this.data.proxyLog, sim.proxyLine("GET", "/api/products", 200, cacheStatus), 40);
      persist();
      return jsonResponse(catalogPayload(server), {
        headers: {
          "x-cache-status": cacheStatus,
          "x-service-name": "Catalog Service",
          "x-request-server": server
        }
      });
    }
  };

  // ---------------------------------------------------------------- Lesson 3
  // Nginx as an L7 load balancer, round-robin across three replicas.
  const lesson03 = {
    id: "lesson-03-l7-load-balancer",
    poolSize: 3,
    data: slot("lesson-03-l7-load-balancer", () => ({
      running: false, loadBalancerId: null, configured: [], replicas: [], nextIndex: 0, loadBalancerLog: []
    })),

    state() {
      const { running, loadBalancerId, configured, replicas } = this.data;
      if (!running) {
        return {
          running: false,
          poolSize: this.poolSize,
          needsRepair: false,
          loadBalancer: null,
          configuredBackends: [],
          services: []
        };
      }
      return {
        running: true,
        poolSize: this.poolSize,
        needsRepair: replicas.length < this.poolSize,
        loadBalancer: {
          id: loadBalancerId,
          name: "loadBalancer1",
          hostPort: 7312,
          containerPort: 80,
          directUrl: "http://localhost:7312/api/products"
        },
        // Read from a container label in the real lesson, so a killed replica stays
        // listed here: that is what keeps its "stopped" card on screen.
        configuredBackends: configured.map((entry) => `${entry.name}:${entry.containerPort}`),
        services: replicas.map((instance) => exposeReplica(instance))
      };
    },

    async start() {
      const missing = this.poolSize - this.data.replicas.length;
      if (this.data.running && missing === 0) return this.state();

      await sim.delay(sim.latency.containerStart());
      if (!this.data.running) {
        this.data.replicas = [1, 2, 3].map(replica);
        this.data.configured = this.data.replicas.map(({ name, containerPort }) => ({ name, containerPort }));
        this.data.nextIndex = 0;
      } else {
        // Repair: refill the pool, keeping the survivors in sequence order.
        const surviving = new Set(this.data.replicas.map(({ sequence }) => sequence));
        for (let sequence = 1; sequence <= this.poolSize; sequence += 1) {
          if (!surviving.has(sequence)) this.data.replicas.push(replica(sequence));
        }
        this.data.replicas.sort((left, right) => left.sequence - right.sequence);
      }
      this.data.loadBalancerId = sim.containerId();
      this.data.running = true;
      this.data.loadBalancerLog = [];
      this.data.replicas.forEach((instance) => { instance.log = []; });
      persist();
      return this.state();
    },

    async stop() {
      Object.assign(this.data, {
        running: false, loadBalancerId: null, configured: [], replicas: [], nextIndex: 0, loadBalancerLog: []
      });
      persist();
    },

    killReplica(id) {
      const index = this.data.replicas.findIndex((instance) => instance.id === id);
      if (index === -1) {
        throw Object.assign(new Error("Catalog replica is not part of this lesson pool."), { statusCode: 404 });
      }
      this.data.replicas.splice(index, 1);
      if (this.data.replicas.length > 0) this.data.nextIndex %= this.data.replicas.length;
      persist();
      return this.state();
    },

    logs() {
      if (!this.data.running) {
        return { loadBalancerLogs: "Start the lesson to see L7 Load Balancer requests.", serviceLogs: [] };
      }
      return {
        loadBalancerLogs: sim.renderLines(this.data.loadBalancerLog, "No load-balanced requests received yet."),
        serviceLogs: this.data.replicas.map((instance) => ({
          id: instance.id,
          name: instance.name,
          logs: sim.renderLines(instance.log, "No requests received yet.")
        }))
      };
    },

    clearLogs() {
      this.data.loadBalancerLog = [];
      this.data.replicas.forEach((instance) => { instance.log = []; });
      persist();
    },

    async origin() {
      if (!this.data.running || this.data.replicas.length === 0) throw connectionRefused();
      // Nginx round-robin walks the healthy peers in configuration order.
      const chosen = this.data.replicas[this.data.nextIndex % this.data.replicas.length];
      this.data.nextIndex = (this.data.nextIndex + 1) % this.data.replicas.length;

      await sim.delay(sim.latency.proxyHop() + sim.latency.serviceQuery());
      sim.pushLine(chosen.log, sim.serviceLine("GET", "/api/products"));
      sim.pushLine(this.data.loadBalancerLog, sim.loadBalancerLine("GET", "/api/products", 200, chosen.name), 40);
      persist();

      return jsonResponse(catalogPayload(chosen.name), {
        headers: { "x-service-name": "Catalog Service", "x-request-server": chosen.name }
      });
    }
  };

  sim.lessons = {
    [lesson01.id]: lesson01,
    [lesson02.id]: lesson02,
    [lesson03.id]: lesson03
  };

  sim.persist = persist;
  sim.slot = slot;
  sim.jsonResponse = jsonResponse;
  sim.connectionRefused = connectionRefused;

  // Simulated origins, keyed by the published port each lesson dials directly.
  sim.origins = {
    6212: lesson01,
    7212: lesson02,
    7312: lesson03
  };
}(window.SiliconLanesSim));
