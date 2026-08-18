// Lessons 4-7: the layered topologies.
//
//   4  one API Gateway selecting a service by request path
//   5  Gateway -> Catalog Load Balancer, with User and Order staying direct
//   6  L4 Edge Load Balancer -> two API Gateways -> private L7 Catalog Load Balancer
//   7  a local CDN in front of the lesson 6 origin
//
// Lesson 7 reuses lesson 6's topology as its origin, exactly as the real
// local-cdn-lesson-manager delegates to the advanced one.
window.SiliconLanesSim = window.SiliconLanesSim || {};

(function (sim) {
  const { jsonResponse, connectionRefused } = sim;

  // Only the Catalog service ships seed rows; the rest start with empty tables,
  // which is what the real lessons show against a fresh database.
  const serviceDefinitions = {
    user: { key: "user", name: "User Service", basePort: 6112, rows: [] },
    catalog: { key: "catalog", name: "Catalog Service", basePort: 6212, rows: null },
    inventory: { key: "inventory", name: "Inventory Service", basePort: 6312, rows: [] },
    cart: { key: "cart", name: "Cart Service", basePort: 6412, rows: null, single: true },
    order: { key: "order", name: "Order Service", basePort: 6512, rows: [] },
    payment: { key: "payment", name: "Payment Service", basePort: 6612, rows: [] }
  };

  const routePaths = {
    user: "/api/users",
    catalog: "/api/products",
    inventory: "/api/inventory",
    cart: "/api/carts/1",
    order: "/api/orders",
    payment: "/api/payments"
  };

  function payloadFor(serviceKey, server) {
    const definition = serviceDefinitions[serviceKey];
    const rows = serviceKey === "catalog" ? sim.products : definition.single ? null : definition.rows;
    return { data: rows, servedBy: { service: definition.name, server } };
  }

  function instance(serviceKey, sequence) {
    const definition = serviceDefinitions[serviceKey];
    return {
      id: sim.containerId(),
      name: `${serviceKey}Service${sequence}`,
      serviceKey,
      sequence,
      hostPort: definition.basePort + (sequence - 1),
      containerPort: definition.basePort,
      startedAt: new Date().toISOString(),
      log: []
    };
  }

  function expose(item) {
    return {
      id: item.id,
      shortId: item.id.slice(0, 12),
      name: item.name,
      serviceKey: item.serviceKey,
      sequence: item.sequence,
      state: "running",
      running: true,
      hostPort: item.hostPort,
      containerPort: item.containerPort,
      startedAt: item.startedAt,
      ownedByLesson: true
    };
  }

  // Resolves a request path to the service that owns it, longest prefix first so
  // /api/carts/1 does not fall through to a shorter match.
  function serviceForPath(pathname, allowed) {
    const match = Object.entries(routePaths)
      .filter(([key]) => allowed.includes(key))
      .sort((left, right) => right[1].length - left[1].length)
      .find(([, routePath]) => pathname === routePath || pathname.startsWith(`${routePath}/`));
    return match ? match[0] : null;
  }

  function stripQuery(pathname) {
    return pathname.split("?")[0];
  }

  // ---------------------------------------------------------------- Lesson 4
  const lesson04Keys = ["user", "catalog", "inventory", "cart", "order", "payment"];

  const lesson04 = {
    id: "lesson-04-api-gateway",
    data: sim.slot("lesson-04-api-gateway", () => ({
      running: false, gatewayId: null, instances: [], gatewayLog: []
    })),

    state() {
      const { running, gatewayId, instances } = this.data;
      const routes = lesson04Keys.map((key) => ({
        serviceKey: key,
        serviceName: serviceDefinitions[key].name,
        path: routePaths[key],
        method: "GET",
        instance: running ? (instances.find((item) => item.serviceKey === key) ?? null) : null
      }));
      if (!running) {
        return { running: false, ready: false, needsRepair: false, gateway: null, routes, services: [] };
      }
      return {
        running: true,
        ready: instances.length === lesson04Keys.length,
        needsRepair: instances.length < lesson04Keys.length,
        gateway: {
          id: gatewayId,
          name: "apiGateway1",
          hostPort: 7412,
          containerPort: 80,
          baseUrl: "http://localhost:7412"
        },
        routes: routes.map((route) => ({
          ...route,
          instance: route.instance ? expose(route.instance) : null
        })),
        services: instances.map(expose)
      };
    },

    async start() {
      if (!this.data.running) {
        await sim.delay(sim.latency.containerStart());
        this.data.instances = lesson04Keys.map((key) => instance(key, 1));
        this.data.gatewayId = sim.containerId();
        this.data.gatewayLog = [];
        this.data.running = true;
        sim.persist();
      }
      return this.state();
    },

    async stop() {
      Object.assign(this.data, { running: false, gatewayId: null, instances: [], gatewayLog: [] });
      sim.persist();
    },

    logs() {
      if (!this.data.running) {
        return { gatewayLogs: "Start the lesson to see API Gateway routing decisions.", serviceLogs: [] };
      }
      return {
        gatewayLogs: sim.renderLines(this.data.gatewayLog, "No gateway requests received yet."),
        serviceLogs: this.data.instances.map((item) => ({
          id: item.id,
          name: item.name,
          serviceKey: item.serviceKey,
          logs: sim.renderLines(item.log, "No requests received yet.")
        }))
      };
    },

    clearLogs() {
      this.data.gatewayLog = [];
      this.data.instances.forEach((item) => { item.log = []; });
      sim.persist();
    },

    async origin(pathname) {
      if (!this.data.running) throw connectionRefused();
      const path = stripQuery(pathname);
      const serviceKey = serviceForPath(path, lesson04Keys);
      if (!serviceKey) {
        return jsonResponse({ error: { message: "No gateway route matches this path." } }, { status: 404, statusText: "Not Found" });
      }
      const target = this.data.instances.find((item) => item.serviceKey === serviceKey);
      await sim.delay(sim.latency.proxyHop() + sim.latency.serviceQuery());

      sim.pushLine(target.log, sim.serviceLine("GET", path));
      sim.pushLine(
        this.data.gatewayLog,
        `${sim.isoTimestamp()}  GET  ${path}  200  → ${serviceKey} / ${target.name}`,
        50
      );
      sim.persist();

      return jsonResponse(payloadFor(serviceKey, target.name), {
        headers: {
          "x-api-gateway": "apiGateway1",
          "x-service-name": serviceDefinitions[serviceKey].name,
          "x-request-server": target.name
        }
      });
    }
  };

  // ---------------------------------------------------------------- Lesson 5
  // Gateway routes by path; Product requests then cross a Catalog Load Balancer.
  const lesson05 = {
    id: "lesson-05-hybrid",
    data: sim.slot("lesson-05-hybrid", () => ({
      running: false, instances: [], catalogIndex: 0, gatewayLog: [], loadBalancerLog: []
    })),

    routes() {
      const of = (key) => this.data.instances.filter((item) => item.serviceKey === key).map(expose);
      return [
        { key: "user", name: "Users", path: "/api/users", via: "direct", instances: of("user") },
        { key: "catalog", name: "Products", path: "/api/products", via: "load-balancer", instances: of("catalog") },
        { key: "order", name: "Orders", path: "/api/orders", via: "direct", instances: of("order") }
      ];
    },

    state() {
      if (!this.data.running) {
        return { running: false, ready: false, gateway: null, loadBalancer: null, services: [], routes: this.routes() };
      }
      return {
        running: true,
        ready: true,
        gateway: { name: "hybridApiGateway1", hostPort: 7512, containerPort: 80, baseUrl: "http://localhost:7512" },
        loadBalancer: { name: "hybridLoadBalancer1", containerPort: 80 },
        services: this.data.instances.map(expose),
        routes: this.routes()
      };
    },

    async start() {
      if (!this.data.running) {
        await sim.delay(sim.latency.containerStart());
        this.data.instances = [
          instance("user", 1),
          instance("catalog", 1),
          instance("catalog", 2),
          instance("order", 1)
        ];
        this.data.catalogIndex = 0;
        this.data.gatewayLog = [];
        this.data.loadBalancerLog = [];
        this.data.running = true;
        sim.persist();
      }
      return this.state();
    },

    async stop() {
      Object.assign(this.data, {
        running: false, instances: [], catalogIndex: 0, gatewayLog: [], loadBalancerLog: []
      });
      sim.persist();
    },

    logs() {
      if (!this.data.running) {
        return { gatewayLogs: "Start Lesson 5.", loadBalancerLogs: "Start Lesson 5.", serviceLogs: [] };
      }
      return {
        gatewayLogs: sim.renderLines(this.data.gatewayLog, "No gateway requests yet."),
        loadBalancerLogs: sim.renderLines(this.data.loadBalancerLog, "No Catalog requests yet."),
        serviceLogs: this.data.instances.map((item) => ({
          serviceKey: item.serviceKey,
          name: item.name,
          logs: sim.renderLines(item.log, "No requests received yet.")
        }))
      };
    },

    clearLogs() {
      this.data.gatewayLog = [];
      this.data.loadBalancerLog = [];
      this.data.instances.forEach((item) => { item.log = []; });
      sim.persist();
    },

    // Shared by lesson 5 and, in a two-gateway form, by lesson 6.
    selectCatalogReplica() {
      const replicas = this.data.instances.filter((item) => item.serviceKey === "catalog");
      const chosen = replicas[this.data.catalogIndex % replicas.length];
      this.data.catalogIndex = (this.data.catalogIndex + 1) % replicas.length;
      return chosen;
    },

    async origin(pathname) {
      if (!this.data.running) throw connectionRefused();
      const path = stripQuery(pathname);
      const serviceKey = serviceForPath(path, ["user", "catalog", "order"]);
      if (!serviceKey) {
        return jsonResponse({ error: { message: "No gateway route matches this path." } }, { status: 404, statusText: "Not Found" });
      }

      const viaLoadBalancer = serviceKey === "catalog";
      const target = viaLoadBalancer
        ? this.selectCatalogReplica()
        : this.data.instances.find((item) => item.serviceKey === serviceKey);

      await sim.delay(sim.latency.proxyHop() * (viaLoadBalancer ? 2 : 1) + sim.latency.serviceQuery());

      sim.pushLine(target.log, sim.serviceLine("GET", path));
      sim.pushLine(this.data.gatewayLog, `${sim.isoTimestamp()}  GET  ${path}  → ${serviceKey} / ${target.name}`);
      if (viaLoadBalancer) {
        sim.pushLine(this.data.loadBalancerLog, `${sim.isoTimestamp()}  GET  ${path}  → ${target.name}`);
      }
      sim.persist();

      return jsonResponse(payloadFor(serviceKey, target.name), {
        headers: {
          "x-api-gateway": "hybridApiGateway1",
          "x-service-name": serviceDefinitions[serviceKey].name,
          "x-request-server": target.name
        }
      });
    }
  };

  // ---------------------------------------------------------------- Lesson 6
  // An L4 edge balancer spreads TCP connections across two identical gateways.
  const gatewayNames = ["advancedApiGateway1", "advancedApiGateway2"];

  const lesson06 = {
    id: "lesson-06-advanced",
    data: sim.slot("lesson-06-advanced", () => ({
      running: false,
      instances: [],
      catalogIndex: 0,
      connectionIndex: 0,
      connections: {},
      edgeLog: [],
      gatewayLogs: [[], []],
      catalogLog: []
    })),

    routes() {
      const of = (key) => this.data.instances.filter((item) => item.serviceKey === key).map(expose);
      return [
        { key: "user", name: "Users", path: "/api/users", via: "direct", instances: of("user") },
        { key: "catalog", name: "Products", path: "/api/products", via: "load-balancer", instances: of("catalog") },
        { key: "order", name: "Orders", path: "/api/orders", via: "direct", instances: of("order") }
      ];
    },

    state() {
      if (!this.data.running) {
        return {
          running: false, ready: false, edge: null, gateways: [], catalogLoadBalancer: null,
          services: [], routes: this.routes()
        };
      }
      return {
        running: true,
        ready: true,
        edge: { name: "advancedEdgeLoadBalancer1", hostPort: 7612, containerPort: 80, baseUrl: "http://localhost:7612" },
        gateways: gatewayNames.map((name) => ({ name, containerPort: 80 })),
        catalogLoadBalancer: { name: "advancedCatalogLoadBalancer1", containerPort: 80 },
        services: this.data.instances.map(expose),
        routes: this.routes()
      };
    },

    async start() {
      if (!this.data.running) {
        await sim.delay(sim.latency.containerStart());
        this.data.instances = [
          instance("user", 1),
          instance("catalog", 1),
          instance("catalog", 2),
          instance("order", 1)
        ];
        Object.assign(this.data, {
          running: true,
          catalogIndex: 0,
          connectionIndex: 0,
          connections: {},
          edgeLog: [],
          gatewayLogs: [[], []],
          catalogLog: []
        });
        sim.persist();
      }
      return this.state();
    },

    async stop() {
      Object.assign(this.data, {
        running: false, instances: [], catalogIndex: 0, connectionIndex: 0, connections: {},
        edgeLog: [], gatewayLogs: [[], []], catalogLog: []
      });
      sim.persist();
    },

    logs() {
      if (!this.data.running) {
        return {
          edgeLogs: "Start Lesson 6.",
          gatewayLogs: gatewayNames.map((name) => ({ name, logs: "Start Lesson 6." })),
          catalogLogs: "Start Lesson 6."
        };
      }
      return {
        edgeLogs: sim.renderLines(this.data.edgeLog, "No edge connections yet."),
        gatewayLogs: gatewayNames.map((name, index) => ({
          name,
          logs: sim.renderLines(this.data.gatewayLogs[index], "No gateway requests yet.")
        })),
        catalogLogs: sim.renderLines(this.data.catalogLog, "No Catalog requests yet.")
      };
    },

    clearLogs() {
      this.data.edgeLog = [];
      this.data.gatewayLogs = [[], []];
      this.data.catalogLog = [];
      this.data.instances.forEach((item) => { item.log = []; });
      sim.persist();
    },

    // An L4 balancer chooses per connection, not per request. The lesson forces a
    // fresh connection by varying ?connectionExperiment=, so each distinct value
    // takes the next gateway and a repeated value stays on the one it already has.
    selectGateway(connectionKey) {
      if (!(connectionKey in this.data.connections)) {
        this.data.connections[connectionKey] = this.data.connectionIndex % gatewayNames.length;
        this.data.connectionIndex += 1;
        sim.pushLine(
          this.data.edgeLog,
          `${sim.isoTimestamp()}  TCP  connection  → ${gatewayNames[this.data.connections[connectionKey]]}`
        );
      }
      return this.data.connections[connectionKey];
    },

    selectCatalogReplica() {
      const replicas = this.data.instances.filter((item) => item.serviceKey === "catalog");
      const chosen = replicas[this.data.catalogIndex % replicas.length];
      this.data.catalogIndex = (this.data.catalogIndex + 1) % replicas.length;
      return chosen;
    },

    // Shared with lesson 7, which sits in front of this topology as its origin.
    async handle(pathname, { logConnection = true } = {}) {
      const path = stripQuery(pathname);
      const query = pathname.includes("?") ? pathname.slice(pathname.indexOf("?") + 1) : "";
      const experiment = new URLSearchParams(query).get("connectionExperiment") ?? "default";
      const serviceKey = serviceForPath(path, ["user", "catalog", "order"]);
      if (!serviceKey) return { error: true };

      const gatewayIndex = logConnection ? this.selectGateway(experiment) : this.selectGateway(`origin:${experiment}`);
      const viaLoadBalancer = serviceKey === "catalog";
      const target = viaLoadBalancer
        ? this.selectCatalogReplica()
        : this.data.instances.find((item) => item.serviceKey === serviceKey);

      sim.pushLine(target.log, sim.serviceLine("GET", path));
      sim.pushLine(
        this.data.gatewayLogs[gatewayIndex],
        `${sim.isoTimestamp()}  GET  ${path}  → ${serviceKey} / ${target.name}`
      );
      if (viaLoadBalancer) {
        sim.pushLine(this.data.catalogLog, `${sim.isoTimestamp()}  GET  ${path}  → ${target.name}`);
      }

      return {
        serviceKey,
        target,
        gateway: gatewayNames[gatewayIndex],
        viaLoadBalancer,
        latency: sim.latency.proxyHop() * (viaLoadBalancer ? 3 : 2) + sim.latency.serviceQuery()
      };
    },

    async origin(pathname) {
      if (!this.data.running) throw connectionRefused();
      const result = await this.handle(pathname);
      if (result.error) {
        return jsonResponse({ error: { message: "No gateway route matches this path." } }, { status: 404, statusText: "Not Found" });
      }
      await sim.delay(result.latency);
      sim.persist();
      return jsonResponse(payloadFor(result.serviceKey, result.target.name), {
        headers: {
          "x-api-gateway": result.gateway,
          "x-service-name": serviceDefinitions[result.serviceKey].name,
          "x-request-server": result.target.name
        }
      });
    }
  };

  // ---------------------------------------------------------------- Lesson 7
  // A CDN in front of lesson 6. Only /api/products is cacheable; everything else
  // is declared BYPASS by the Nginx config and always crosses the full chain.
  const lesson07 = {
    id: "lesson-07-local-cdn",
    cacheTtlSeconds: 15,
    data: sim.slot("lesson-07-local-cdn", () => ({
      running: false, cachedAt: null, cachedServer: null, cachedGateway: null, cdnLog: []
    })),

    state() {
      const originState = lesson06.state();
      const running = Boolean(this.data.running && originState.running);
      return {
        ...originState,
        running,
        ready: Boolean(running && originState.ready),
        cdn: running ? {
          name: "localCdn1",
          hostPort: 7712,
          containerPort: 80,
          baseUrl: "http://127.0.0.1:7712",
          cacheTtlSeconds: this.cacheTtlSeconds
        } : null
      };
    },

    async start() {
      if (!this.data.running) {
        await lesson06.start();
        this.data.running = true;
        this.data.cachedAt = null;
        this.data.cdnLog = [];
        sim.persist();
      }
      return this.state();
    },

    async stop() {
      Object.assign(this.data, { running: false, cachedAt: null, cdnLog: [] });
      await lesson06.stop();
      sim.persist();
    },

    logs() {
      const downstream = lesson06.logs();
      if (!this.data.running) return { cdnLogs: "Start Lesson 7.", ...downstream };
      return { cdnLogs: sim.renderLines(this.data.cdnLog, "No CDN requests yet."), ...downstream };
    },

    clearLogs() {
      this.data.cdnLog = [];
      lesson06.clearLogs();
      sim.persist();
    },

    clearCache() {
      this.data.cachedAt = null;
      sim.persist();
    },

    async request(pathname) {
      if (!this.data.running) throw connectionRefused();
      const path = stripQuery(pathname);
      const cacheable = path === "/api/products";

      if (cacheable) {
        const { cachedAt } = this.data;
        const fresh = cachedAt !== null && Date.now() - cachedAt < this.cacheTtlSeconds * 1000;
        if (fresh) {
          await sim.delay(sim.latency.cacheHit());
          sim.pushLine(this.data.cdnLog, `${sim.isoTimestamp()}  GET  ${path}  HIT`);
          sim.persist();
          // A cached response replays the headers stored with it, but nothing
          // downstream is contacted, so no origin log line appears.
          return jsonResponse(payloadFor("catalog", this.data.cachedServer ?? "catalogService1"), {
            headers: {
              "x-cache-status": "HIT",
              "x-service-name": "Catalog Service",
              "x-request-server": this.data.cachedServer ?? "catalogService1",
              "x-api-gateway": this.data.cachedGateway ?? gatewayNames[0]
            }
          });
        }
      }

      const result = await lesson06.handle(pathname, { logConnection: false });
      if (result.error) {
        return jsonResponse({ error: { message: "No route matches this path." } }, { status: 404, statusText: "Not Found" });
      }
      await sim.delay(result.latency + sim.latency.proxyHop());

      const cacheStatus = cacheable ? "MISS" : "BYPASS";
      if (cacheable) {
        this.data.cachedAt = Date.now();
        this.data.cachedServer = result.target.name;
        this.data.cachedGateway = result.gateway;
      }
      sim.pushLine(this.data.cdnLog, `${sim.isoTimestamp()}  GET  ${path}  ${cacheStatus}`);
      sim.persist();

      return jsonResponse(payloadFor(result.serviceKey, result.target.name), {
        headers: {
          "x-cache-status": cacheStatus,
          "x-service-name": serviceDefinitions[result.serviceKey].name,
          "x-request-server": result.target.name,
          "x-api-gateway": result.gateway
        }
      });
    }
  };

  // `origin` on lesson 7 is the lesson 6 object, so the shim needs the request
  // entry point under the name it uses for every other lesson.
  lesson07.origin = (pathname) => lesson07.request(pathname);

  Object.assign(sim.lessons, {
    [lesson04.id]: lesson04,
    [lesson05.id]: lesson05,
    [lesson06.id]: lesson06,
    [lesson07.id]: lesson07
  });

  Object.assign(sim.origins, {
    7412: lesson04,
    7512: lesson05,
    7612: lesson06,
    7712: lesson07
  });
}(window.SiliconLanesSim));
