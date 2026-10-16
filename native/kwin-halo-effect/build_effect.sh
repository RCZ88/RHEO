#!/bin/bash
# Build the Halo KWin effect plugin.
#
# WHY THE `cd` IS HERE
# --------------------
# This script compiled `haloeffect.cpp` by RELATIVE path, so it only worked if you happened to
# already be standing in `native/kwin-halo-effect/`. Run it the way anyone would run it —
# `bash native/kwin-halo-effect/build_effect.sh` from the repo root — and it failed with
# `cc1plus: fatal error: haloeffect.cpp: No such file or directory`. The failure looked like a
# compiler problem and was actually a working-directory one.
set -euo pipefail

cd "$(dirname "$0")"

echo "Compiling haloeffect.cpp..."
# -DKPLUGINFACTORY_PLUGIN_CLASS_INTERNAL_NAME is REQUIRED.
#
# effect.h:1132 defines the factory class NAME as `KWIN_PLUGIN_FACTORY_NAME`, which expands to
# `KPLUGINFACTORY_PLUGIN_CLASS_INTERNAL_NAME`. Without this -D the class has no name and the macro
# fails to compile.
#
# -DQT_STATICPLUGIN has been REMOVED. It tells moc to embed plugin metadata for STATIC linking.
# A KWin effect is a DYNAMIC plugin loaded by KPluginFactory at runtime, so static-plugin mode is
# wrong — and with it the earlier `Q_PLUGIN_METADATA` was not emitted into a loadable form.
g++ -O3 -DNDEBUG -fPIC \
    -DKPLUGINFACTORY_PLUGIN_CLASS_INTERNAL_NAME=halo_factory \
    -I/usr/include/kwin \
    -I/usr/include/qt6 \
    -I/usr/include/qt6/QtCore \
    -I/usr/include/qt6/QtGui \
    -I/usr/include/qt6/QtQuick \
    -I/usr/include/KF6/KCoreAddons \
    -I/usr/include/KF6/KGuiAddons \
    -I/usr/include/KF6/KI18n \
    -I/usr/include/KF6/KConfigCore \
    -I/usr/include/KF6/KConfig \
    -I/usr/include/KF6/KWindowSystem \
    -I/usr/include/KF6/KConfigGui \
    -c haloeffect.cpp -o haloeffect.o

# moc IS REQUIRED. `HaloEffect` derives from `KWin::Effect`, which derives from `QObject`, and the
# class carries `Q_OBJECT` — so Qt needs generated meta-object code for its vtable and signals.
#
# Without this step the .so COMPILES AND LINKS CLEANLY but fails at dlopen with:
#     undefined symbol: _ZTVN10HaloEffect10HaloEffectE      (the vtable)
# That is the nastiest possible failure mode here, because every build step reports success.
echo "Running moc..."
MOC=$(ls /usr/lib64/qt6/libexec/moc 2>/dev/null || ls /usr/lib64/moc 2>/dev/null || command -v moc-qt6 || command -v moc)
echo "  moc: $MOC"
# moc-generated code includes <kwin/effect/effect.h>, which pulls in <KPluginFactory> and
# <KSharedConfig> from KF6. Those paths must be passed to BOTH moc and the moc compile, or the
# generated file dies with `fatal error: KPluginFactory / KSharedConfig: No such file or directory`.
MOC_INCLUDES="-I/usr/include/kwin -I/usr/include/qt6 -I/usr/include/qt6/QtCore \
-I/usr/include/qt6/QtGui -I/usr/include/KF6/KCoreAddons -I/usr/include/KF6/KConfigCore \
-I/usr/include/KF6/KConfig -I/usr/include/KF6/KConfigGui -I/usr/include/KF6/KI18n \
-I/usr/include/KF6/KGuiAddons -I/usr/include/KF6/KWindowSystem"

"$MOC" $MOC_INCLUDES \
    -DKPLUGINFACTORY_PLUGIN_CLASS_INTERNAL_NAME=halo_factory \
    haloeffect.h -o moc_haloeffect.cpp

g++ -O3 -DNDEBUG -fPIC -DKPLUGINFACTORY_PLUGIN_CLASS_INTERNAL_NAME=halo_factory \
    $MOC_INCLUDES -c moc_haloeffect.cpp -o moc_haloeffect.o

echo "Linking libhalo.so..."
# The KWin core library is `libkwin`, NOT `libKF6KWin`.
#
# `-lKF6KWin` fails with `cannot find -lKF6KWin: No such file or directory` on this build. The
# real SONAME is /lib64/libkwin.so.6.7.5 — KWin 6.7.5. This is the same class of error as the
# KWin 5 signature mismatch: the build script was written from documentation, not from the
# installed system. Every flag below is verified against a file that exists.
g++ -shared -o libhalo.so haloeffect.o moc_haloeffect.o \
    -lkwin \
    -lQt6Core \
    -lQt6Gui \
    -lKF6CoreAddons \
    -lKF6ConfigCore \
    -lKF6WindowSystem

echo "Build complete. Output: $(pwd)/libhalo.so"
ls -la libhalo.so