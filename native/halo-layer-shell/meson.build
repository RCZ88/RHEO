project('halo-layer-shell', 'c', default_options: ['warning_level=2', 'werror=false'])

gtk4_dep = dependency('gtk4', required: true)
layer_shell_dep = dependency('gtk4-layer-shell-0', required: true)
webkit_dep = dependency('webkitgtk-6.0', required: true)
json_dep = dependency('json-glib-1.0', required: true)

# Find pkg-config paths for include dirs
gtk4_cflags = run_command('pkg-config', '--cflags', 'gtk4', check: true).stdout().strip()
layer_shell_cflags = run_command('pkg-config', '--cflags', 'gtk4-layer-shell-0', check: true).stdout().strip()
webkit_cflags = run_command('pkg-config', '--cflags', 'webkitgtk-6.0', check: true).stdout().strip()
json_cflags = run_command('pkg-config', '--cflags', 'json-glib-1.0', check: true).stdout().strip()

all_cflags = gtk4_cflags + ' ' + layer_shell_cflags + ' ' + webkit_cflags + ' ' + json_cflags

executable('halo-layer-shell',
  'main.c',
  dependencies: [gtk4_dep, layer_shell_dep, webkit_dep, json_dep],
  c_args: all_cflags.split(' '),
  install: false
)
