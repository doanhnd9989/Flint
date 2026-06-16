#!/usr/bin/env bash
# loop-guard.sh — prevents overlapping runs of the 5-minute dev loop.
#
#   bash scripts/loop-guard.sh acquire   -> exit 0 + "ACQUIRED" if we got the lock
#                                            exit 1 + "BUSY ..."  if another run holds it
#   bash scripts/loop-guard.sh release   -> always releases the lock
#   bash scripts/loop-guard.sh status    -> prints whether a run is in progress
#
# Locking uses an atomic `mkdir` (succeeds only if the dir does not exist).
# A lock older than STALE_MIN is assumed orphaned (a crashed run) and reclaimed,
# so the loop can never deadlock permanently.

set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCK="$DIR/.loop.lock"
STARTED="$LOCK/started_at"
PIDFILE="$LOCK/pid"
STALE_MIN="${LOOP_STALE_MIN:-15}"

now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
epoch() { date +%s; }

lock_age_min() {
  local mtime
  mtime=$(stat -f %m "$LOCK" 2>/dev/null || stat -c %Y "$LOCK" 2>/dev/null)
  [ -z "$mtime" ] && { echo 9999; return; }
  echo $(( ( $(epoch) - mtime ) / 60 ))
}

case "${1:-}" in
  acquire)
    if mkdir "$LOCK" 2>/dev/null; then
      now > "$STARTED"
      echo $$ > "$PIDFILE"
      echo "ACQUIRED ($(now))"
      exit 0
    fi
    # Lock already exists — is it stale?
    age=$(lock_age_min)
    if [ "$age" -ge "$STALE_MIN" ]; then
      echo "STALE: reclaiming lock held for ${age} min (>= ${STALE_MIN})"
      rm -rf "$LOCK"
      mkdir "$LOCK" 2>/dev/null || true
      now > "$STARTED"
      echo $$ > "$PIDFILE"
      echo "ACQUIRED ($(now), reclaimed)"
      exit 0
    fi
    echo "BUSY: a loop run started $(cat "$STARTED" 2>/dev/null) is still in progress (${age} min). Skipping this tick."
    exit 1
    ;;
  release)
    rm -rf "$LOCK"
    echo "RELEASED ($(now))"
    exit 0
    ;;
  status)
    if [ -d "$LOCK" ]; then
      echo "RUNNING since $(cat "$STARTED" 2>/dev/null) ($(lock_age_min) min)"
    else
      echo "IDLE"
    fi
    exit 0
    ;;
  *)
    echo "usage: loop-guard.sh {acquire|release|status}" >&2
    exit 2
    ;;
esac
