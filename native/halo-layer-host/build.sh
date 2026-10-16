#!/bin/bash
# Build the Halo layer-shell host (gate 1: pixels above other apps, safe input).
#
# WHY gtk4-layer-shell AND NOT LayerShellQt
# -----------------------------------------
# Both APIs exist on Fedora 44/KWin 6.7, but only one is COMPILABLE on this box
# today, and that decided it:
#
#   layer-shell-qt              : runtime only. `pkg-config LayerShellQt` fails,
#                                 /usr/include/LayerShellQt/ does not exist,
#                                 layer-shell-qt-devel is NOT installed.
#   gtk4-layer-shell + gtk4     : BOTH runtime and -devel installed. Compiles now.
#
# Neither needs root, and neither needs the KWin effect plugin path. If a future
# phase wants Qt, installing layer-shell-qt-devel is a one-command change; the
# surface code below is intentionally small so porting it is mechanical.
#
# The link order matters: pkg-config libs go AFTER the source file so the linker
# resolves symbols in one left-to-right pass.
set -euo pipefail

cd "$(dirname "$0")"

for pkg in gtk4 gtk4-layer-shell-0; do
    if ! pkg-config --exists "$pkg"; then
        echo "ERROR: pkg-config cannot find '$pkg'."
        echo "Install gtk4-devel and gtk4-layer-shell-devel, then rerun."
        exit 2
    fi
done

gcc -O2 -Wall -Wextra -o halo-layer-host halo-layer-host.c \
    $(pkg-config --cflags --libs gtk4 gtk4-layer-shell-0) -lm

echo "Built: $(pwd)/halo-layer-host"
ls -la halo-layer-host
echo
echo "Check support : ./halo-layer-host --check"
echo "Run collapsed : ./halo-layer-host"
echo "Run expanded  : ./halo-layer-host --expanded"
echo "State log     : ~/.local/state/rheo/halo-layer-host.log"
