#!/bin/sh
set -e

# Compose passes DOMAIN="" when unset; Caddy needs an explicit listen address for local HTTP.
if [ -z "$DOMAIN" ]; then
	export DOMAIN=":3000"
fi

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
