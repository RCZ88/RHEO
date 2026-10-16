/*
 * halo-layer-host — the Halo island's CROSS-APP surface.
 * ============================================================================
 *
 * TWO MODES, ONE WINDOW
 * ---------------------
 * PLACEHOLDER mode (no frames yet): draws a self-contained capsule. This is the
 * gate-1 proof — it shows that a layer-shell surface paints above other apps,
 * that hover/click arrive, and that clicks outside the surface go to whatever is
 * underneath. It exists so the mechanism can be verified before the render
 * pipeline is trusted.
 *
 * LIVE mode (frames arriving): the REAL island. An Electron window with
 * `webPreferences.offscreen` renders the actual island UI (same React tree as
 * in-app — halo.html / OverlayRoot) at 30fps and streams BGRA bitmaps over the
 * RHEO bridge socket (~/.local/share/rheo/halo-bridge.sock, see
 * src/main/halo/offscreenRenderer.ts and frameProtocol.ts). This process:
 *   - connects, sends `hello` {protocolVersion:1}, expects `hello-ack`
 *   - reads length-prefixed JSON headers; a `frame` header is followed by
 *     exactly `byteLength` raw pixels (not length-prefixed — the header is the
 *     length)
 *   - computes the alpha bounding box of each frame (the canvas is transparent
 *     except the island), resizes itself to exactly that box, and blits the
 *     pixels through cairo (BGRA premultiplied on LE == CAIRO_FORMAT_ARGB32's
 *     byte order, so this is a copy, not a conversion)
 *   - sends pointer events BACK over the same socket so the offscreen island
 *     can react: enter/leave/move/down/up, in FRAME-local coordinates
 *
 * INPUT SAFETY IS STILL GEOMETRY: the surface is exactly the opaque island's
 * bounding box. There is no code path that consumes a click outside it.
 *
 * WHY THIS AND NOT THE KWIN EFFECT (for now)
 * ------------------------------------------
 * The KWin C++ effect path works in principle (the plugin now builds, exports
 * qt_plugin_instance, and loads via KPluginFactory when installed FLAT as
 * kwin/effects/halo.so — verified with a loader probe), but it requires root
 * install + a compositor restart to even test, and a crash there takes the
 * desktop down. The layer-shell path needs none of that and is crash-isolated.
 * The KWin effect remains the fallback, not the primary.
 *
 * Build:  bash native/halo-layer-host/build.sh
 * Check:  ./halo-layer-host --check       (compositor support probe)
 * Run:    normally SPAWNED BY THE APP; single-instance (flock on
 *         ~/.local/state/rheo/halo-layer-host.lock). The surface stays HIDDEN until the
 *         app's first frame arrives and hides again the moment the bridge disconnects —
 *         so it can never linger on screen after the app exits.
 *         ./halo-layer-host --no-socket   (placeholder demo only)
 *         ./halo-layer-host --expanded    (placeholder demo, start expanded)
 * State:  ~/.local/state/rheo/halo-layer-host.log
 */

#include <gtk/gtk.h>
#include <gtk4-layer-shell.h>
#include <pango/pangocairo.h>
#include <glib-unix.h>
#include <cairo.h>
#include <errno.h>
#include <math.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <fcntl.h>
#include <sys/file.h>

/* Board 1 "Sizes" presets, from the Figma dump in the research doc. */
#define COLLAPSED_W 182
#define COLLAPSED_H 28
#define EXPANDED_W 227
#define EXPANDED_H 134

#define PROTOCOL_VERSION 1
#define DEFAULT_SOCKET_SUFFIX "/.local/share/rheo/halo-bridge.sock"
#define ALPHA_THRESHOLD 8
#define RECONNECT_MS 3000
/* The bridge destroys any client that goes quiet for more than 15 s
 * (offscreenRenderer.checkHeartbeats). This host only wrote when the pointer moved, so every
 * quiet stretch got the socket killed and re-handshaked ~17 s later — frames stalled for the
 * gap, and hover could not be reported while disconnected. 5 s keeps the channel warm. */
#define HEARTBEAT_MS 5000

static GtkWidget *g_window = NULL;
static GtkWidget *g_area = NULL;
static gboolean g_expanded = FALSE;      /* placeholder-mode state */
static GMainLoop *g_loop = NULL;
/* NOT `g_log` — that name is already glib's logging function in <glib.h>. */
static FILE *g_state_log = NULL;

/* ── frame pipeline state ────────────────────────────────────────────────── */
static int g_sock = -1;
static guint g_sock_watch = 0;
static guint g_reconnect_timer = 0;
static guint g_heartbeat_timer = 0;
static char g_sock_path[512];
static gboolean g_use_socket = TRUE;
static gboolean g_hello_ack = FALSE;

static GByteArray *g_rx = NULL;          /* raw receive buffer               */
static uint8_t *g_frame_slots[2] = {NULL, NULL};
static int g_slot_use = 0;
static uint8_t *g_cur_frame = NULL;      /* latest COMPLETE frame, or NULL   */
static int g_fw = 0, g_fh = 0;           /* frame dimensions                 */
static uint32_t g_last_seq = 0;
static uint64_t g_need_pixels = 0;       /* bytes of pixels still arriving   */
static uint8_t *g_fill_target = NULL;    /* where those bytes go (this slot) */

static int g_bbox[4] = {0, 0, 0, 0};     /* island box inside the frame      */
static gboolean g_have_bbox = FALSE;
static gboolean g_live = FALSE;          /* at least one frame has arrived   */
static gboolean g_shown = FALSE;         /* surface is mapped right now      */
static int g_singleton_fd = -1;          /* flock fd, held for process life  */

static void state(const char *fmt, ...)
{
    char buf[512];
    va_list ap;

    va_start(ap, fmt);
    vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);

    printf("[halo-layer-host] %s\n", buf);
    fflush(stdout);

    if (g_state_log) {
        fprintf(g_state_log, "[%ld] %s\n", (long)time(NULL), buf);
        fflush(g_state_log);
    }
}

static void open_log(void)
{
    const char *stateHome = getenv("XDG_STATE_HOME");
    char dir[512];
    char path[600];

    if (stateHome && stateHome[0]) {
        snprintf(dir, sizeof(dir), "%s/rheo", stateHome);
    } else {
        const char *home = getenv("HOME");
        if (!home || !home[0])
            return;
        snprintf(dir, sizeof(dir), "%s/.local/state/rheo", home);
    }
    g_mkdir_with_parents(dir, 0755);
    snprintf(path, sizeof(path), "%s/halo-layer-host.log", dir);
    g_state_log = fopen(path, "a");
}

/* ── surface visibility: the island exists only while the app feeds it ───── */
/* The app quits → the bridge socket closes → the surface must leave the screen in the same
 * breath. Anything else is the "orphan pill" the user sees and reads as a stuck, separate
 * app. Symmetrically, a frame arriving is proof of life: map the surface on the FIRST frame
 * after every (re)connect, never on startup. */
static void surface_hide(const char *why)
{
    if (g_window && g_shown) {
        gtk_widget_set_visible(g_window, FALSE);
        g_shown = FALSE;
        state("surface hidden (%s)", why);
    }
}

static void surface_show(void)
{
    if (g_window && !g_shown) {
        gtk_widget_set_visible(g_window, TRUE);
        g_shown = TRUE;
        state("surface shown (live frames flowing)");
    }
}

/* ══════════════════════════════════════════════════════════════════════════
 * SOCKET: frames in, pointer out
 * ══════════════════════════════════════════════════════════════════════════ */

/* Minimal integer scan for our OWN protocol's fixed header fields. The JSON
 * parser lives in frameProtocol.ts on the producing side; this side only needs
 * widths, heights and lengths, and deliberately does not grow into a general
 * parser. Anything unparseable is treated as "not a usable frame". */
static gboolean json_int(const char *json, const char *key, long *out)
{
    char pat[64];
    const char *p;
    long v;

    snprintf(pat, sizeof(pat), "\"%s\"", key);
    p = g_strstr_len(json, -1, pat);
    if (!p)
        return FALSE;
    p = strchr(p, ':');
    if (!p)
        return FALSE;
    p++;
    while (*p == ' ')
        p++;
    errno = 0;
    v = strtol(p, NULL, 10);
    if (errno != 0)
        return FALSE;
    *out = v;
    return TRUE;
}

static void send_len_prefixed(const char *json)
{
    uint32_t n;
    uint8_t lenbuf[4];

    if (g_sock < 0)
        return;
    n = (uint32_t)strlen(json);
    lenbuf[0] = (uint8_t)(n & 0xff);
    lenbuf[1] = (uint8_t)((n >> 8) & 0xff);
    lenbuf[2] = (uint8_t)((n >> 16) & 0xff);
    lenbuf[3] = (uint8_t)((n >> 24) & 0xff);
    if (write(g_sock, lenbuf, 4) != 4)
        return;
    (void)!write(g_sock, json, n);
}

static void send_pointer(const char *kind, int action, double wx, double wy,
                         int button, gboolean pressed)
{
    char json[320];
    int fx = g_bbox[0] + (int)wx;
    int fy = g_bbox[1] + (int)wy;

    if (g_sock < 0 || !g_hello_ack)
        return;
    snprintf(json, sizeof(json),
             "{\"type\":\"pointer\",\"payload\":{\"action\":%d,\"kind\":\"%s\","
             "\"x\":%d,\"y\":%d,\"button\":%d,\"pressed\":%s,\"modifiers\":0}}",
             action, kind, fx, fy, button, pressed ? "true" : "false");
    send_len_prefixed(json);
}

static void socket_close(void)
{
    if (g_sock_watch) {
        g_source_remove(g_sock_watch);
        g_sock_watch = 0;
    }
    if (g_sock >= 0) {
        close(g_sock);
        g_sock = -1;
    }
    g_hello_ack = FALSE;
    /* The app is gone (or the channel died): take the surface off screen IMMEDIATELY. A
     * disconnected island that keeps painting is the orphan that looks "separate from the
     * app", and its stale bbox would keep consuming input at that spot. */
    surface_hide("bridge disconnected");
}

static void schedule_reconnect(void);

/* Alpha bounding box over the latest frame. The canvas is transparent except the
 * island, so this IS the island's rectangle — it drives both the window size and
 * (by construction) the input area. */
static gboolean compute_bbox(const uint8_t *px, int w, int h, int out[4])
{
    int minx = w, miny = h, maxx = -1, maxy = -1;

    for (int y = 0; y < h; y++) {
        const uint8_t *row = px + (size_t)y * w * 4;
        for (int x = 0; x < w; x++) {
            if (row[x * 4 + 3] >= ALPHA_THRESHOLD) {
                if (x < minx)
                    minx = x;
                if (x > maxx)
                    maxx = x;
                if (y < miny)
                    miny = y;
                if (y > maxy)
                    maxy = y;
            }
        }
    }
    if (maxx < minx || maxy < miny) {
        out[0] = out[1] = out[2] = out[3] = 0;
        return FALSE;
    }
    out[0] = minx;
    out[1] = miny;
    out[2] = maxx - minx + 1;
    out[3] = maxy - miny + 1;
    return TRUE;
}

static void apply_surface_size(int w, int h)
{
    gtk_drawing_area_set_content_width(GTK_DRAWING_AREA(g_area), w);
    gtk_drawing_area_set_content_height(GTK_DRAWING_AREA(g_area), h);
    gtk_window_set_default_size(GTK_WINDOW(g_window), w, h);
    gtk_widget_queue_draw(g_area);
}

static void on_frame_complete(void)
{
    int box[4];
    gboolean visible;

    g_cur_frame = g_frame_slots[g_slot_use];
    g_slot_use ^= 1;

    if (!g_live) {
        g_live = TRUE;
        state("LIVE: first frame %dx%d (seq %u) — placeholder painting is OFF",
              g_fw, g_fh, g_last_seq);
    }

    /* A complete frame is proof the app is alive: map the surface if it was hidden. */
    surface_show();

    visible = compute_bbox(g_cur_frame, g_fw, g_fh, box);
    if (visible) {
        if (!g_have_bbox || memcmp(box, g_bbox, sizeof(box)) != 0) {
            memcpy(g_bbox, box, sizeof(box));
            g_have_bbox = TRUE;
            apply_surface_size(box[2], box[3]);
        }
    } else {
        /* Fully transparent frame: the island is hidden. Keep it out of the way
         * and out of input entirely. */
        g_have_bbox = FALSE;
        apply_surface_size(2, 2);
    }
    gtk_widget_queue_draw(g_area);
}

static gboolean socket_readable(gint fd, GIOCondition cond, gpointer data)
{
    uint8_t tmp[65536];
    ssize_t n;

    (void)data;
    if (cond & (G_IO_ERR | G_IO_HUP)) {
        state("socket closed by peer — hiding surface until reconnect");
        socket_close();
        schedule_reconnect();
        return FALSE;
    }

    n = recv(fd, tmp, sizeof(tmp), 0);
    if (n <= 0) {
        state("socket recv failed (%s) — reconnecting", strerror(errno));
        socket_close();
        schedule_reconnect();
        return FALSE;
    }
    g_byte_array_append(g_rx, tmp, (guint)n);

    /* Drain as many complete messages as the buffer holds. */
    for (;;) {
        if (g_need_pixels > 0) {
            guint take = (guint)MIN((guint64)g_rx->len, g_need_pixels);
            memcpy(g_fill_target, g_rx->data, take);
            g_fill_target += take;
            g_need_pixels -= take;
            g_byte_array_remove_range(g_rx, 0, take);
            if (g_need_pixels == 0)
                on_frame_complete();
            else
                break;
            continue;
        }

        if (g_rx->len < 4)
            break;
        uint32_t len = (uint32_t)g_rx->data[0] | ((uint32_t)g_rx->data[1] << 8) |
                       ((uint32_t)g_rx->data[2] << 16) | ((uint32_t)g_rx->data[3] << 24);
        if (len > 65536) {
            state("oversized message (%u) — resync by dropping the connection", len);
            socket_close();
            schedule_reconnect();
            return FALSE;
        }
        if (g_rx->len < 4 + len)
            break;

        char *msg = g_strndup((const char *)g_rx->data + 4, len);
        g_byte_array_remove_range(g_rx, 0, 4 + len);

        if (strstr(msg, "\"hello-ack\"")) {
            g_hello_ack = TRUE;
            state("hello-ack received — handshake complete, waiting for frames");
        } else if (strstr(msg, "\"hello-nak\"")) {
            state("hello-nak: protocol version mismatch — placeholder mode");
            g_hello_ack = FALSE;
        } else if (strstr(msg, "\"frame\"")) {
            long bw = 0, bh = 0, blen = 0;
            if (!json_int(msg, "width", &bw) || !json_int(msg, "height", &bh) ||
                !json_int(msg, "byteLength", &blen) || bw <= 0 || bh <= 0 || blen <= 0 ||
                blen > 64 * 1024 * 1024) {
                state("unusable frame header — ignored");
                g_free(msg);
                continue;
            }
            if ((int)bw != g_fw || (int)bh != g_fh || !g_frame_slots[0]) {
                g_fw = (int)bw;
                g_fh = (int)bh;
                for (int i = 0; i < 2; i++) {
                    g_free(g_frame_slots[i]);
                    g_frame_slots[i] = g_malloc0((gsize)blen);
                }
                g_cur_frame = NULL;
                state("frame geometry %dx%d (%ld bytes) — buffers allocated", g_fw, g_fh, blen);
            }
            g_fill_target = g_frame_slots[g_slot_use];
            g_need_pixels = (uint64_t)blen;
        }
        /* frame-ack and anything else: recognised and ignored. */
        g_free(msg);
    }
    return TRUE;
}

static int socket_connect(void)
{
    struct sockaddr_un addr;
    int fd;

    if (strlen(g_sock_path) >= sizeof(addr.sun_path))
        return -1;

    fd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (fd < 0)
        return -1;

    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    snprintf(addr.sun_path, sizeof(addr.sun_path), "%s", g_sock_path);

    if (connect(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        close(fd);
        return -1;
    }
    return fd;
}

static gboolean try_connect(gpointer data)
{
    (void)data;
    if (g_reconnect_timer) {
        g_source_remove(g_reconnect_timer);
        g_reconnect_timer = 0;
    }
    if (g_sock >= 0)
        return G_SOURCE_REMOVE;

    g_sock = socket_connect();
    if (g_sock < 0) {
        schedule_reconnect();
        return G_SOURCE_REMOVE;
    }

    g_rx = g_byte_array_new();
    g_sock_watch = g_unix_fd_add(g_sock, G_IO_IN | G_IO_ERR | G_IO_HUP, socket_readable, NULL);

    char hello[128];
    snprintf(hello, sizeof(hello),
             "{\"type\":\"hello\",\"payload\":{\"protocolVersion\":%d}}", PROTOCOL_VERSION);
    send_len_prefixed(hello);
    state("connected to %s — hello sent", g_sock_path);
    return G_SOURCE_REMOVE;
}

static gboolean on_heartbeat(gpointer data)
{
    (void)data;
    /* Only after the handshake: a heartbeat before `hello-ack` is a message the bridge has no
     * state for. `g_sock < 0` covers the disconnected window between reconnects. */
    if (g_sock >= 0 && g_hello_ack)
        send_len_prefixed("{\"type\":\"heartbeat\"}");
    return G_SOURCE_CONTINUE;
}

static void schedule_reconnect(void)
{
    if (g_reconnect_timer || !g_use_socket)
        return;
    g_reconnect_timer = g_timeout_add(RECONNECT_MS, try_connect, NULL);
}

/* ══════════════════════════════════════════════════════════════════════════
 * PAINTING
 * ══════════════════════════════════════════════════════════════════════════ */

static void rounded_rect(cairo_t *cr, double x, double y, double w, double h, double r)
{
    if (r > h / 2.0)
        r = h / 2.0;
    if (r > w / 2.0)
        r = w / 2.0;
    cairo_new_sub_path(cr);
    cairo_arc(cr, x + w - r, y + r, r, -M_PI / 2.0, 0);
    cairo_arc(cr, x + w - r, y + h - r, r, 0, M_PI / 2.0);
    cairo_arc(cr, x + r, y + h - r, r, M_PI / 2.0, M_PI);
    cairo_arc(cr, x + r, y + r, r, M_PI, 3.0 * M_PI / 2.0);
    cairo_close_path(cr);
}

static void paint_placeholder(cairo_t *cr, int width, int height)
{
    double w = g_expanded ? EXPANDED_W : COLLAPSED_W;
    double h = g_expanded ? EXPANDED_H : COLLAPSED_H;
    double r = g_expanded ? 12.0 : (h / 2.0);
    (void)width;
    (void)height;

    rounded_rect(cr, 0.5, 0.5, w - 1, h - 1, r);
    cairo_set_source_rgb(cr, 0.086, 0.086, 0.098); /* #16161a */
    cairo_fill_preserve(cr);
    cairo_set_source_rgb(cr, 0.290, 0.298, 0.318);
    cairo_set_line_width(cr, 1);
    cairo_stroke(cr);

    cairo_arc(cr, 14, h / 2.0, 3.5, 0, 2 * M_PI);
    cairo_set_source_rgb(cr, 0.435, 0.702, 0.561); /* #6fb38f */
    cairo_fill(cr);

    PangoLayout *layout = pango_cairo_create_layout(cr);
    PangoFontDescription *fd = pango_font_description_from_string("monospace 9");
    pango_layout_set_font_description(layout, fd);

    if (g_expanded) {
        pango_layout_set_width(layout, (int)((EXPANDED_W - 56) * PANGO_SCALE));
        pango_layout_set_text(layout,
                              "HALO — PLACEHOLDER\n"
                              "waiting for island frames\n"
                              "(start RHEO: the real UI takes over)", -1);
        cairo_set_source_rgb(cr, 0.94, 0.94, 0.95);
        cairo_move_to(cr, 28, 16);
        pango_cairo_show_layout(cr, layout);
    } else {
        /* 182px wide; ~21 chars fit at monospace 9 from x=26. */
        pango_layout_set_text(layout, "HALO · LAYER-SHELL", -1);
        int th = 0;
        pango_layout_get_pixel_size(layout, NULL, &th);
        cairo_set_source_rgb(cr, 0.94, 0.94, 0.95);
        cairo_move_to(cr, 26, (h - th) / 2.0);
        pango_cairo_show_layout(cr, layout);
    }

    pango_font_description_free(fd);
    g_object_unref(layout);
}

static void on_draw(GtkDrawingArea *area, cairo_t *cr, int width, int height, gpointer data)
{
    (void)area;
    (void)data;

    /* Transparent backdrop for both modes. */
    cairo_set_operator(cr, CAIRO_OPERATOR_SOURCE);
    cairo_set_source_rgba(cr, 0, 0, 0, 0);
    cairo_paint(cr);
    cairo_set_operator(cr, CAIRO_OPERATOR_OVER);

    if (g_live && g_cur_frame && g_have_bbox) {
        /* The window is exactly the island's bounding box; the frame is the full
         * canvas. Shift the source by -bbox so the box lands at (0,0).
         *
         * BGRA premultiplied (Electron) has bytes B,G,R,A — on little-endian that
         * is exactly CAIRO_FORMAT_ARGB32's memory order, so this is a blit. */
        cairo_surface_t *surf = cairo_image_surface_create_for_data(
            g_cur_frame, CAIRO_FORMAT_ARGB32, g_fw, g_fh, g_fw * 4);
        if (cairo_surface_status(surf) == CAIRO_STATUS_SUCCESS) {
            cairo_set_source_surface(cr, surf, -g_bbox[0], -g_bbox[1]);
            cairo_paint(cr);
        }
        cairo_surface_destroy(surf);
        (void)width;
        (void)height;
        return;
    }

    paint_placeholder(cr, width, height);
}

/* ══════════════════════════════════════════════════════════════════════════
 * INPUT — hover + clicks. In live mode these become pointer messages for the
 * offscreen island; the surface size (and therefore input span) always equals
 * the island bounding box.
 * ══════════════════════════════════════════════════════════════════════════ */

static void on_enter(GtkEventControllerMotion *controller, double x, double y, gpointer data)
{
    (void)controller;
    (void)data;
    if (g_live) {
        send_pointer("enter", 0, x, y, 0, FALSE);
        return;
    }
    /* Placeholder mode keeps the self-contained hover demo. */
    if (!g_expanded) {
        g_expanded = TRUE;
        apply_surface_size(EXPANDED_W, EXPANDED_H);
        state("hover ENTER -> expanded (placeholder)");
    }
}

static void on_motion(GtkEventControllerMotion *controller, double x, double y, gpointer data)
{
    (void)controller;
    (void)data;
    if (g_live)
        send_pointer("move", 0, x, y, 0, FALSE);
}

static void on_leave(GtkEventControllerMotion *controller, gpointer data)
{
    (void)controller;
    (void)data;
    if (g_live) {
        send_pointer("leave", 0, 0, 0, 0, FALSE);
        return;
    }
    if (g_expanded) {
        g_expanded = FALSE;
        apply_surface_size(COLLAPSED_W, COLLAPSED_H);
        state("hover LEAVE -> collapsed (placeholder)");
    }
}

static void on_click(GtkGestureClick *gesture, int n_press, double x, double y, gpointer data)
{
    (void)gesture;
    (void)n_press;
    (void)data;
    if (g_live) {
        send_pointer("down", 0, x, y, 1, TRUE);
        send_pointer("up", 0, x, y, 1, FALSE);
        return;
    }
    state("click inside placeholder — consumed, not delivered below. Quitting (proof).");
    if (g_window)
        gtk_window_destroy(GTK_WINDOW(g_window));
}

static void on_destroy(GtkWidget *widget, gpointer data)
{
    (void)widget;
    (void)data;
    /* The widget is gone; NULL the global so later surface_hide() calls stay no-ops. */
    g_window = NULL;
    if (g_loop)
        g_main_loop_quit(g_loop);
}

/* ══════════════════════════════════════════════════════════════════════════ */

int main(int argc, char **argv)
{
    gboolean want_check = FALSE;
    gboolean start_expanded = FALSE;

    setvbuf(stdout, NULL, _IOLBF, 0);
    open_log();

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--check") == 0)
            want_check = TRUE;
        else if (strcmp(argv[i], "--expanded") == 0)
            start_expanded = TRUE;
        else if (strcmp(argv[i], "--no-socket") == 0)
            g_use_socket = FALSE;
    }

    {
        const char *override = getenv("HALO_BRIDGE_SOCKET");
        const char *home = getenv("HOME");
        if (override && override[0]) {
            snprintf(g_sock_path, sizeof(g_sock_path), "%s", override);
        } else if (home && home[0]) {
            snprintf(g_sock_path, sizeof(g_sock_path), "%s%s", home, DEFAULT_SOCKET_SUFFIX);
        } else {
            g_use_socket = FALSE;
        }
    }

    gtk_init();

    if (!gtk_layer_is_supported()) {
        fprintf(stderr,
                "[halo-layer-host] layer-shell NOT supported by this compositor. "
                "Fallback path: the KWin effect plugin.\n");
        return 2;
    }

    if (want_check) {
        printf("gtk_layer_is_supported: YES\n");
        return 0;
    }

    /* Single instance. The app spawns this unconditionally at startup, and a host from a
     * previous app run may still be alive (it survives while reconnecting/while the app is
     * down). Two instances would stack two surfaces and double every pointer event, so the
     * SECOND one exits 0 silently — the spawner cannot tell the difference, which is fine. */
    {
        const char *stateHome = getenv("XDG_STATE_HOME");
        const char *home = getenv("HOME");
        char lock_path[600];
        if (stateHome && stateHome[0]) {
            snprintf(lock_path, sizeof(lock_path), "%s/rheo/halo-layer-host.lock", stateHome);
        } else if (home && home[0]) {
            snprintf(lock_path, sizeof(lock_path), "%s/.local/state/rheo/halo-layer-host.lock", home);
        } else {
            lock_path[0] = '\0';
        }
        if (lock_path[0]) {
            char dirbuf[600];
            char *slash;
            snprintf(dirbuf, sizeof(dirbuf), "%s", lock_path);
            slash = strrchr(dirbuf, '/');
            if (slash) {
                *slash = '\0';
                g_mkdir_with_parents(dirbuf, 0755);
            }
            g_singleton_fd = open(lock_path, O_RDWR | O_CREAT, 0644);
            if (g_singleton_fd >= 0 && flock(g_singleton_fd, LOCK_EX | LOCK_NB) != 0) {
                fprintf(stderr, "[halo-layer-host] another instance already running — exiting\n");
                return 0;
            }
        }
    }

    g_loop = g_main_loop_new(NULL, FALSE);

    g_window = gtk_window_new();
    gtk_window_set_title(GTK_WINDOW(g_window), "halo-layer-host");
    gtk_window_set_decorated(GTK_WINDOW(g_window), FALSE);

    /* Must happen BEFORE the window is realized/presented. */
    gtk_layer_init_for_window(GTK_WINDOW(g_window));
    gtk_layer_set_namespace(GTK_WINDOW(g_window), "halo-layer-host");
    gtk_layer_set_layer(GTK_WINDOW(g_window), GTK_LAYER_SHELL_LAYER_TOP);
    gtk_layer_set_anchor(GTK_WINDOW(g_window), GTK_LAYER_SHELL_EDGE_TOP, TRUE);
    gtk_layer_set_margin(GTK_WINDOW(g_window), GTK_LAYER_SHELL_EDGE_TOP, 8);
    gtk_layer_set_keyboard_mode(GTK_WINDOW(g_window), GTK_LAYER_SHELL_KEYBOARD_MODE_NONE);
    /* 0 = reserve no work area; the island floats over windows or not at all. */
    gtk_layer_set_exclusive_zone(GTK_WINDOW(g_window), 0);

    GtkCssProvider *css = gtk_css_provider_new();
    gtk_css_provider_load_from_string(css,
                                      "window, drawingarea { background: transparent; }");
    gtk_style_context_add_provider_for_display(gdk_display_get_default(),
                                               GTK_STYLE_PROVIDER(css),
                                               GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);

    g_area = gtk_drawing_area_new();
    gtk_drawing_area_set_draw_func(GTK_DRAWING_AREA(g_area), on_draw, NULL, NULL);
    gtk_window_set_child(GTK_WINDOW(g_window), g_area);

    g_expanded = start_expanded;
    apply_surface_size(g_expanded ? EXPANDED_W : COLLAPSED_W,
                       g_expanded ? EXPANDED_H : COLLAPSED_H);

    GtkEventController *motion = gtk_event_controller_motion_new();
    g_signal_connect(motion, "enter", G_CALLBACK(on_enter), NULL);
    g_signal_connect(motion, "motion", G_CALLBACK(on_motion), NULL);
    g_signal_connect(motion, "leave", G_CALLBACK(on_leave), NULL);
    gtk_widget_add_controller(g_window, motion);

    GtkGesture *click = gtk_gesture_click_new();
    gtk_gesture_single_set_button(GTK_GESTURE_SINGLE(click), 1);
    g_signal_connect(click, "pressed", G_CALLBACK(on_click), NULL);
    gtk_widget_add_controller(g_window, GTK_EVENT_CONTROLLER(click));

    g_signal_connect(g_window, "destroy", G_CALLBACK(on_destroy), NULL);

    if (g_use_socket) {
        /* App-driven mode: stay UNMAPPED until the app's first frame arrives. An unmapped
         * surface cannot flash a placeholder, cannot eat input, and — the whole point —
         * cannot linger on screen after the app exits (socket_close → surface_hide). */
        state("socket mode — surface hidden until first frame (layer=TOP anchor=TOP margin-top=8 zone=0)");
    } else {
        gtk_window_present(GTK_WINDOW(g_window));
        g_shown = TRUE;
        state("presented (placeholder demo) layer=TOP anchor=TOP margin-top=8 zone=0");
    }

    if (g_use_socket)
        try_connect(NULL);
    else
        state("--no-socket: placeholder only");

    if (g_use_socket)
        g_heartbeat_timer = g_timeout_add(HEARTBEAT_MS, on_heartbeat, NULL);

    g_main_loop_run(g_loop);
    socket_close();
    state("exited");
    return 0;
}
