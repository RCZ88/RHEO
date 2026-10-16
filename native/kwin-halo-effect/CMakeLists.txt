# Halo KWin effect — offscreen React renderer painted into the compositor render chain.
# Research: agent/docs/halo/HALO_WINDOWLESS_COMPOSITOR_RESEARCH.md
cmake_minimum_required(VERSION 3.20)
project(kwin-halo-effect)

# Fedora 44 ships each KF6 component's cmake config in its own directory
# (/usr/lib64/cmake/KF6CoreAddons, KF6GuiAddons, KF6I18n) but does NOT ship the umbrella
# `KF6Config.cmake` that `find_package(KF6 COMPONENTS ...)` requires. Finding each component
# directly is the portable form and works on both layouts.
find_package(Qt6Core REQUIRED)
find_package(KF6CoreAddons REQUIRED)
find_package(KF6GuiAddons REQUIRED)
find_package(KF6I18n REQUIRED)
find_package(KWin 6.7 REQUIRED)

# KWin effects use kcoreaddons_add_plugin from KCoreAddons
# (per /usr/include/kwin/effect/effect.h documentation)
# kcoreaddons_add_plugin is provided by KF6CoreAddonsMacros.cmake
# kcoreaddons_add_plugin is provided by KF6CoreAddonsMacros.cmake (included by KF6CoreAddonsConfig.cmake)
# The macro should be available after find_package(KF6CoreAddons REQUIRED)

kcoreaddons_add_plugin(
    halo
    SOURCES haloeffect.cpp
    INSTALL_NAMESPACE "kwin/effects/plugins"
)

# Install the JSON metadata file
install(FILES halo.json
    DESTINATION ${KDE_INSTALL_PLUGINDIR}/kwin/effects/plugins
    RENAME halo.json
)
