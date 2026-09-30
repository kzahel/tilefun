# Server access and dependency maintenance

The standalone server and Vite's attached Node server treat incoming players as
guests. Guests can play, edit terrain, browse existing worlds, and chat. Creating,
renaming, or deleting worlds and running server console commands require an admin
token. Browser-hosted local and peer-to-peer games retain trusted co-op behavior.

Set `TILEFUN_ADMIN_TOKEN` to a randomly generated secret of at least 32 characters
before starting a Node server. For example, generate a value with
`node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'`
and supply it through your process manager's environment. Keep it out of Git.

Open the usual game connection URL with `#adminToken=YOUR_SECRET` appended.
The client removes that fragment from the address bar and keeps the token only in
memory, adding it to administrative requests. Reloading requires supplying the
fragment again. Use HTTPS/WSS when connecting over an untrusted network; fragments
are excluded from HTTP requests, but the token travels over the game connection.
The token works with both WebSocket and WebRTC transports.

For a trusted household/LAN session, `TILEFUN_TRUSTED_COOP=1` explicitly allows
all connected players to administer the server. A configured admin token takes
precedence over that setting. Vite still accepts localhost and direct LAN IPs;
custom development hostnames must be added explicitly using Vite's
`__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` environment variable.

Filesystem storage rejects world IDs containing path separators and prevents
reads, writes, and deletions through symlinks outside the configured storage
roots. Only registered worlds can be deleted. Static files are constrained to
the build directory. These checks assume the server's local files are managed by
the operator, rather than a competing process changing symlinks during requests.

The current permission model intentionally keeps collaborative terrain/entity
editing open to guests. Public hosting also needs connection admission, abuse
limits, and authenticated player identity; the profile/connection UUID is not an
authentication credential. The world inspection HTTP endpoints remain public and
read-only so that the explorer can inspect a remote server.

Use Node 24 LTS (`nvm use`) and npm 11.19 or newer for development. Node 22.12+
and current even-numbered releases are also supported. The Node and WebXR types
are direct dependencies so typechecking does not depend on incidental packages.

Run `npm ci` and `npm ci --prefix worker`, then `npm run typecheck`, `npm test`,
`npm run check:worker`, `npm run check`, and `npm run build`. For browser/network
changes, install bundled Chromium with `npx playwright install chromium` and run
`npm run test:e2e`. `check:worker` tests the room directory and bundles the Worker
with a dry run; it does not deploy it.

Dependabot checks both npm package trees and pinned GitHub Actions every week.
CI rejects high/critical audit findings in either tree. Both package manifests
also pin the reviewed dependency versions whose installation scripts may run.
After reviewing an update to those packages, use `npm install-scripts approve
PACKAGE` in its package directory to update that allowlist. Do not approve all
dependency scripts indiscriminately. An optional native WebRTC dependency is
only useful when its binding can load; a successful npm install alone is not
proof that it works.

The public room directory validates names, host names, player counts, IDs, and
request bytes, and limits each listing to 100 entries. Its heartbeat is still
an unauthenticated public endpoint. Production abuse controls and ownership
verification require a separate design; KV's eventual consistency cannot enforce
atomic room ownership or strong request rate limits.
