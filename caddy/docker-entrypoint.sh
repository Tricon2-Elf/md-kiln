#!/bin/sh
set -e

# Compose passes DOMAIN="" when unset; Caddy needs an explicit listen address for local HTTP.
if [ -z "$DOMAIN" ]; then
	export DOMAIN=":3000"
fi

cfg=/tmp/Caddyfile
{
	if [ -n "$CADDY_EMAIL" ]; then
		printf '{\n\temail %s\n}\n\n' "$CADDY_EMAIL"
	fi
	cat /etc/caddy/Caddyfile
} > "$cfg"

exec caddy run --config "$cfg" --adapter caddyfile
