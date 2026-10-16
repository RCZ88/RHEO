/**
 * Halo layer-shell helper.
 *
 * WHY THIS EXISTS. The halo island was an Electron BrowserWindow — a real toplevel. On this box
 * Electron is forced onto XWayland (`--ozone-platform=x11`), so its toplevel lives in the X11
 * stacking group and every NATIVE Wayland window (Firefox, VS Code) is above it, permanently.
 * `setAlwaysOnTop` is only advisory there: it re-orders siblings inside X11 and cannot touch the
 * Wayland surface list. That is the whole reason the island "does not show over other apps", and
 * the whole reason it reads as a separate window.
 *
 * A zwlr_layer_shell surface is not a window. The compositor places it in the shell's own layer
 * stack ABOVE every toplevel, which is why panels, docks and status bars work. That is the only
 * mechanism on this compositor that survives a change of focused application.
 *
 * SCOPE, deliberately small. This process draws and places ONE surface. It does NOT poll the
 * cursor: Electron already has a working cursor probe (`getLinuxCursorPoint` -> kdotool, measured
 * 6/6 on this machine) and duplicating it here would add a second, worse implementation of the
 * one part that is already proven. Electron decides open/close and sends `show` / `hide`.
 *
 * PROTOCOL — one JSON object per line on stdin, one per line on stdout.
 *   in : {"type":"show","url":"http://.../halo.html","x":N,"y":N,"w":N,"h":N}
 *        {"type":"hide"}
 *   out: {"type":"ready"}
 */

#include <gtk/gtk.h>
#include <gtk4-layer-shell.h>
#include <webkit/webkit.h>
#include <json-glib/json-glib.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  GtkWindow *window;
  WebKitWebView *webview;
  GMainLoop *loop;
  gboolean visible;
} Halo;

static Halo *g_halo = NULL;

static void emit(const char *type) {
  /* A literal, not a serialised JsonObject. json-glib's only serializer is
   * `json_generator_to_data`; `json_object_to_json_string` and `JSON_C_TO_STRING_PLAIN` are
   * json-c symbols and do not exist in this library. The message set is two fixed strings, so
   * building a tree to print them was the wrong shape anyway. */
  printf("{\"type\":\"%s\"}\n", type);
  fflush(stdout);
}

static void apply_geometry(Halo *halo, int x, int y, int w, int h) {
  /* A layer-shell surface is positioned by MARGINS, not by `gtk_window_move`. Anchoring only
   * TOP+LEFT hands both dimensions to us; anchoring all four would let the compositor stretch the
   * surface across the entire output and silently ignore every geometry message. */
  gtk_layer_set_margin(halo->window, GTK_LAYER_SHELL_EDGE_TOP, y);
  gtk_layer_set_margin(halo->window, GTK_LAYER_SHELL_EDGE_LEFT, x);
  gtk_widget_set_size_request(GTK_WIDGET(halo->window), w, h);
}

static void on_load_changed(WebKitWebView *wv, WebKitLoadEvent ev, gpointer ud) {
  (void)wv;
  (void)ud;
  if (ev == WEBKIT_LOAD_FINISHED) emit("ready");
}

static void handle_line(Halo *halo, const char *line) {
  JsonParser *p = json_parser_new();
  if (!json_parser_load_from_data(p, line, -1, NULL)) {
    g_object_unref(p);
    return;
  }
  JsonNode *root = json_parser_get_root(p);
  if (!JSON_NODE_HOLDS_OBJECT(root)) {
    g_object_unref(p);
    return;
  }
  JsonObject *msg = json_node_get_object(root);
  const char *type = json_object_get_string_member(msg, "type");

  if (g_strcmp0(type, "show") == 0) {
    /* Flat members, matching the protocol documented at the top of this file. An earlier pass
     * read them out of a nested "payload" object, which disagreed with its own docstring: every
     * sender following the documented shape made `json_object_get_object_member` return NULL and
     * tripped a Json-CRITICAL instead of drawing. The doc and the code must be the same shape. */
    /* A URL, not an HTML string. The island is a full React bundle; pushing it down a pipe on
     * every hover would mean serialising megabytes each time the pointer crossed the edge. The
     * helper loads the same page Electron already serves. */
    const char *url = json_object_get_string_member(msg, "url");
    if (url) webkit_web_view_load_uri(halo->webview, url);
    apply_geometry(halo, json_object_get_int_member(msg, "x"),
                   json_object_get_int_member(msg, "y"),
                   json_object_get_int_member(msg, "w"),
                   json_object_get_int_member(msg, "h"));
    if (!halo->visible) {
      gtk_widget_set_visible(GTK_WIDGET(halo->window), TRUE);
      halo->visible = TRUE;
    }
  } else if (g_strcmp0(type, "hide") == 0) {
    if (halo->visible) {
      gtk_widget_set_visible(GTK_WIDGET(halo->window), FALSE);
      halo->visible = FALSE;
    }
  }
  g_object_unref(p);
}

static gboolean on_stdin(GIOChannel *ch, GIOCondition cond, gpointer ud) {
  Halo *halo = ud;
  (void)cond;
  char *line = NULL;
  gsize len = 0;
  GIOStatus st = g_io_channel_read_line(ch, &line, &len, NULL, NULL);
  if (st == G_IO_STATUS_NORMAL && line) {
    char *nl = strchr(line, '\n');
    if (nl) *nl = '\0';
    handle_line(halo, line);
    g_free(line);
  } else if (st == G_IO_STATUS_EOF || st == G_IO_STATUS_ERROR) {
    /* Parent went away: tear the surface down rather than leaving an orphan overlay on screen. */
    if (halo->visible) gtk_widget_set_visible(GTK_WIDGET(halo->window), FALSE);
    g_main_loop_quit(halo->loop);
    return G_SOURCE_REMOVE;
  }
  return G_SOURCE_CONTINUE;
}

static gboolean on_close_request(GtkWindow *w, gpointer ud) {
  (void)w;
  (void)ud;
  if (g_halo) g_main_loop_quit(g_halo->loop);
  return TRUE;
}

int main(void) {
  gtk_init();

  g_halo = g_new0(Halo, 1);
  g_halo->loop = g_main_loop_new(NULL, FALSE);

  GtkWindow *win = GTK_WINDOW(gtk_window_new());
  g_halo->window = win;
  gtk_window_set_decorated(win, FALSE);
  gtk_window_set_resizable(win, FALSE);
  gtk_window_set_title(win, "halo-layer-shell");
  gtk_layer_init_for_window(win);
  gtk_layer_set_layer(win, GTK_LAYER_SHELL_LAYER_OVERLAY);
  /* NEVER steal focus. The whole surface is click-through while collapsed, and a focused overlay
   * that steals keys from the app underneath is the exact failure this helper exists to remove. */
  gtk_layer_set_keyboard_mode(win, GTK_LAYER_SHELL_KEYBOARD_MODE_NONE);
  gtk_layer_set_exclusive_zone(win, 0);
  gtk_layer_set_anchor(win, GTK_LAYER_SHELL_EDGE_TOP, TRUE);
  gtk_layer_set_anchor(win, GTK_LAYER_SHELL_EDGE_LEFT, TRUE);

  WebKitWebView *wv = WEBKIT_WEB_VIEW(webkit_web_view_new());
  g_halo->webview = wv;

  WebKitSettings *st = webkit_web_view_get_settings(wv);
  webkit_settings_set_enable_developer_extras(st, FALSE);
  webkit_settings_set_enable_write_console_messages_to_stdout(st, TRUE);
  webkit_settings_set_allow_file_access_from_file_urls(st, FALSE);
  webkit_settings_set_allow_universal_access_from_file_urls(st, FALSE);

  /* Transparent surface — the island is a capsule floating over whatever is behind it. */
  GdkRGBA transparent = {0.0, 0.0, 0.0, 0.0};
  webkit_web_view_set_background_color(wv, &transparent);

  g_signal_connect(wv, "load-changed", G_CALLBACK(on_load_changed), NULL);
  gtk_window_set_child(win, GTK_WIDGET(wv));

  GIOChannel *ch = g_io_channel_unix_new(STDIN_FILENO);
  g_io_channel_set_encoding(ch, NULL, NULL);
  g_io_channel_set_buffered(ch, TRUE);
  g_io_add_watch(ch, G_IO_IN | G_IO_HUP | G_IO_ERR, on_stdin, g_halo);
  g_signal_connect(win, "close-request", G_CALLBACK(on_close_request), NULL);

  gtk_widget_set_size_request(GTK_WIDGET(win), 232, 40);
  g_main_loop_run(g_halo->loop);

  g_io_channel_unref(ch);
  g_main_loop_unref(g_halo->loop);
  g_free(g_halo);
  g_halo = NULL;
  return 0;
}