#!/bin/bash
cd "/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker"
pkill -9 -f "node_modules/.bin/electron" 2>/dev/null
pkill -9 -f "electron.*remote" 2>/dev/null
sleep 1
rm -rf /tmp/probe-profile-* 2>/dev/null
node_modules/.bin/electron . --remote-debugging-port=9222 > /tmp/rheo.log 2>&1
