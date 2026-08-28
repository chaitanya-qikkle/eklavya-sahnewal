// Undo / redo for the editor tools.
//
// One shared history across every tool, so Ctrl+Z always steps back through
// whatever the user actually did last — rotating slots, breaking a wall,
// dropping a mast — rather than each tool keeping its own private stack.
//
// Slider drags fire continuously, so changes carrying the same `label` within
// COALESCE_MS collapse into a single history entry. Without that, one drag
// would bury the previous action under a hundred steps.

import { useCallback, useEffect, useRef, useState } from "react";

const LIMIT = 200;
const COALESCE_MS = 600;

export default function useUndoable(initial) {
    const [hist, setHist] = useState({ past: [], present: initial, future: [] });
    const last = useRef({ t: 0, label: null });

    const set = useCallback((next, label) => {
        setHist(h => {
            const value = typeof next === "function" ? next(h.present) : next;
            if (value === h.present) return h;
            const now = Date.now();
            const merge = label != null && label === last.current.label && now - last.current.t < COALESCE_MS;
            last.current = { t: now, label };
            if (merge) return { past: h.past, present: value, future: [] };
            return { past: [...h.past, h.present].slice(-LIMIT), present: value, future: [] };
        });
    }, []);

    const undo = useCallback(() => setHist(h => {
        if (!h.past.length) return h;
        last.current = { t: 0, label: null };
        return {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
        };
    }), []);

    const redo = useCallback(() => setHist(h => {
        if (!h.future.length) return h;
        last.current = { t: 0, label: null };
        return {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
        };
    }), []);

    const reset = useCallback((value) => {
        last.current = { t: 0, label: null };
        setHist({ past: [], present: value, future: [] });
    }, []);

    // Ctrl/Cmd+Z to undo, Ctrl+Shift+Z or Ctrl+Y to redo — skipped while the
    // user is typing into a field.
    useEffect(() => {
        const onKey = (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            const t = e.target;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
            const k = e.key.toLowerCase();
            if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
            else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [undo, redo]);

    return [
        hist.present,
        set,
        { undo, redo, reset, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0, depth: hist.past.length },
    ];
}
