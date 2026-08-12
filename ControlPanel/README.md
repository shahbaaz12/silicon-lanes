# Silicon Lanes Control Panel

A local web interface for building, starting, inspecting, requesting, and
stopping the repository's Dockerized services.

## Run

Docker Desktop must be running.

```powershell
cd ControlPanel
npm install
npm start
```

Open `http://localhost:7012`.

The panel binds only to `127.0.0.1`. It operates only on the six configured
service images and containers carrying the `com.silicon-lanes.managed=true`
label. Its image is built from the independent service folder when instances
are started. Docker reuses cached layers when the source has not changed.

Each instance receives a readable name such as `userService1`, which is also
returned as `requestServer`. The detail page automatically shows its sample
health-check curl, latest JSON response, and a compact live request log containing
only timestamp, HTTP method, and URL.
