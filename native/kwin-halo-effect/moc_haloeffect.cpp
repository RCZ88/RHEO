/****************************************************************************
** Meta object code from reading C++ file 'haloeffect.h'
**
** Created by: The Qt Meta Object Compiler version 69 (Qt 6.11.2)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "haloeffect.h"
#include <QtCore/qmetatype.h>
#include <QtCore/qplugin.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'haloeffect.h' doesn't include <QObject>."
#elif Q_MOC_OUTPUT_REVISION != 69
#error "This file was generated using the moc from 6.11.2. It"
#error "cannot be used with the include files from this version of Qt."
#error "(The moc has changed too much.)"
#endif

#ifndef Q_CONSTINIT
#define Q_CONSTINIT
#endif

QT_WARNING_PUSH
QT_WARNING_DISABLE_DEPRECATED
QT_WARNING_DISABLE_GCC("-Wuseless-cast")
namespace {
struct qt_meta_tag_ZN10HaloEffect10HaloEffectE_t {};
} // unnamed namespace

template <> constexpr inline auto HaloEffect::HaloEffect::qt_create_metaobjectdata<qt_meta_tag_ZN10HaloEffect10HaloEffectE_t>()
{
    namespace QMC = QtMocConstants;
    QtMocHelpers::StringRefStorage qt_stringData {
        "HaloEffect::HaloEffect"
    };

    QtMocHelpers::UintData qt_methods {
    };
    QtMocHelpers::UintData qt_properties {
    };
    QtMocHelpers::UintData qt_enums {
    };
    return QtMocHelpers::metaObjectData<HaloEffect, qt_meta_tag_ZN10HaloEffect10HaloEffectE_t>(QMC::MetaObjectFlag{}, qt_stringData,
            qt_methods, qt_properties, qt_enums);
}
Q_CONSTINIT const QMetaObject HaloEffect::HaloEffect::staticMetaObject = { {
    QMetaObject::SuperData::link<KWin::Effect::staticMetaObject>(),
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN10HaloEffect10HaloEffectE_t>.stringdata,
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN10HaloEffect10HaloEffectE_t>.data,
    qt_static_metacall,
    nullptr,
    qt_staticMetaObjectRelocatingContent<qt_meta_tag_ZN10HaloEffect10HaloEffectE_t>.metaTypes,
    nullptr
} };

void HaloEffect::HaloEffect::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    auto *_t = static_cast<HaloEffect *>(_o);
    (void)_t;
    (void)_c;
    (void)_id;
    (void)_a;
}

const QMetaObject *HaloEffect::HaloEffect::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *HaloEffect::HaloEffect::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_staticMetaObjectStaticContent<qt_meta_tag_ZN10HaloEffect10HaloEffectE_t>.strings))
        return static_cast<void*>(this);
    return KWin::Effect::qt_metacast(_clname);
}

int HaloEffect::HaloEffect::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = KWin::Effect::qt_metacall(_c, _id, _a);
    return _id;
}
namespace {
struct qt_meta_tag_ZN12halo_factoryE_t {};
} // unnamed namespace

template <> constexpr inline auto halo_factory::qt_create_metaobjectdata<qt_meta_tag_ZN12halo_factoryE_t>()
{
    namespace QMC = QtMocConstants;
    QtMocHelpers::StringRefStorage qt_stringData {
        "halo_factory"
    };

    QtMocHelpers::UintData qt_methods {
    };
    QtMocHelpers::UintData qt_properties {
    };
    QtMocHelpers::UintData qt_enums {
    };
    return QtMocHelpers::metaObjectData<halo_factory, qt_meta_tag_ZN12halo_factoryE_t>(QMC::MetaObjectFlag{}, qt_stringData,
            qt_methods, qt_properties, qt_enums);
}
Q_CONSTINIT const QMetaObject halo_factory::staticMetaObject = { {
    QMetaObject::SuperData::link<KWin::EffectPluginFactory::staticMetaObject>(),
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN12halo_factoryE_t>.stringdata,
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN12halo_factoryE_t>.data,
    qt_static_metacall,
    nullptr,
    qt_staticMetaObjectRelocatingContent<qt_meta_tag_ZN12halo_factoryE_t>.metaTypes,
    nullptr
} };

void halo_factory::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    auto *_t = static_cast<halo_factory *>(_o);
    (void)_t;
    (void)_c;
    (void)_id;
    (void)_a;
}

const QMetaObject *halo_factory::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *halo_factory::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_staticMetaObjectStaticContent<qt_meta_tag_ZN12halo_factoryE_t>.strings))
        return static_cast<void*>(this);
    if (!strcmp(_clname, "org.kde.KPluginFactory"))
        return static_cast< KPluginFactory*>(this);
    return KWin::EffectPluginFactory::qt_metacast(_clname);
}

int halo_factory::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = KWin::EffectPluginFactory::qt_metacall(_c, _id, _a);
    return _id;
}

#ifdef QT_MOC_EXPORT_PLUGIN_V2
static constexpr unsigned char qt_pluginMetaDataV2_halo_factory[] = {
    0xbf, 
    // "IID"
    0x02,  0x78,  0x20,  'o',  'r',  'g',  '.',  'k', 
    'd',  'e',  '.',  'k',  'w',  'i',  'n',  '.', 
    'E',  'f',  'f',  'e',  'c',  't',  'P',  'l', 
    'u',  'g',  'i',  'n',  'F',  'a',  'c',  't', 
    'o',  'r',  'y', 
    // "className"
    0x03,  0x6c,  'h',  'a',  'l',  'o',  '_',  'f', 
    'a',  'c',  't',  'o',  'r',  'y', 
    // "MetaData"
    0x04,  0xa3,  0x67,  'K',  'P',  'l',  'u',  'g', 
    'i',  'n',  0xa6,  0x67,  'A',  'u',  't',  'h', 
    'o',  'r',  's',  0x81,  0xa1,  0x64,  'N',  'a', 
    'm',  'e',  0x64,  'R',  'H',  'E',  'O',  0x6b, 
    'D',  'e',  's',  'c',  'r',  'i',  'p',  't', 
    'i',  'o',  'n',  0x78,  0x56,  'P',  'a',  'i', 
    'n',  't',  's',  ' ',  't',  'h',  'e',  ' ', 
    'H',  'a',  'l',  'o',  ' ',  'i',  's',  'l', 
    'a',  'n',  'd',  ' ',  'f',  'r',  'o',  'm', 
    ' ',  'a',  'n',  ' ',  'o',  'f',  'f',  's', 
    'c',  'r',  'e',  'e',  'n',  ' ',  'E',  'l', 
    'e',  'c',  't',  'r',  'o',  'n',  ' ',  'r', 
    'e',  'n',  'd',  'e',  'r',  'e',  'r',  ' ', 
    'i',  'n',  't',  'o',  ' ',  't',  'h',  'e', 
    ' ',  'K',  'W',  'i',  'n',  ' ',  'r',  'e', 
    'n',  'd',  'e',  'r',  ' ',  'c',  'h',  'a', 
    'i',  'n',  '.',  0x62,  'I',  'd',  0x64,  'h', 
    'a',  'l',  'o',  0x67,  'L',  'i',  'c',  'e', 
    'n',  's',  'e',  0x63,  'M',  'I',  'T',  0x64, 
    'N',  'a',  'm',  'e',  0x6b,  'H',  'a',  'l', 
    'o',  ' ',  'I',  's',  'l',  'a',  'n',  'd', 
    0x67,  'V',  'e',  'r',  's',  'i',  'o',  'n', 
    0x65,  '0',  '.',  '1',  '.',  '0',  0x70,  'X', 
    '-',  'K',  'D',  'E',  '-',  'P',  'l',  'u', 
    'g',  'i',  'n',  'I',  'n',  'f',  'o',  0xa3, 
    0x6b,  'D',  'e',  's',  'c',  'r',  'i',  'p', 
    't',  'i',  'o',  'n',  0x78,  0x38,  'H',  'a', 
    'l',  'o',  ' ',  'I',  's',  'l',  'a',  'n', 
    'd',  ' ',  uchar('\xe2'), uchar('\x80'), uchar('\x94'), ' ',  'o',  'f', 
    'f',  's',  'c',  'r',  'e',  'e',  'n',  ' ', 
    'p',  'a',  'i',  'n',  't',  'e',  'd',  ',', 
    ' ',  'n',  'o',  ' ',  'a',  'p',  'p',  '-', 
    'o',  'w',  'n',  'e',  'd',  ' ',  's',  'u', 
    'r',  'f',  'a',  'c',  'e',  '.',  0x64,  'N', 
    'a',  'm',  'e',  0x64,  'h',  'a',  'l',  'o', 
    0x67,  'V',  'e',  'r',  's',  'i',  'o',  'n', 
    0x65,  '0',  '.',  '1',  '.',  '0',  0x72,  'X', 
    '-',  'K',  'D',  'E',  '-',  'S',  'e',  'r', 
    'v',  'i',  'c',  'e',  'T',  'y',  'p',  'e', 
    's',  0x81,  0x6b,  'K',  'W',  'i',  'n',  '/', 
    'E',  'f',  'f',  'e',  'c',  't', 
    0xff, 
};
QT_MOC_EXPORT_PLUGIN_V2(halo_factory, halo_factory, qt_pluginMetaDataV2_halo_factory)
#else
QT_PLUGIN_METADATA_SECTION
Q_CONSTINIT static constexpr unsigned char qt_pluginMetaData_halo_factory[] = {
    'Q', 'T', 'M', 'E', 'T', 'A', 'D', 'A', 'T', 'A', ' ', '!',
    // metadata version, Qt version, architectural requirements
    0, QT_VERSION_MAJOR, QT_VERSION_MINOR, qPluginArchRequirements(),
    0xbf, 
    // "IID"
    0x02,  0x78,  0x20,  'o',  'r',  'g',  '.',  'k', 
    'd',  'e',  '.',  'k',  'w',  'i',  'n',  '.', 
    'E',  'f',  'f',  'e',  'c',  't',  'P',  'l', 
    'u',  'g',  'i',  'n',  'F',  'a',  'c',  't', 
    'o',  'r',  'y', 
    // "className"
    0x03,  0x6c,  'h',  'a',  'l',  'o',  '_',  'f', 
    'a',  'c',  't',  'o',  'r',  'y', 
    // "MetaData"
    0x04,  0xa3,  0x67,  'K',  'P',  'l',  'u',  'g', 
    'i',  'n',  0xa6,  0x67,  'A',  'u',  't',  'h', 
    'o',  'r',  's',  0x81,  0xa1,  0x64,  'N',  'a', 
    'm',  'e',  0x64,  'R',  'H',  'E',  'O',  0x6b, 
    'D',  'e',  's',  'c',  'r',  'i',  'p',  't', 
    'i',  'o',  'n',  0x78,  0x56,  'P',  'a',  'i', 
    'n',  't',  's',  ' ',  't',  'h',  'e',  ' ', 
    'H',  'a',  'l',  'o',  ' ',  'i',  's',  'l', 
    'a',  'n',  'd',  ' ',  'f',  'r',  'o',  'm', 
    ' ',  'a',  'n',  ' ',  'o',  'f',  'f',  's', 
    'c',  'r',  'e',  'e',  'n',  ' ',  'E',  'l', 
    'e',  'c',  't',  'r',  'o',  'n',  ' ',  'r', 
    'e',  'n',  'd',  'e',  'r',  'e',  'r',  ' ', 
    'i',  'n',  't',  'o',  ' ',  't',  'h',  'e', 
    ' ',  'K',  'W',  'i',  'n',  ' ',  'r',  'e', 
    'n',  'd',  'e',  'r',  ' ',  'c',  'h',  'a', 
    'i',  'n',  '.',  0x62,  'I',  'd',  0x64,  'h', 
    'a',  'l',  'o',  0x67,  'L',  'i',  'c',  'e', 
    'n',  's',  'e',  0x63,  'M',  'I',  'T',  0x64, 
    'N',  'a',  'm',  'e',  0x6b,  'H',  'a',  'l', 
    'o',  ' ',  'I',  's',  'l',  'a',  'n',  'd', 
    0x67,  'V',  'e',  'r',  's',  'i',  'o',  'n', 
    0x65,  '0',  '.',  '1',  '.',  '0',  0x70,  'X', 
    '-',  'K',  'D',  'E',  '-',  'P',  'l',  'u', 
    'g',  'i',  'n',  'I',  'n',  'f',  'o',  0xa3, 
    0x6b,  'D',  'e',  's',  'c',  'r',  'i',  'p', 
    't',  'i',  'o',  'n',  0x78,  0x38,  'H',  'a', 
    'l',  'o',  ' ',  'I',  's',  'l',  'a',  'n', 
    'd',  ' ',  uchar('\xe2'), uchar('\x80'), uchar('\x94'), ' ',  'o',  'f', 
    'f',  's',  'c',  'r',  'e',  'e',  'n',  ' ', 
    'p',  'a',  'i',  'n',  't',  'e',  'd',  ',', 
    ' ',  'n',  'o',  ' ',  'a',  'p',  'p',  '-', 
    'o',  'w',  'n',  'e',  'd',  ' ',  's',  'u', 
    'r',  'f',  'a',  'c',  'e',  '.',  0x64,  'N', 
    'a',  'm',  'e',  0x64,  'h',  'a',  'l',  'o', 
    0x67,  'V',  'e',  'r',  's',  'i',  'o',  'n', 
    0x65,  '0',  '.',  '1',  '.',  '0',  0x72,  'X', 
    '-',  'K',  'D',  'E',  '-',  'S',  'e',  'r', 
    'v',  'i',  'c',  'e',  'T',  'y',  'p',  'e', 
    's',  0x81,  0x6b,  'K',  'W',  'i',  'n',  '/', 
    'E',  'f',  'f',  'e',  'c',  't', 
    0xff, 
};
QT_MOC_EXPORT_PLUGIN(halo_factory, halo_factory)
#endif  // QT_MOC_EXPORT_PLUGIN_V2

QT_WARNING_POP
