/*
 * Halo Island — KWin effect plugin entry point.
 *
 * KWin loads this as a shared library. The plugin instantiates HaloEffect and KWin calls
 * init()/paintScreen() on it. There is deliberately no logic here: the effect runs inside the
 * compositor process (research §24), so any crash here takes the desktop's compositor with it.
 */

#include "haloeffect.h"

KWIN_EFFECT(HaloEffect::HaloEffect, halo)
