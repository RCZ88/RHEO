"use strict";
var __importDefault = function (mod) {
    return (mod && mod.__importDefault) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });

// Linux fallback for getting the foreground window when active-win fails.
// Uses xdotool + ps to reconstruct { owner: { name, path }, title }.

const child_process_1 = require("child_process");
const util_1 = require("util");

const exec = util_1.promisify(child_process_1.exec);

interface OwnerInfo {
    name: string;
    path: string;
}

interface ForegroundWindow {
    owner: OwnerInfo;
    title: string;
}

/**
 * Returns the current Linux foreground window info, or null if unavailable.
 * Tries xdotool first; falls back to empty result on any failure.
 */
async function getLinuxForegroundWindow(): Promise<ForegroundWindow | null> {
    try {
        // Get the active window ID
        const idOut = await exec("xdotool getactivewindow 2>/dev/null");
        const winId = (idOut.stdout || "").trim();
        if (!winId) return null;

        // Get the window title
        let title = "";
        try {
            const titleOut = await exec(`xdotool getwindowname ${winId} 2>/dev/null`);
            title = (titleOut.stdout || "").trim();
        } catch {
            // title lookup failed — continue with empty title
        }
        if (!title) {
            // Fallback: try xprop
            try {
                const propOut = await exec(`xprop -id ${winId} WM_NAME 2>/dev/null`);
                const match = (propOut.stdout || "").match(/WM_NAME\\("?([^"]*)"?\\)/);
                if (match) title = match[1] || "";
            } catch {
                // xprop also failed
            }
        }

        // Get the owning process PID, then resolve name + path
        let owner: OwnerInfo = { name: "", path: "" };
        try {
            const pidOut = await exec(`xdotool getwindowpid ${winId} 2>/dev/null`);
            const pid = (pidOut.stdout || "").trim();
            if (pid) {
                // Process name
                try {
                    const cmdOut = await exec(`ps -p ${pid} -o comm= 2>/dev/null`);
                    owner.name = (cmdOut.stdout || "").trim();
                } catch { /* ignore */ }
                // Process executable path
                try {
                    const exeOut = await exec(`readlink -f /proc/${pid}/exe 2>/dev/null`);
                    owner.path = (exeOut.stdout || "").trim();
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }

        return { owner, title };
    } catch {
        return null;
    }
}

exports.getLinuxForegroundWindow = getLinuxForegroundWindow;
